import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/responses';
import { Product } from '../../shared/types';
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
    const category = event.queryStringParameters?.category;
    const creatorId = event.queryStringParameters?.creatorId;
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

    let products: Product[] = [];
    let total = 0;

    if (creatorId) {
      // Query by creatorId using GSI
      const queryCommand = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'creatorId-index',
        KeyConditionExpression: 'creatorId = :creatorId',
        ExpressionAttributeValues: {
          ':creatorId': creatorId,
        },
        ScanIndexForward: false, // Sort by createdAt descending
      });

      const result = await docClient.send(queryCommand);
      let allProducts = (result.Items || []) as any[];
      
      // Filter by category if specified
      if (category) {
        allProducts = allProducts.filter(p => p.category === category);
      }
      
      // Transform string booleans to actual booleans
      const transformedProducts = allProducts.map(p => ({
        ...p,
        published: p.published === 'true',
        featured: p.featured === 'true',
      }));
      
      total = transformedProducts.length;
      
      // Apply pagination
      products = transformedProducts.slice(offset, offset + limit);
    } else if (category) {
      // Query by category using GSI
      const queryCommand = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'category-createdAt-index',
        KeyConditionExpression: 'category = :category',
        ExpressionAttributeValues: {
          ':category': category,
        },
        ScanIndexForward: false, // Sort by createdAt descending
      });

      const result = await docClient.send(queryCommand);
      const allProducts = (result.Items || []) as any[];
      
      // Transform and filter for published products only
      const publishedProducts = allProducts
        .map(p => ({
          ...p,
          published: p.published === 'true',
          featured: p.featured === 'true',
        }))
        .filter(p => p.published);
      total = publishedProducts.length;
      
      // Apply pagination
      products = publishedProducts.slice(offset, offset + limit);
    } else {
      // Query all published products using GSI
      const queryCommand = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'published-createdAt-index',
        KeyConditionExpression: 'published = :published',
        ExpressionAttributeValues: {
          ':published': 'true', // DynamoDB stores boolean as string in GSI
        },
        ScanIndexForward: false, // Sort by createdAt descending
      });

      const result = await docClient.send(queryCommand);
      const allProducts = (result.Items || []) as any[];
      
      // Transform string booleans to actual booleans
      const publishedProducts = allProducts.map(p => ({
        ...p,
        published: p.published === 'true',
        featured: p.featured === 'true',
      }));
      total = publishedProducts.length;
      
      // Apply pagination
      products = publishedProducts.slice(offset, offset + limit);
    }

    const hasMore = offset + limit < total;

    const duration = Date.now() - startTime;
    logger.logResponse(200, duration);
    logger.info('Products fetched successfully', {
      category,
      productsCount: products.length,
      total,
      hasMore,
    });

    return successResponse(
      200,
      {
        products,
        total,
        hasMore,
      },
      'public, max-age=300, s-maxage=300' // Cache for 5 minutes
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching products', error as Error, {
      category: event.queryStringParameters?.category,
    });
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while fetching products',
      event.requestContext.requestId
    );
  }
}
