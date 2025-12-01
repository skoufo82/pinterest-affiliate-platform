import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';

// Hardcoded categories matching the actual product categories in DynamoDB
const CATEGORIES = [
  {
    id: 'home-kitchen',
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Beautiful home decor and kitchen essentials',
  },
  {
    id: 'fashion-beauty',
    name: 'Fashion & Beauty',
    slug: 'fashion-beauty',
    description: 'Trendy fashion, beauty and skincare products',
  },
  {
    id: 'tech-electronics',
    name: 'Tech & Electronics',
    slug: 'tech-electronics',
    description: 'Latest tech gadgets and electronics',
  },
  {
    id: 'health-wellness',
    name: 'Health & Wellness',
    slug: 'health-wellness',
    description: 'Fitness, health and wellness products',
  },
  {
    id: 'books-stationery',
    name: 'Books & Stationery',
    slug: 'books-stationery',
    description: 'Books, journals and stationery items',
  },
];

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const logger = createLogger(event.requestContext.requestId);
  
  logger.logRequest(event);
  
  try {
    const duration = Date.now() - startTime;
    logger.logResponse(200, duration);
    logger.info('Categories fetched successfully', {
      categoriesCount: CATEGORIES.length,
    });

    return successResponse(
      200,
      {
        categories: CATEGORIES,
      },
      'public, max-age=3600, s-maxage=3600' // Cache for 1 hour
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching categories', error as Error);
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while fetching categories',
      event.requestContext.requestId
    );
  }
}
