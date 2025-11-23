import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
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
    logger.info('Create user request', { body: event.body });

    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const { email, username, givenName, familyName, password, sendEmail = false } = JSON.parse(
      event.body
    );

    // Validate required fields
    if (!email || !username) {
      return errorResponse(400, 'Email and username are required');
    }

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

    return successResponse({
      message: 'User created successfully',
      username,
      email,
    });
  } catch (error: any) {
    logger.error('Error creating user', { error: error.message });
    
    if (error.name === 'UsernameExistsException') {
      return errorResponse(409, 'Username already exists');
    }
    
    return errorResponse(500, `Failed to create user: ${error.message}`);
  }
};
