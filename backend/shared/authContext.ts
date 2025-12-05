import { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * User context extracted from JWT token
 */
export interface UserContext {
  userId: string;
  username: string;
  role: 'admin' | 'creator' | 'viewer';
  email: string;
  creatorId?: string;
  groups: string[];
}

/**
 * Extract user context from API Gateway event
 * The Cognito User Pools Authorizer automatically validates the JWT
 * and adds claims to the requestContext.authorizer.claims
 * 
 * Requirements: 1.5, 3.3, 3.4, 3.5
 */
export function extractUserContext(event: APIGatewayProxyEvent): UserContext {
  const claims = event.requestContext.authorizer?.claims;

  if (!claims) {
    throw new Error('No authorization claims found');
  }

  const userId = claims.sub;
  const username = claims['cognito:username'];
  const email = claims.email || '';
  const groupsString = claims['cognito:groups'] || '';
  const groups = groupsString ? groupsString.split(',') : [];
  const creatorId = claims['custom:creatorId'];

  // Determine role from Cognito groups
  let role: 'admin' | 'creator' | 'viewer' = 'viewer';
  if (groups.includes('admin')) {
    role = 'admin';
  } else if (groups.includes('creator')) {
    role = 'creator';
  }

  return {
    userId,
    username,
    role,
    email,
    creatorId,
    groups,
  };
}

/**
 * Verify that the user has admin role
 */
export function requireAdmin(context: UserContext): void {
  if (context.role !== 'admin') {
    throw new Error('Admin role required');
  }
}

/**
 * Verify that the user has creator role
 */
export function requireCreator(context: UserContext): void {
  if (context.role !== 'creator' && context.role !== 'admin') {
    throw new Error('Creator role required');
  }
}

/**
 * Verify that the user is the owner of the resource or an admin
 */
export function requireOwnershipOrAdmin(
  context: UserContext,
  resourceCreatorId: string
): void {
  if (context.role === 'admin') {
    return; // Admins can access any resource
  }

  if (context.role !== 'creator') {
    throw new Error('Creator role required');
  }

  if (context.creatorId !== resourceCreatorId) {
    throw new Error('You do not have permission to access this resource');
  }
}

/**
 * Get the creator ID for the current user
 * Throws error if user is not a creator
 */
export function getCreatorId(context: UserContext): string {
  if (!context.creatorId) {
    throw new Error('User is not associated with a creator account');
  }
  return context.creatorId;
}
