import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { AnalyticsEvent } from './types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const ANALYTICS_EVENTS_TABLE = process.env.ANALYTICS_EVENTS_TABLE || 'AnalyticsEventsTable';

interface EventMetadata {
  userAgent?: string;
  referrer?: string;
  location?: string;
}

/**
 * Track a page view event for a creator's landing page
 * @param creatorId - The ID of the creator whose page was viewed
 * @param metadata - Optional metadata about the page view
 * @returns The ID of the created event
 */
export async function trackPageView(
  creatorId: string,
  metadata: EventMetadata = {}
): Promise<string> {
  const timestamp = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days from now

  const event: AnalyticsEvent = {
    id: uuidv4(),
    creatorId,
    eventType: 'page_view',
    metadata,
    timestamp,
    ttl,
  };

  await docClient.send(
    new PutCommand({
      TableName: ANALYTICS_EVENTS_TABLE,
      Item: event,
    })
  );

  return event.id;
}

/**
 * Track an affiliate click event for a product
 * @param creatorId - The ID of the creator who owns the product
 * @param productId - The ID of the product that was clicked
 * @param metadata - Optional metadata about the click
 * @returns The ID of the created event
 */
export async function trackAffiliateClick(
  creatorId: string,
  productId: string,
  metadata: EventMetadata = {}
): Promise<string> {
  const timestamp = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days from now

  const event: AnalyticsEvent = {
    id: uuidv4(),
    creatorId,
    eventType: 'affiliate_click',
    productId,
    metadata,
    timestamp,
    ttl,
  };

  await docClient.send(
    new PutCommand({
      TableName: ANALYTICS_EVENTS_TABLE,
      Item: event,
    })
  );

  return event.id;
}

/**
 * Get all events for a creator
 * @param creatorId - The ID of the creator
 * @returns Array of analytics events
 */
export async function getEventsByCreator(creatorId: string): Promise<AnalyticsEvent[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: ANALYTICS_EVENTS_TABLE,
      KeyConditionExpression: 'creatorId = :creatorId',
      ExpressionAttributeValues: {
        ':creatorId': creatorId,
      },
    })
  );

  return (result.Items || []) as AnalyticsEvent[];
}
