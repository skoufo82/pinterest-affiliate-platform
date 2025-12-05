import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';
import { createLogger } from '../../shared/logger';
import { AnalyticsEvent, AnalyticsSummary } from '../../shared/types';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { getCreatorById } from '../../shared/creatorRepository';
import { sendNotification, generateMilestoneEmail, shouldSendNotification } from '../../shared/notificationService';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const ANALYTICS_SUMMARIES_TABLE = process.env.ANALYTICS_SUMMARIES_TABLE || 'AnalyticsSummariesTable';

/**
 * Process DynamoDB Stream events from AnalyticsEvents table
 * Aggregate daily metrics into AnalyticsSummaries table
 */
export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  const logger = createLogger();

  logger.info('Processing analytics stream events', { recordCount: event.Records.length });

  // Group events by creator and date
  const eventsByCreatorDate = new Map<string, AnalyticsEvent[]>();

  for (const record of event.Records) {
    try {
      // Only process INSERT events
      if (record.eventName !== 'INSERT') {
        continue;
      }

      // Extract the analytics event from the stream record
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) {
        logger.warn('No NewImage in stream record', { eventId: record.eventID });
        continue;
      }

      // Unmarshal the DynamoDB record to a plain object
      const event = unmarshall(newImage as Record<string, AttributeValue>) as AnalyticsEvent;

      // Extract date from timestamp (YYYY-MM-DD)
      const date = event.timestamp.split('T')[0];
      const key = `${event.creatorId}:${date}`;

      // Group events by creator and date
      const events = eventsByCreatorDate.get(key) || [];
      events.push(event);
      eventsByCreatorDate.set(key, events);

      logger.debug('Processed analytics event', {
        eventId: event.id,
        creatorId: event.creatorId,
        eventType: event.eventType,
        date,
      });
    } catch (error) {
      logger.error('Error processing stream record', error as Error, {
        eventId: record.eventID,
      });
    }
  }

  // Update summaries for each creator-date combination
  for (const [key, events] of eventsByCreatorDate.entries()) {
    const [creatorId, date] = key.split(':');

    try {
      await updateDailySummary(creatorId, date, events, logger);
    } catch (error) {
      logger.error('Error updating daily summary', error as Error, {
        creatorId,
        date,
      });
    }
  }

  logger.info('Completed processing analytics stream events');
};

/**
 * Update the daily summary for a creator
 */
