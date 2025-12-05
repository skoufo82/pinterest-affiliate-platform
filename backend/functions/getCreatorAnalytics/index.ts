import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '../../shared/logger';
import { successResponse, errorResponse } from '../../shared/responses';
import { AnalyticsSummary } from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const ANALYTICS_SUMMARIES_TABLE = process.env.ANALYTICS_SUMMARIES_TABLE || 'AnalyticsSummariesTable';

interface AnalyticsResponse {
  creatorId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalPageViews: number;
  totalProductViews: number;
  totalAffiliateClicks: number;
  clickThroughRate: number; // Percentage of page views that resulted in clicks
  topProducts: Array<{
    productId: string;
    views: number;
    clicks: number;
    clickThroughRate: number;
  }>;
  dailyMetrics: Array<{
    date: string;
    pageViews: number;
    productViews: number;
    affiliateClicks: number;
  }>;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;
  const logger = createLogger(requestId);

  logger.logRequest(event);

  try {
    // Extract creatorId from path parameters
    const creatorId = event.pathParameters?.creatorId;
    if (!creatorId) {
      logger.warn('Missing creatorId in path parameters');
      return errorResponse(400, 'VALIDATION_ERROR', 'creatorId is required', requestId);
    }

    // Extract date range from query parameters
    const queryParams = event.queryStringParameters || {};
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      logger.warn('Invalid startDate format', { startDate });
      return errorResponse(400, 'VALIDATION_ERROR', 'startDate must be in YYYY-MM-DD format', requestId);
    }
    if (endDate && !dateRegex.test(endDate)) {
      logger.warn('Invalid endDate format', { endDate });
      return errorResponse(400, 'VALIDATION_ERROR', 'endDate must be in YYYY-MM-DD format', requestId);
    }

    // Default to last 30 days if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    logger.info('Fetching analytics', { creatorId, startDate: start, endDate: end });

    // Query summaries for the date range
    const result = await docClient.send(
      new QueryCommand({
        TableName: ANALYTICS_SUMMARIES_TABLE,
        KeyConditionExpression: 'creatorId = :creatorId AND #date BETWEEN :startDate AND :endDate',
        ExpressionAttributeNames: {
          '#date': 'date',
        },
        ExpressionAttributeValues: {
          ':creatorId': creatorId,
          ':startDate': start,
          ':endDate': end,
        },
      })
    );

    const summaries = (result.Items || []) as AnalyticsSummary[];

    // Aggregate metrics across all days
    let totalPageViews = 0;
    let totalProductViews = 0;
    let totalAffiliateClicks = 0;
    const productMetrics = new Map<string, { views: number; clicks: number }>();

    for (const summary of summaries) {
      totalPageViews += summary.pageViews;
      totalProductViews += summary.productViews;
      totalAffiliateClicks += summary.affiliateClicks;

      // Aggregate product metrics
      for (const product of summary.topProducts) {
        const existing = productMetrics.get(product.productId) || { views: 0, clicks: 0 };
        productMetrics.set(product.productId, {
          views: existing.views + product.views,
          clicks: existing.clicks + product.clicks,
        });
      }
    }

    // Calculate overall click-through rate
    const clickThroughRate = totalPageViews > 0 
      ? (totalAffiliateClicks / totalPageViews) * 100 
      : 0;

    // Calculate top products with CTR
    const topProducts = Array.from(productMetrics.entries())
      .map(([productId, metrics]) => ({
        productId,
        views: metrics.views,
        clicks: metrics.clicks,
        clickThroughRate: metrics.views > 0 ? (metrics.clicks / metrics.views) * 100 : 0,
      }))
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks))
      .slice(0, 10);

    // Prepare daily metrics
    const dailyMetrics = summaries.map(summary => ({
      date: summary.date,
      pageViews: summary.pageViews,
      productViews: summary.productViews,
      affiliateClicks: summary.affiliateClicks,
    }));

    const response: AnalyticsResponse = {
      creatorId,
      dateRange: {
        startDate: start,
        endDate: end,
      },
      totalPageViews,
      totalProductViews,
      totalAffiliateClicks,
      clickThroughRate: Math.round(clickThroughRate * 100) / 100, // Round to 2 decimal places
      topProducts: topProducts.map(p => ({
        ...p,
        clickThroughRate: Math.round(p.clickThroughRate * 100) / 100,
      })),
      dailyMetrics,
    };

    logger.info('Analytics fetched successfully', {
      creatorId,
      totalPageViews,
      totalAffiliateClicks,
      daysCount: summaries.length,
    });

    return successResponse(200, response, 'public, max-age=300'); // Cache for 5 minutes
  } catch (error) {
    logger.error('Error fetching analytics', error as Error);
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch analytics', requestId);
  }
};
