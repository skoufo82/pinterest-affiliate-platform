import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { validateCreator } from '../../shared/validation';
import { createCreator as createCreatorRepo, CreateCreatorInput } from '../../shared/creatorRepository';
import { createLogger } from '../../shared/logger';

/**
 * Lambda function to create a new creator profile
 * 
 * Requirements: 1.1, 2.1
 * - Creates a unique creator profile with authentication credentials
 * - Generates a unique creator slug based on username
 * - Validates slug uniqueness
 * - Enforces URL-safe character restrictions
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

    // Extract userId from JWT token (set by authorizer)
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      logger.warn('User ID not found in token');
      logger.logResponse(401, Date.now() - startTime);
      return errorResponse(
        401,
        'UNAUTHORIZED',
        'User authentication required',
        event.requestContext.requestId
      );
    }

    // Validate username is provided
    if (!data.username || typeof data.username !== 'string') {
      logger.warn('Username is missing or invalid');
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'Username is required and must be a string',
        event.requestContext.requestId
      );
    }

    // Validate creator profile data
    const validation = validateCreator(data);
    if (!validation.valid) {
      logger.warn('Creator validation failed', { errors: validation.errors });
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid creator data',
        event.requestContext.requestId,
        { errors: validation.errors }
      );
    }

    // Prepare input for repository
    const input: CreateCreatorInput = {
      userId,
      username: data.username,
      displayName: data.displayName,
      bio: data.bio,
      profileImage: data.profileImage,
      coverImage: data.coverImage,
      socialLinks: data.socialLinks,
      theme: data.theme,
    };

    // Create creator
    const creator = await createCreatorRepo(input);

    const duration = Date.now() - startTime;
    logger.info('Creator created successfully', {
      creatorId: creator.id,
      slug: creator.slug,
      userId: creator.userId,
    });
    logger.logResponse(201, duration);

    return successResponse(201, {
      creator,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error creating creator', error as Error);
    logger.logResponse(500, duration);
    
    const errorMessage = (error as Error).message;
    
    // Handle specific errors
    if (errorMessage.includes('already taken')) {
      return errorResponse(
        409,
        'CONFLICT',
        errorMessage,
        event.requestContext.requestId
      );
    }
    
    if (errorMessage.includes('invalid')) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        errorMessage,
        event.requestContext.requestId
      );
    }
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while creating the creator profile',
      event.requestContext.requestId
    );
  }
}
