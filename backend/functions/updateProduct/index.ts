import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';

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

    if (!event.body) {
      logger.warn('Request body is missing');
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Request body is required',
        event.requestContext.requestId
      );
    }

    // Check if product exists
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

    const data = JSON.parse(event.body);

    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    const allowedFields = [
      'title',
      'description',
      'category',
      'imageUrl',
      'amazonLink',
      'price',
      'tags',
      'published',
      'featured',
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        // Convert published/featured boolean to string for GSI compatibility
        const value = data[field];
        if (field === 'published' || field === 'featured') {
          // Log for debugging
          logger.info(`Processing ${field}`, { value, type: typeof value });
          expressionAttributeValues[`:${field}`] = 
            typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
        } else {
          expressionAttributeValues[`:${field}`] = value;
        }
      }
    });

    // Always update updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    if (updateExpressions.length === 1) {
      // Only updatedAt would be updated, no actual changes
      logger.warn('No valid fields to update', { productId });
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'No valid fields to update',
        event.requestContext.requestId
      );
    }

    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        id: productId,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
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

    const duration = Date.now() - startTime;
    logger.info('Product updated successfully', {
      productId,
      updatedFields: Object.keys(data),
    });
    logger.logResponse(200, duration);

    return successResponse(200, {
      product,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error updating product', error as Error, {
      productId: event.pathParameters?.id,
    });
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while updating the product',
      event.requestContext.requestId
    );
  }
}
