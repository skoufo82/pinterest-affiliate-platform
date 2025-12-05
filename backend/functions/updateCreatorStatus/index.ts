import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';
import { isAdmin } from '../../shared/ownershipValidation';
import { updateCreator, getCreatorById } from '../../shared/creatorRepository';
import { sendNotification, generateAccountStatusChangeEmail, shouldSendNotification } from '../../shared/notificationService';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const logger = createLogger(event.requestContext.requestId);
  
  logger.logRequest(event);
  
  try {
    // Verify admin role
    if (!isAdmin(event)) {
      logger.warn('Non-admin user attempted to update creator status');
      logger.logResponse(403, Date.now() - startTime);
      return errorResponse(
        403,
        'FORBIDDEN',
        'Admin access required',
        event.requestContext.requestId
      );
    }

    const creatorId = event.pathParameters?.id;

    if (!creatorId) {
      logger.warn('Creator ID is missing');
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Creator ID is required',
        event.requestContext.requestId
      );
    }

    if (!event.body) {
      logger.warn('Request body is missing');
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Request body with status is required',
        event.requestContext.requestId
      );
    }

    const data = JSON.parse(event.body);

    if (!data.status || !['active', 'disabled'].includes(data.status)) {
      logger.warn('Invalid status value', { status: data.status });
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Status must be either "active" or "disabled"',
        event.requestContext.requestId
      );
    }

    // First, verify the creator exists
    const existingCreator = await getCreatorById(creatorId);

    if (!existingCreator) {
      logger.warn('Creator not found', { creatorId });
      logger.logResponse(404, Date.now() - startTime);
      return errorResponse(
        404,
        'NOT_FOUND',
        'Creator not found',
        event.requestContext.requestId
      );
    }

    // Update creator status
    const updatedCreator = await updateCreator(creatorId, {
      status: data.status,
    });

    // Send status change notification to creator
    try {
      if (shouldSendNotification(updatedCreator, 'accountStatusChange')) {
        // Get creator's email from userId (Cognito)
        const creatorEmail = updatedCreator.userId; // This should be the email or we need to fetch from Cognito
        
        const notificationData = generateAccountStatusChangeEmail({
          creatorName: updatedCreator.displayName,
          creatorEmail: creatorEmail,
          newStatus: data.status,
          reason: data.reason, // Optional reason from request body
        });
        
        await sendNotification(notificationData);
        logger.info('Status change notification sent', { creatorId, newStatus: data.status });
      } else {
        logger.info('Status change notification skipped due to user preferences', { 
          creatorId, 
          newStatus: data.status 
        });
      }
    } catch (notificationError) {
      // Log but don't fail the request if notification fails
      logger.error('Failed to send status change notification', notificationError as Error, {
        creatorId,
        newStatus: data.status,
      });
    }

    const duration = Date.now() - startTime;
    
    // Log admin action for audit trail
    logger.info('AUDIT: Admin updated creator status', { 
      creatorId,
      adminUserId: event.requestContext.authorizer?.claims?.['sub'],
      action: 'UPDATE_CREATOR_STATUS',
      newStatus: data.status,
      previousStatus: existingCreator.status,
    });
    
    logger.info('Creator status updated successfully', { 
      creatorId, 
      status: data.status,
      previousStatus: existingCreator.status,
    });
    logger.logResponse(200, duration);

    return successResponse(200, {
      creator: updatedCreator,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error updating creator status', error as Error, {
      creatorId: event.pathParameters?.id,
    });
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while updating creator status',
      event.requestContext.requestId
    );
  }
}
