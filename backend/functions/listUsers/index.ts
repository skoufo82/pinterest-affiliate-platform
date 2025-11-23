import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
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
    logger.info('List users request');

    const listUsersCommand = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60,
    });

    const response = await client.send(listUsersCommand);

    // Get groups for each user
    const usersWithGroups = await Promise.all(
      (response.Users || []).map(async (user) => {
        const groupsCommand = new AdminListGroupsForUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: user.Username!,
        });

        const groupsResponse = await client.send(groupsCommand);
        const groups = groupsResponse.Groups?.map((g) => g.GroupName) || [];

        return {
          username: user.Username,
          email: user.Attributes?.find((attr) => attr.Name === 'email')?.Value,
          givenName: user.Attributes?.find((attr) => attr.Name === 'given_name')?.Value,
          familyName: user.Attributes?.find((attr) => attr.Name === 'family_name')?.Value,
          enabled: user.Enabled,
          status: user.UserStatus,
          created: user.UserCreateDate,
          modified: user.UserLastModifiedDate,
          groups,
        };
      })
    );

    logger.info('Users listed successfully', { count: usersWithGroups.length });

    return successResponse({
      users: usersWithGroups,
      count: usersWithGroups.length,
    });
  } catch (error: any) {
    logger.error('Error listing users', { error: error.message });
    return errorResponse(500, `Failed to list users: ${error.message}`);
  }
};
