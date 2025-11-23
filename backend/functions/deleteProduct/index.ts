import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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

    // Delete from DynamoDB
    const deleteCommand = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        id: productId,
      },
    });

    await docClient.send(deleteCommand);

    const duration = Date.now() - startTime;
    logger.info('Product deleted successfully', { productId });
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
