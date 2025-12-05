import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { validateCreatorUpdate } from '../../shared/validation';
import {
  updateCreator as updateCreatorRepo,
  getCreatorByUserId,
  UpdateCreatorInput,
} from '../../shared/creatorRepository';
import { createLogger } from '../../shared/logger';
import { extractUserContext, requireCreator } from '../../shared/authContext';

/**
 * Lambda function to update a creator's profile
 * 
 * Requirements: 2.1
 * - Updates creator profile information
 * - Validates ownership (creator can only update their own profile)
 * - Supports partial updates
 * - Reflects changes on public landing page within 5 seconds
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const logger = createLogger(event.requestContext.requestId);
  
  logger.logRequest(event);
  
  try {
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

    const data = JSON.parse(event.body);

    // Extract user context from JWT token (validated by Cognito authorizer)
    const userContext = extractUserContext(event);
    requireCreator(userContext);

    logger.info('User context extracted', {
      userId: userContext.userId,
      role: userContext.role,
      creatorId: userContext.creatorId,
    });

    // Get creator by userId to verify ownership
    const creator = await getCreatorByUserId(userContext.userId);
    if (!creator) {
      logger.warn('Creator not found for user', { userId: userContext.userId });
      logger.logResponse(404, Date.now() - startTime);
      return errorResponse(
        404,
        'NOT_FOUND',
        'Creator profile not found. Please create a profile first.',
        event.requestContext.requestId
      );
    }

    // Validate update data
    const validation = validateCreatorUpdate(data);
    if (!validation.valid) {
      logger.warn('Creator update validation failed', { errors: validation.errors });
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid creator update data',
        event.requestContext.requestId,
        { errors: validation.errors }
      );
    }

    // Prepare update input
    const input: UpdateCreatorInput = {};
    
    if (data.displayName !== undefined) input.displayName = data.displayName;
    if (data.bio !== undefined) input.bio = data.bio;
    if (data.profileImage !== undefined) input.profileImage = data.profileImage;
    if (data.coverImage !== undefined) input.coverImage = data.coverImage;
    if (data.socialLinks !== undefined) input.socialLinks = data.socialLinks;
    if (data.theme !== undefined) input.theme = data.theme;

    // Update creator
    const updatedCreator = await updateCreatorRepo(creator.id, input);

    const duration = Date.now() - startTime;
    logger.info('Creator updated successfully', {
      creatorId: updatedCreator.id,
      slug: updatedCreator.slug,
      updatedFields: Object.keys(input),
    });
    logger.logResponse(200, duration);

    return successResponse(200, {
      creator: updatedCreator,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error updating creator', error as Error);
    logger.logResponse(500, duration);
    
    const errorMessage = (error as Error).message;
    
    // Handle specific errors
    if (errorMessage.includes('not found')) {
      return errorResponse(
        404,
        'NOT_FOUND',
        errorMessage,
        event.requestContext.requestId
      );
    }
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while updating the creator profile',
      event.requestContext.requestId
    );
  }
}
