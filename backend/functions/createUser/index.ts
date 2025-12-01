import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
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
    if (!event.body) {
      return errorResponse(400, 'INVALID_REQUEST', 'Request body is required', event.requestContext.requestId);
    }

    const { email, username, givenName, familyName, password, sendEmail = false } = JSON.parse(
      event.body
    );

    // Validate required fields
    if (!email || !username) {
      return errorResponse(400, 'INVALID_REQUEST', 'Email and username are required', event.requestContext.requestId);
    }

    logger.info('Creating user', { username, email });

    // Create user
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        ...(givenName ? [{ Name: 'given_name', Value: givenName }] : []),
        ...(familyName ? [{ Name: 'family_name', Value: familyName }] : []),
      ],
      MessageAction: sendEmail ? 'RESEND' : 'SUPPRESS',
      DesiredDeliveryMediums: sendEmail ? ['EMAIL'] : undefined,
    });

    await client.send(createUserCommand);
    logger.info('User created successfully', { username });

    // Set permanent password if provided
    if (password) {
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        Password: password,
        Permanent: true,
      });
      await client.send(setPasswordCommand);
      logger.info('Password set for user', { username });
    }

    // Add user to Admins group
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      GroupName: 'Admins',
    });

    await client.send(addToGroupCommand);
    logger.info('User added to Admins group', { username });

    return successResponse(200, {
      message: 'User created successfully',
      username,
      email,
    });
  } catch (error: any) {
    logger.error('Error creating user', error);
    
    if (error.name === 'UsernameExistsException') {
      return errorResponse(409, 'USER_EXISTS', 'Username already exists', event.requestContext.requestId);
    }
    
    return errorResponse(500, 'INTERNAL_ERROR', `Failed to create user: ${error.message}`, event.requestContext.requestId);
  }
};
