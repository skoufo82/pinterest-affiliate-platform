import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { getCreatorBySlug as getCreatorBySlugRepo } from '../../shared/creatorRepository';
import { createLogger } from '../../shared/logger';

/**
 * Lambda function to get a creator profile by their slug
 * 
 * Requirements: 1.1, 4.1
 * - Public endpoint (no authentication required)
 * - Returns creator profile and theme settings
 * - Used for displaying creator landing pages
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const logger = createLogger(event.requestContext.requestId);
  
  logger.logRequest(event);
  
  try {
    // Get slug from path parameters
    const slug = event.pathParameters?.slug;
    
    if (!slug) {
      logger.warn('Slug parameter is missing');
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Creator slug is required',
        event.requestContext.requestId
      );
    }

    // Get creator from repository
    const creator = await getCreatorBySlugRepo(slug);

    if (!creator) {
      logger.warn('Creator not found', { slug });
      logger.logResponse(404, Date.now() - startTime);
      return errorResponse(
        404,
        'NOT_FOUND',
        'Creator not found. This page may have been removed or the URL is incorrect.',
        event.requestContext.requestId
      );
    }

    // Only return active creators to public
    if (creator.status !== 'active') {
      logger.warn('Creator is disabled', { slug, status: creator.status });
      logger.logResponse(404, Date.now() - startTime);
      return errorResponse(
        404,
        'NOT_FOUND',
        'Creator not found. This page may have been removed or the URL is incorrect.',
        event.requestContext.requestId
      );
    }

    const duration = Date.now() - startTime;
    logger.info('Creator retrieved successfully', {
      creatorId: creator.id,
      slug: creator.slug,
    });
    logger.logResponse(200, duration);

    // Cache for 5 minutes as specified in design
    return successResponse(
      200,
      {
        creator,
        theme: creator.theme,
      },
      'public, max-age=300'
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error retrieving creator', error as Error);
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while retrieving the creator profile',
      event.requestContext.requestId
    );
  }
}
