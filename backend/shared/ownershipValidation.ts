import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Product } from './types';

const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'ProductsTable';

/**
 * Extract creatorId from JWT token in the Authorization header
 * In a real implementation, this would decode and validate the JWT token
 * For now, we'll extract it from the authorizer context
 */
export function extractCreatorIdFromToken(event: APIGatewayProxyEvent): string | null {
  // Check if authorizer context exists (set by API Gateway authorizer)
  if (event.requestContext.authorizer?.claims) {
    // Extract creatorId from Cognito custom attribute
    const creatorId = event.requestContext.authorizer.claims['custom:creatorId'];
    return creatorId || null;
  }
  
  // Fallback: check for creatorId in authorizer context
  if (event.requestContext.authorizer?.creatorId) {
    return event.requestContext.authorizer.creatorId;
  }
  
  return null;
}

/**
 * Extract userId from JWT token in the Authorization header
 */
export function extractUserIdFromToken(event: APIGatewayProxyEvent): string | null {
  // Check if authorizer context exists
  if (event.requestContext.authorizer?.claims) {
    // Extract sub (user ID) from Cognito token
    const userId = event.requestContext.authorizer.claims['sub'];
    return userId || null;
  }
  
  return null;
}

/**
 * Check if the user has admin role
 */
export function isAdmin(event: APIGatewayProxyEvent): boolean {
  // Check if authorizer context exists
  if (event.requestContext.authorizer?.claims) {
    // Check Cognito groups for admin role
    const groups = event.requestContext.authorizer.claims['cognito:groups'];
    if (groups) {
      const groupArray = typeof groups === 'string' ? [groups] : groups;
      return groupArray.includes('admin');
    }
  }
  
  return false;
}

/**
 * Verify that the requesting user owns the specified product
 * Returns the product if ownership is verified, throws error otherwise
 */
export async function verifyProductOwnership(
  productId: string,
  creatorId: string
): Promise<Product> {
  // Get the product from DynamoDB
  const getCommand = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      id: productId,
    },
  });

  const result = await docClient.send(getCommand);

  if (!result.Item) {
    throw new Error('PRODUCT_NOT_FOUND');
  }

  const product = result.Item as Product;

  // Verify ownership
  if (product.creatorId !== creatorId) {
    throw new Error('OWNERSHIP_VERIFICATION_FAILED');
  }

  return product;
}

/**
 * Verify product ownership or admin override
 * Admins can access any product regardless of ownership
 */
export async function verifyProductOwnershipOrAdmin(
  event: APIGatewayProxyEvent,
  productId: string
): Promise<{ product: Product; isAdmin: boolean }> {
  // Check if user is admin
  const adminRole = isAdmin(event);
  
  if (adminRole) {
    // Admin can access any product
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        id: productId,
      },
    });

    const result = await docClient.send(getCommand);

    if (!result.Item) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    return { product: result.Item as Product, isAdmin: true };
  }

  // Non-admin: verify ownership
  const creatorId = extractCreatorIdFromToken(event);
  
  if (!creatorId) {
    throw new Error('CREATOR_ID_NOT_FOUND');
  }

  const product = await verifyProductOwnership(productId, creatorId);
  
  return { product, isAdmin: false };
}
