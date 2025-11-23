import {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
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

    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const { password, temporary = false } = JSON.parse(event.body);

    if (!password) {
      return errorResponse(400, 'Password is required');
    }

    logger.info('Reset password request', { username, temporary });

    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Password: password,
      Permanent: !temporary,
    });

    await client.send(setPasswordCommand);
    logger.info('Password reset successfully', { username });

    return successResponse({
      message: 'Password reset successfully',
      username,
      temporary,
    });
  } catch (error: any) {
    logger.error('Error resetting password', { error: error.message });
    
    if (error.name === 'UserNotFoundException') {
      return errorResponse(404, 'User not found');
    }
    
    if (error.name === 'InvalidPasswordException') {
      return errorResponse(400, 'Password does not meet requirements');
    }
    
    return errorResponse(500, `Failed to reset password: ${error.message}`);
  }
};
