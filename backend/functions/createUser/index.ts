import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';
import { generateWelcomeEmail } from '../../shared/emailTemplates';

const client = new CognitoIdentityProviderClient({ region: process.env.REGION });
const sesClient = new SESClient({ region: process.env.REGION });
const USER_POOL_ID = process.env.USER_POOL_ID!;

// Generate a secure temporary password
function generateTemporaryPassword(): string {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  
  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const logger = createLogger(event.requestContext.requestId);
  logger.logRequest(event);

  try {
    if (!event.body) {
      return errorResponse(400, 'INVALID_REQUEST', 'Request body is required', event.requestContext.requestId);
    }

    const { email, username, givenName, familyName, password, sendEmail = false, role = 'Editor' } = JSON.parse(
      event.body
    );

    // Validate required fields
    if (!email || !username) {
      return errorResponse(400, 'INVALID_REQUEST', 'Email and username are required', event.requestContext.requestId);
    }

    logger.info('Creating user', { username, email });

    // Generate a temporary password if not provided
    const temporaryPassword = password || generateTemporaryPassword();

    // Create user - always suppress Cognito's email since we'll send our own
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        ...(givenName ? [{ Name: 'given_name', Value: givenName }] : []),
        ...(familyName ? [{ Name: 'family_name', Value: familyName }] : []),
      ],
      // Always suppress Cognito's default email - we'll send our own custom email
      MessageAction: 'SUPPRESS',
      TemporaryPassword: temporaryPassword,
    });

    await client.send(createUserCommand);
    logger.info('User created successfully', { username });

    // Add user to the specified group (Admins or Editors)
    const groupName = role === 'Admin' ? 'Admins' : 'Editors';
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      GroupName: groupName,
    });

    await client.send(addToGroupCommand);
    logger.info(`User added to ${groupName} group`, { username, role });

    // Send custom welcome email if requested
    if (sendEmail) {
      try {
        const loginUrl = 'https://www.koufobunch.com/login';
        
        const emailTemplate = generateWelcomeEmail({
          username,
          email,
          temporaryPassword,
          loginUrl,
          firstName: givenName,
          lastName: familyName,
        });

        const sendEmailCommand = new SendEmailCommand({
          Source: 'noreply@koufobunch.com',
          Destination: {
            ToAddresses: [email],
          },
          Message: {
            Subject: {
              Data: emailTemplate.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: emailTemplate.html,
                Charset: 'UTF-8',
              },
              Text: {
                Data: emailTemplate.text,
                Charset: 'UTF-8',
              },
            },
          },
        });

        await sesClient.send(sendEmailCommand);
        logger.info('Welcome email sent successfully', { email, username });
      } catch (emailError: any) {
        logger.error('Failed to send welcome email', emailError);
        // Don't fail the user creation if email fails
      }
    }

    return successResponse(200, {
      message: 'User created successfully',
      username,
      email,
      ...(sendEmail ? {} : { temporaryPassword }), // Only return password if email wasn't sent
    });
  } catch (error: any) {
    logger.error('Error creating user', error);
    
    if (error.name === 'UsernameExistsException') {
      return errorResponse(409, 'USER_EXISTS', 'Username already exists', event.requestContext.requestId);
    }
    
    return errorResponse(500, 'INTERNAL_ERROR', `Failed to create user: ${error.message}`, event.requestContext.requestId);
  }
};
