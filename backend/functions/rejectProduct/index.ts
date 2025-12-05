import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';
import { isAdmin } from '../../shared/ownershipValidation';
// Product type imported but not used - using 'any' for response transformation
import { getCreatorById } from '../../shared/creatorRepository';
import { sendNotification, generateProductRejectionEmail, shouldSendNotification } from '../../shared/notificationService';

const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'ProductsTable';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const logger = createLogger(event.requestContext.requestId);
  
  logger.logRequest(event);
  
  try {
    // Verify admin role
    if (!isAdmin(event)) {
      logger.warn('Non-admin user attempted to reject product');
      logger.logResponse(403, Date.now() - startTime);
      return errorResponse(
        403,
        'FORBIDDEN',
        'Admin access required',
        event.requestContext.requestId
      );
    }

    const productId = event.pathParameters?.id;

    if (!productId) {
      logger.warn('Product ID is missing');
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Product ID is required',
        event.requestContext.requestId
      );
    }

    if (!event.body) {
      logger.warn('Request body is missing');
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Request body with rejection reason is required',
        event.requestContext.requestId
      );
    }

    const data = JSON.parse(event.body);

    if (!data.reason || typeof data.reason !== 'string' || data.reason.trim() === '') {
      logger.warn('Rejection reason is missing or invalid');
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Rejection reason is required',
        event.requestContext.requestId
      );
    }

    // First, verify the product exists
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        id: productId,
      },
    });

    const getResult = await docClient.send(getCommand);

    if (!getResult.Item) {
      logger.warn('Product not found', { productId });
      logger.logResponse(404, Date.now() - startTime);
      return errorResponse(
        404,
        'NOT_FOUND',
        'Product not found',
        event.requestContext.requestId
      );
    }

    // Update product status to 'rejected' and add rejection reason
    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        id: productId,
      },
      UpdateExpression: 'SET #status = :status, rejectionReason = :reason, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'rejected',
        ':reason': data.reason.trim(),
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    const updateResult = await docClient.send(updateCommand);

    // Transform string booleans back to actual booleans for frontend
    const product = updateResult.Attributes as any;
    if (product.published) {
      product.published = product.published === 'true';
    }
    if (product.featured) {
      product.featured = product.featured === 'true';
    }

    // Send rejection notification to creator
    try {
      const creator = await getCreatorById(product.creatorId);
      if (creator && shouldSendNotification(creator, 'productRejection')) {
        // Get creator's email from userId (Cognito)
        const creatorEmail = creator.userId; // This should be the email or we need to fetch from Cognito
        
        const notificationData = generateProductRejectionEmail({
          creatorName: creator.displayName,
          creatorEmail: creatorEmail,
          productTitle: product.title,
          productId: product.id,
          rejectionReason: data.reason.trim(),
        });
        
        await sendNotification(notificationData);
        logger.info('Rejection notification sent', { productId, creatorId: product.creatorId });
      } else if (creator) {
        logger.info('Rejection notification skipped due to user preferences', { 
          productId, 
          creatorId: product.creatorId 
        });
      }
    } catch (notificationError) {
      // Log but don't fail the request if notification fails
      logger.error('Failed to send rejection notification', notificationError as Error, {
        productId,
        creatorId: product.creatorId,
      });
    }

    const duration = Date.now() - startTime;
    
    // Log admin action for audit trail
    logger.info('AUDIT: Admin rejected product', { 
      productId,
      adminUserId: event.requestContext.authorizer?.claims?.['sub'],
      action: 'REJECT_PRODUCT',
      reason: data.reason,
    });
    
    logger.info('Product rejected successfully', { productId, reason: data.reason });
    logger.logResponse(200, duration);

    return successResponse(200, {
      product,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error rejecting product', error as Error, {
      productId: event.pathParameters?.id,
    });
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while rejecting the product',
      event.requestContext.requestId
    );
  }
}
