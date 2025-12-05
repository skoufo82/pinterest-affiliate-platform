import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
  PolicyDocument,
  Statement,
} from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;

// Create JWT verifier for Cognito tokens
const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'access',
  clientId: CLIENT_ID,
});

interface CognitoPayload {
  sub: string;
  'cognito:groups'?: string[];
  'cognito:username': string;
  email?: string;
  'custom:creatorId'?: string;
}

/**
 * Custom Lambda Authorizer for API Gateway
 * Validates JWT tokens from Cognito and extracts user context
 * Requirements: 1.5, 3.3, 3.4, 3.5
 */
export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer invoked', { methodArn: event.methodArn });

  try {
    // Extract token from Authorization header
    const token = event.authorizationToken;
    if (!token) {
      throw new Error('No authorization token provided');
    }

    // Remove 'Bearer ' prefix if present
    const jwtToken = token.replace(/^Bearer\s+/i, '');

    // Verify JWT token with Cognito
    const verifiedPayload = await verifier.verify(jwtToken);
    const payload = verifiedPayload as unknown as CognitoPayload;
    console.log('Token verified successfully', {
      sub: payload.sub,
      username: payload['cognito:username'],
      groups: payload['cognito:groups'],
    });

    // Extract user information
    const userId = payload.sub;
    const username = payload['cognito:username'];
    const groups = payload['cognito:groups'] || [];
    const email = payload.email;
    const creatorId = payload['custom:creatorId'];

    // Determine user role (admin, creator, or viewer)
    let role = 'viewer';
    if (groups.includes('admin')) {
      role = 'admin';
    } else if (groups.includes('creator')) {
      role = 'creator';
    }

    // Generate IAM policy
    const policy = generatePolicy(userId, 'Allow', event.methodArn, {
      userId,
      username,
      role,
      email: email || '',
      creatorId: creatorId || '',
      groups: groups.join(','),
    });

    console.log('Authorization successful', { userId, role });
    return policy;
  } catch (error) {
    console.error('Authorization failed', error);
    // Return explicit deny policy
    throw new Error('Unauthorized');
  }
};

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, string>
): APIGatewayAuthorizerResult {
  const policyDocument: PolicyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      } as Statement,
    ],
  };

  return {
    principalId,
    policyDocument,
    context,
  };
}
