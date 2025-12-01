import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';

// Hardcoded categories matching the frontend
const CATEGORIES = [
  {
    id: 'home-decor',
    name: 'Home & Kitchen',
    slug: 'home-decor',
    description: 'Beautiful home decor and kitchen essentials',
  },
  {
    id: 'fashion',
    name: 'Fashion',
    slug: 'fashion',
    description: 'Trendy fashion and accessories',
  },
  {
    id: 'beauty',
    name: 'Beauty',
    slug: 'beauty',
    description: 'Beauty and skincare products',
  },
  {
    id: 'tech',
    name: 'Tech',
    slug: 'tech',
    description: 'Latest tech gadgets and accessories',
  },
  {
    id: 'fitness',
    name: 'Fitness',
    slug: 'fitness',
    description: 'Fitness and wellness products',
  },
  {
    id: 'outdoor',
    name: 'Outdoor',
    slug: 'outdoor',
    description: 'Outdoor and adventure gear',
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
