import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';
import { isAdmin } from '../../shared/ownershipValidation';
import { Product } from '../../shared/types';

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
      logger.warn('Non-admin user attempted to access pending products');
      logger.logResponse(403, Date.now() - startTime);
      return errorResponse(
        403,
        'FORBIDDEN',
        'Admin access required',
        event.requestContext.requestId
      );
    }

    // Query products with status 'pending' using status-index GSI
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'status-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'pending',
      },
      ScanIndexForward: false, // Sort by createdAt descending (newest first)
    });

    const result = await docClient.send(command);
    const products = (result.Items || []) as Product[];

    // Transform string booleans back to actual booleans for frontend
    const transformedProducts = products.map(product => ({
      ...product,
      published: product.published === 'true',
      featured: product.featured === 'true',
    }));

    const duration = Date.now() - startTime;
    logger.info('Retrieved pending products', { count: transformedProducts.length });
    logger.logResponse(200, duration);

    return successResponse(200, {
      products: transformedProducts,
      total: transformedProducts.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error retrieving pending products', error as Error);
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while retrieving pending products',
      event.requestContext.requestId
    );
  }
}