async function updateDailySummary(
  creatorId: string,
  date: string,
  events: AnalyticsEvent[],
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  // Calculate metrics from events
  const pageViews = events.filter(e => e.eventType === 'page_view').length;
  const productViews = events.filter(e => e.eventType === 'product_view').length;
  const affiliateClicks = events.filter(e => e.eventType === 'affiliate_click').length;

  // Calculate top products
  const productMetrics = new Map<string, { views: number; clicks: number }>();
  
  for (const event of events) {
    if (event.productId) {
      const metrics = productMetrics.get(event.productId) || { views: 0, clicks: 0 };
      
      if (event.eventType === 'product_view') {
        metrics.views++;
      } else if (event.eventType === 'affiliate_click') {
        metrics.clicks++;
      }
      
      productMetrics.set(event.productId, metrics);
    }
  }

  // Convert to array and sort by total engagement (views + clicks)
  const topProducts = Array.from(productMetrics.entries())
    .map(([productId, metrics]) => ({
      productId,
      views: metrics.views,
      clicks: metrics.clicks,
    }))
    .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks))
    .slice(0, 10); // Keep top 10 products

  // Try to get existing summary
  const existingResult = await docClient.send(
    new GetCommand({
      TableName: ANALYTICS_SUMMARIES_TABLE,
      Key: {
        creatorId,
        date,
      },
    })
  );

  const existingSummary = existingResult.Item as AnalyticsSummary | undefined;

  if (existingSummary) {
    // Update existing summary by adding new metrics
    const updatedPageViews = existingSummary.pageViews + pageViews;
    const updatedProductViews = existingSummary.productViews + productViews;
    const updatedAffiliateClicks = existingSummary.affiliateClicks + affiliateClicks;

    // Merge top products
    const mergedProductMetrics = new Map<string, { views: number; clicks: number }>();
    
    // Add existing products
    for (const product of existingSummary.topProducts) {
      mergedProductMetrics.set(product.productId, {
        views: product.views,
        clicks: product.clicks,
      });
    }
    
    // Add new products
    for (const product of topProducts) {
      const existing = mergedProductMetrics.get(product.productId) || { views: 0, clicks: 0 };
      mergedProductMetrics.set(product.productId, {
        views: existing.views + product.views,
        clicks: existing.clicks + product.clicks,
      });
    }

    // Convert back to array and sort
    const updatedTopProducts = Array.from(mergedProductMetrics.entries())
      .map(([productId, metrics]) => ({
        productId,
        views: metrics.views,
        clicks: metrics.clicks,
      }))
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks))
      .slice(0, 10);

    await docClient.send(
      new UpdateCommand({
        TableName: ANALYTICS_SUMMARIES_TABLE,
        Key: {
          creatorId,
          date,
        },
        UpdateExpression: 'SET pageViews = :pageViews, productViews = :productViews, affiliateClicks = :affiliateClicks, topProducts = :topProducts',
        ExpressionAttributeValues: {
          ':pageViews': updatedPageViews,
          ':productViews': updatedProductViews,
          ':affiliateClicks': updatedAffiliateClicks,
          ':topProducts': updatedTopProducts,
        },
      })
    );

    logger.info('Updated existing daily summary', {
      creatorId,
      date,
      pageViews: updatedPageViews,
      productViews: updatedProductViews,
      affiliateClicks: updatedAffiliateClicks,
    });

    // Check for milestone achievements
    await checkMilestones(creatorId, updatedPageViews, updatedAffiliateClicks, logger);
  } else {
    // Create new summary
    const summary: AnalyticsSummary = {
      creatorId,
      date,
      pageViews,
      productViews,
      affiliateClicks,
      topProducts,
    };

    await docClient.send(
      new PutCommand({
        TableName: ANALYTICS_SUMMARIES_TABLE,
        Item: summary,
      })
    );

    logger.info('Created new daily summary', {
      creatorId,
      date,
      pageViews,
      productViews,
      affiliateClicks,
    });

    // Check for milestone achievements
    await checkMilestones(creatorId, pageViews, affiliateClicks, logger);
  }
}

/**
 * Check if creator has reached any milestones and send notifications
 */
async function checkMilestones(
  creatorId: string,
  totalPageViews: number,
  totalClicks: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  // Define milestone thresholds
  const pageViewMilestones = [100, 500, 1000, 5000, 10000, 50000, 100000];
  const clickMilestones = [10, 50, 100, 500, 1000, 5000, 10000];

  try {
    // Check page view milestones
    for (const milestone of pageViewMilestones) {
      if (totalPageViews >= milestone && totalPageViews - milestone < 100) {
        // Just crossed this milestone (within last 100 views)
        await sendMilestoneNotification(creatorId, 'page_views', milestone, totalPageViews, logger);
      }
    }

    // Check click milestones
    for (const milestone of clickMilestones) {
      if (totalClicks >= milestone && totalClicks - milestone < 10) {
        // Just crossed this milestone (within last 10 clicks)
        await sendMilestoneNotification(creatorId, 'clicks', milestone, totalClicks, logger);
      }
    }
  } catch (error) {
    logger.error('Error checking milestones', error as Error, { creatorId });
  }
}

/**
 * Send milestone notification to creator
 */
async function sendMilestoneNotification(
  creatorId: string,
  milestoneType: 'page_views' | 'clicks' | 'products',
  milestoneValue: number,
  currentValue: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const creator = await getCreatorById(creatorId);
    if (!creator) {
      logger.warn('Creator not found for milestone notification', { creatorId });
      return;
    }

    if (!shouldSendNotification(creator, 'milestones')) {
      logger.info('Milestone notification skipped due to user preferences', { 
        creatorId, 
        milestoneType,
        milestoneValue 
      });
      return;
    }

    // Get creator's email from userId (Cognito)
    const creatorEmail = creator.userId; // This should be the email or we need to fetch from Cognito

    const notificationData = generateMilestoneEmail({
      creatorName: creator.displayName,
      creatorEmail: creatorEmail,
      milestoneType,
      milestoneValue,
      currentValue,
    });

    await sendNotification(notificationData);
    logger.info('Milestone notification sent', {
      creatorId,
      milestoneType,
      milestoneValue,
      currentValue,
    });
  } catch (error) {
    logger.error('Failed to send milestone notification', error as Error, {
      creatorId,
      milestoneType,
      milestoneValue,
    });
  }
}
