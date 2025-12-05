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
    // Verify admin role
    if (!isAdmin(event)) {
      logger.warn('Non-admin user attempted to list all creators');
      logger.logResponse(403, Date.now() - startTime);
      return errorResponse(
        403,
        'FORBIDDEN',
        'Admin access required',
        event.requestContext.requestId
      );
    }

    // Scan all creators (for admin view)
    // Note: In production with many creators, this should use pagination
    const command = new ScanCommand({
      TableName: TABLE_NAME,
    });

    const result = await docClient.send(command);
    const creators = (result.Items || []) as Creator[];

    // Sort by createdAt descending (newest first)
    creators.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const duration = Date.now() - startTime;
    logger.info('Retrieved all creators', { count: creators.length });
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
