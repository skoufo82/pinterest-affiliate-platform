import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
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
    // Scan the entire table to get all products (published and unpublished)
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
    });

    const result = await docClient.send(scanCommand);
    const rawProducts = (result.Items || []) as any[];
    
    // Transform string booleans to actual booleans
    const products = rawProducts.map(p => ({
      ...p,
      published: p.published === 'true',
      featured: p.featured === 'true',
    }));
    
    // Sort by createdAt descending
    products.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const duration = Date.now() - startTime;
    logger.logResponse(200, duration);
    logger.info('Admin products fetched successfully', {
      productsCount: products.length,
    });

    return successResponse(200, {
      products,
      total: products.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching admin products', error as Error);
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while fetching products',
      event.requestContext.requestId
    );
  }
}
