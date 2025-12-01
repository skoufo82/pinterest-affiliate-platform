import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';

const sesClient = new SESClient({ region: process.env.REGION || 'us-east-1' });
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@koufobunch.com';
const SITE_URL = process.env.SITE_URL || 'https://www.koufobunch.com';

interface InviteEmailData {
  email: string;
  username: string;
  temporaryPassword: string;
  givenName?: string;
}

const generateEmailHTML = (data: InviteEmailData): string => {
  const { username, temporaryPassword, givenName } = data;
  const loginUrl = `${SITE_URL}/login?username=${encodeURIComponent(username)}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Koufo Bunch Admin</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(to right, #ec4899, #9333ea); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Welcome to Koufo Bunch!
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                Hi${givenName ? ` ${givenName}` : ''},
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151; line-height: 1.6;">
                You've been invited to join the Koufo Bunch admin portal! Click the button below to get started.
              </p>
              
              <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
                <strong>Your username:</strong> ${username}
              </p>
              
              <p style="margin: 0 0 30px; font-size: 14px; color: #6b7280;">
                <strong>Your temporary password:</strong> <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${temporaryPassword}</code>
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background-color: #ec4899;">
                    <a href="${loginUrl}" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">
                      Access Admin Portal
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                When you log in for the first time, you'll be prompted to create a new password. Make sure to choose something secure!
              </p>
              
              <p style="margin: 20px 0 0; font-size: 14px; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${loginUrl}" style="color: #ec4899; word-break: break-all;">${loginUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                This is an automated message from Koufo Bunch. Please do not reply to this email.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} Koufo Bunch. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

const generateEmailText = (data: InviteEmailData): string => {
  const { username, temporaryPassword, givenName } = data;
  const loginUrl = `${SITE_URL}/login?username=${encodeURIComponent(username)}`;
  
  return `
Welcome to Koufo Bunch!

Hi${givenName ? ` ${givenName}` : ''},

You've been invited to join the Koufo Bunch admin portal!

Your username: ${username}
Your temporary password: ${temporaryPassword}

Access the admin portal here:
${loginUrl}

When you log in for the first time, you'll be prompted to create a new password. Make sure to choose something secure!

---
This is an automated message from Koufo Bunch. Please do not reply to this email.
© ${new Date().getFullYear()} Koufo Bunch. All rights reserved.
  `.trim();
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const logger = createLogger(event.requestContext.requestId);
  
  logger.logRequest(event);
  
  try {
    if (!event.body) {
      return errorResponse(400, 'INVALID_REQUEST', 'Request body is required', event.requestContext.requestId);
    }

    const data: InviteEmailData = JSON.parse(event.body);

    if (!data.email || !data.username || !data.temporaryPassword) {
      return errorResponse(400, 'INVALID_REQUEST', 'Email, username, and temporary password are required', event.requestContext.requestId);
    }

    logger.info('Sending invite email', { email: data.email, username: data.username });

    const emailParams = {
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [data.email],
      },
      Message: {
        Subject: {
          Data: 'Welcome to Koufo Bunch Admin Portal',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: generateEmailHTML(data),
            Charset: 'UTF-8',
          },
          Text: {
            Data: generateEmailText(data),
            Charset: 'UTF-8',
          },
        },
      },
    };

    const command = new SendEmailCommand(emailParams);
    const result = await sesClient.send(command);

    const duration = Date.now() - startTime;
    logger.info('Invite email sent successfully', {
      messageId: result.MessageId,
      email: data.email,
    });
    logger.logResponse(200, duration);

    return successResponse(200, {
      message: 'Invite email sent successfully',
      messageId: result.MessageId,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Error sending invite email', error);
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      `Failed to send invite email: ${error.message}`,
      event.requestContext.requestId
    );
  }
}
