import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';
import { verifyProductOwnershipOrAdmin } from '../../shared/ownershipValidation';

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

    // Verify ownership or admin access
    let isAdminAction = false;
    try {
      const { isAdmin } = await verifyProductOwnershipOrAdmin(event, productId);
      isAdminAction = isAdmin;
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      if (errorMessage === 'PRODUCT_NOT_FOUND') {
        logger.warn('Product not found', { productId });
        logger.logResponse(404, Date.now() - startTime);
        return errorResponse(
          404,
          'NOT_FOUND',
          'Product not found',
          event.requestContext.requestId
        );
      }
      
      if (errorMessage === 'OWNERSHIP_VERIFICATION_FAILED') {
        logger.warn('Ownership verification failed', { productId });
        logger.logResponse(403, Date.now() - startTime);
        return errorResponse(
          403,
          'FORBIDDEN',
          'You do not have permission to delete this product',
          event.requestContext.requestId
        );
      }
      
      if (errorMessage === 'CREATOR_ID_NOT_FOUND') {
        logger.warn('Creator ID not found in token');
        logger.logResponse(401, Date.now() - startTime);
        return errorResponse(
          401,
          'UNAUTHORIZED',
          'Creator authentication required',
          event.requestContext.requestId
        );
      }
      
      throw error;
    }

    // Delete from DynamoDB
    const deleteCommand = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        id: productId,
      },
    });

    await docClient.send(deleteCommand);

    const duration = Date.now() - startTime;
    
    // Log admin action for audit trail
    if (isAdminAction) {
      logger.info('AUDIT: Admin deleted product', { 
        productId,
        adminUserId: event.requestContext.authorizer?.claims?.['sub'],
        action: 'DELETE_PRODUCT',
      });
    }
    
    logger.info('Product deleted successfully', { productId, isAdminAction });
    logger.logResponse(200, duration);

    return successResponse(200, {
      success: true,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error deleting product', error as Error, {
      productId: event.pathParameters?.id,
    });
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while deleting the product',
      event.requestContext.requestId
    );
  }
}
