import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { successResponse, errorResponse } from '../../shared/responses';
import { createLogger } from '../../shared/logger';
import { isAdmin } from '../../shared/ownershipValidation';
import { Creator } from '../../shared/types';

const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.CREATORS_TABLE_NAME || 'CreatorsTable';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const logger = createLogger(event.requestContext.requestId);
  
  logger.logRequest(event);
  
  try {
    const isAdminUser = isAdmin(event);
    
    // Parse query parameters
    const limit = event.queryStringParameters?.limit 
      ? parseInt(event.queryStringParameters.limit, 10) 
      : undefined;
    const search = event.queryStringParameters?.search;

    // Scan all creators
    // Note: In production with many creators, this should use pagination
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      Limit: limit,
    });

    const result = await docClient.send(command);
    let creators = (result.Items || []) as Creator[];

    // Filter to only active creators for non-admin users
    if (!isAdminUser) {
      creators = creators.filter(creator => creator.status === 'active');
    }

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      creators = creators.filter(creator => 
        creator.displayName.toLowerCase().includes(searchLower) ||
        creator.slug.toLowerCase().includes(searchLower) ||
        (creator.bio && creator.bio.toLowerCase().includes(searchLower))
      );
    }

    // Sort by createdAt descending (newest first)
    creators.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const duration = Date.now() - startTime;
    logger.info('Retrieved creators', { 
      count: creators.length, 
      isAdmin: isAdminUser,
      hasSearch: !!search 
    });
    logger.logResponse(200, duration);

    return successResponse(200, {
      creators,
      total: creators.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error retrieving creators', error as Error);
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while retrieving creators',
      event.requestContext.requestId
    );
  }
}
