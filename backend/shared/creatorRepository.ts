// Creator repository for DynamoDB operations

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Creator } from './types';
import { generateSlug, isValidSlug } from './slugUtils';

const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.CREATORS_TABLE_NAME || 'CreatorsTable';

export interface CreateCreatorInput {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  profileImage: string;
  coverImage: string;
  socialLinks?: {
    instagram?: string;
    pinterest?: string;
    tiktok?: string;
  };
  theme?: {
    primaryColor: string;
    accentColor: string;
    font: string;
  };
  notificationPreferences?: {
    productApproval: boolean;
    productRejection: boolean;
    accountStatusChange: boolean;
    milestones: boolean;
  };
}

export interface UpdateCreatorInput {
  displayName?: string;
  bio?: string;
  profileImage?: string;
  coverImage?: string;
  socialLinks?: {
    instagram?: string;
    pinterest?: string;
    tiktok?: string;
  };
  theme?: {
    primaryColor: string;
    accentColor: string;
    font: string;
  };
  notificationPreferences?: {
    productApproval: boolean;
    productRejection: boolean;
    accountStatusChange: boolean;
    milestones: boolean;
  };
  status?: 'active' | 'disabled';
}

/**
 * Creates a new creator in DynamoDB
 * Generates a unique slug from the username
 * Validates slug uniqueness before creation
 */
export async function createCreator(input: CreateCreatorInput): Promise<Creator> {
  const slug = generateSlug(input.username);
  
  if (!isValidSlug(slug)) {
    throw new Error('Generated slug is invalid. Username must contain at least one alphanumeric character.');
  }

  // Check if slug already exists
  const existingCreator = await getCreatorBySlug(slug);
  if (existingCreator) {
    throw new Error('Username is already taken. Please choose a different username.');
  }

  const now = new Date().toISOString();
  const creator: Creator = {
    id: uuidv4(),
    userId: input.userId,
    slug,
    displayName: input.displayName,
    bio: input.bio,
    profileImage: input.profileImage,
    coverImage: input.coverImage,
    socialLinks: input.socialLinks || {},
    theme: input.theme || {
      primaryColor: '#3B82F6',
      accentColor: '#10B981',
      font: 'Inter',
    },
    notificationPreferences: input.notificationPreferences || {
      productApproval: true,
      productRejection: true,
      accountStatusChange: true,
      milestones: true,
    },
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: creator,
    ConditionExpression: 'attribute_not_exists(id)',
  });

  await docClient.send(command);
  return creator;
}

/**
 * Gets a creator by their unique slug
 */
export async function getCreatorBySlug(slug: string): Promise<Creator | null> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'slug-index',
    KeyConditionExpression: 'slug = :slug',
    ExpressionAttributeValues: {
      ':slug': slug,
    },
  });

  const result = await docClient.send(command);
  
  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return result.Items[0] as Creator;
}

/**
 * Gets a creator by their ID
 */
export async function getCreatorById(id: string): Promise<Creator | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { id },
  });

  const result = await docClient.send(command);
  
  if (!result.Item) {
    return null;
  }

  return result.Item as Creator;
}

/**
 * Gets a creator by their userId (Cognito user ID)
 */
export async function getCreatorByUserId(userId: string): Promise<Creator | null> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  });

  const result = await docClient.send(command);
  
  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return result.Items[0] as Creator;
}

/**
 * Updates a creator's profile
 * Only updates fields that are provided in the input
 */
export async function updateCreator(id: string, input: UpdateCreatorInput): Promise<Creator> {
  const now = new Date().toISOString();
  
  // Build update expression dynamically based on provided fields
  const updateExpressions: string[] = ['updatedAt = :updatedAt'];
  const expressionAttributeValues: Record<string, unknown> = {
    ':updatedAt': now,
  };
  const expressionAttributeNames: Record<string, string> = {};

  if (input.displayName !== undefined) {
    updateExpressions.push('displayName = :displayName');
    expressionAttributeValues[':displayName'] = input.displayName;
  }

  if (input.bio !== undefined) {
    updateExpressions.push('bio = :bio');
    expressionAttributeValues[':bio'] = input.bio;
  }

  if (input.profileImage !== undefined) {
    updateExpressions.push('profileImage = :profileImage');
    expressionAttributeValues[':profileImage'] = input.profileImage;
  }

  if (input.coverImage !== undefined) {
    updateExpressions.push('coverImage = :coverImage');
    expressionAttributeValues[':coverImage'] = input.coverImage;
  }

  if (input.socialLinks !== undefined) {
    updateExpressions.push('socialLinks = :socialLinks');
    expressionAttributeValues[':socialLinks'] = input.socialLinks;
  }

  if (input.theme !== undefined) {
    updateExpressions.push('theme = :theme');
    expressionAttributeValues[':theme'] = input.theme;
  }

  if (input.notificationPreferences !== undefined) {
    updateExpressions.push('notificationPreferences = :notificationPreferences');
    expressionAttributeValues[':notificationPreferences'] = input.notificationPreferences;
  }

  if (input.status !== undefined) {
    // 'status' is a reserved word in DynamoDB, so we need to use an attribute name placeholder
    updateExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = input.status;
  }

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ...(Object.keys(expressionAttributeNames).length > 0 && {
      ExpressionAttributeNames: expressionAttributeNames,
    }),
    ConditionExpression: 'attribute_exists(id)',
    ReturnValues: 'ALL_NEW',
  });

  const result = await docClient.send(command);
  
  if (!result.Attributes) {
    throw new Error('Creator not found');
  }

  return result.Attributes as Creator;
}

/**
 * Deletes a creator by ID
 */
export async function deleteCreator(id: string): Promise<void> {
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id },
    ConditionExpression: 'attribute_exists(id)',
  });

  await docClient.send(command);
}

/**
 * Validates that a slug is unique
 * Returns true if the slug is available, false if it's taken
 */
export async function validateSlugUniqueness(slug: string): Promise<boolean> {
  const creator = await getCreatorBySlug(slug);
  return creator === null;
}
