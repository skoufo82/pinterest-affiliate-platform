import {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
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
    const body = JSON.parse(event.body || '{}');
    const { password, temporary = false } = body;

    if (!username) {
      return errorResponse(400, 'INVALID_REQUEST', 'Username is required', event.requestContext.requestId);
    }

    if (!password) {
      return errorResponse(400, 'INVALID_REQUEST', 'Password is required', event.requestContext.requestId);
    }

    logger.info('Reset password request', { username });

    const command = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Password: password,
      Permanent: !temporary,
    });

    await client.send(command);

    logger.info('Password reset successfully', { username });

    return successResponse(200, {
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    logger.error('Error resetting password', error);
    return errorResponse(500, 'INTERNAL_ERROR', `Failed to reset password: ${error.message}`, event.requestContext.requestId);
  }
};
