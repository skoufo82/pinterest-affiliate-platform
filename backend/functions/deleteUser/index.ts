import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';

const client = new CognitoIdentityProviderClient({ region: process.env.REGION });
const USER_POOL_ID = process.env.USER_POOL_ID!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const logger = createLogger(event.requestContext.requestId);
  logger.logRequest(event);

  try {
    const username = event.pathParameters?.username;

    if (!username) {
      return errorResponse(400, 'INVALID_REQUEST', 'Username is required', event.requestContext.requestId);
    }

    logger.info('Delete user request', { username });

    const command = new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    await client.send(command);

    logger.info('User deleted successfully', { username });

    return successResponse(200, {
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting user', error);
    
    if (error.name === 'UserNotFoundException') {
      return errorResponse(404, 'NOT_FOUND', 'User not found', event.requestContext.requestId);
    }
    
    return errorResponse(500, 'INTERNAL_ERROR', `Failed to delete user: ${error.message}`, event.requestContext.requestId);
  }
};
