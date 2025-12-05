import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../shared/logger';
import { successResponse, errorResponse } from '../../shared/responses';
import { AnalyticsEvent } from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const ANALYTICS_EVENTS_TABLE = process.env.ANALYTICS_EVENTS_TABLE || 'AnalyticsEventsTable';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;
  const logger = createLogger(requestId);

  logger.logRequest(event);

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { creatorId, metadata } = body;

    // Validate required fields
    if (!creatorId) {
      logger.warn('Missing required field: creatorId');
      return errorResponse(400, 'VALIDATION_ERROR', 'creatorId is required', requestId);
    }

    // Create analytics event
    const timestamp = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days from now

    const analyticsEvent: AnalyticsEvent = {
      id: uuidv4(),
      creatorId,
      eventType: 'page_view',
      metadata: {
        userAgent: metadata?.userAgent || event.headers?.['User-Agent'] || event.headers?.['user-agent'],
        referrer: metadata?.referrer || event.headers?.['Referer'] || event.headers?.['referer'],
        location: metadata?.location,
      },
      timestamp,
      ttl,
    };

    // Store event in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: ANALYTICS_EVENTS_TABLE,
        Item: analyticsEvent,
      })
    );

    logger.info('Page view tracked successfully', { creatorId, eventId: analyticsEvent.id });

    return successResponse(201, {
      success: true,
      eventId: analyticsEvent.id,
    });
  } catch (error) {
    logger.error('Error tracking page view', error as Error);
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to track page view', requestId);
  }
};
