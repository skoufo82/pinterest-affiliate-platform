import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { logger } from '../../shared/logger';

const client = new CognitoIdentityProviderClient({ region: process.env.REGION });
const USER_POOL_ID = process.env.USER_POOL_ID!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const username = event.pathParameters?.username;

    if (!username) {
      return errorResponse(400, 'Username is required');
    }

    logger.info('Delete user request', { username });

    const deleteUserCommand = new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    await client.send(deleteUserCommand);
    logger.info('User deleted successfully', { username });

    return successResponse({
      message: 'User deleted successfully',
      username,
    });
  } catch (error: any) {
    logger.error('Error deleting user', { error: error.message });
    
    if (error.name === 'UserNotFoundException') {
      return errorResponse(404, 'User not found');
    }
    
    return errorResponse(500, `Failed to delete user: ${error.message}`);
  }
};
