/**
 * Get Sync History Lambda Function
 * 
 * Retrieves price sync execution history from CloudWatch Logs.
 * Provides filtering by date range and status.
 * 
 * Requirements: 6.4
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  CloudWatchLogsClient, 
  FilterLogEventsCommand,
  FilteredLogEvent 
} from '@aws-sdk/client-cloudwatch-logs';
import { createLogger } from '../../shared/logger.js';
import { successResponse, errorResponse } from '../../shared/responses.js';

const logger = createLogger(undefined, { service: 'GetSyncHistory' });
const cloudWatchLogsClient = new CloudWatchLogsClient({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});

const LOG_GROUP_NAME = '/aws/lambda/syncAmazonPrices';

interface SyncExecution {
  executionId: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalProducts: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  status: 'success' | 'partial' | 'failed';
  errors?: Array<{
    productId: string;
    asin: string;
    errorMessage: string;
    errorCode: string;
  }>;
}

/**
 * Parse log events to extract sync execution data
 */
function parseSyncExecutions(logEvents: FilteredLogEvent[]): SyncExecution[] {
  const executionsMap = new Map<string, SyncExecution>();

  for (const event of logEvents) {
    if (!event.message) continue;

    try {
      const logEntry = JSON.parse(event.message);
      
      // Look for execution started logs
      if (logEntry.message === 'Price sync execution started') {
        const executionId = logEntry.context?.executionId;
        if (executionId) {
          executionsMap.set(executionId, {
            executionId,
            startTime: logEntry.context?.startTime || logEntry.timestamp,
            endTime: logEntry.context?.startTime || logEntry.timestamp,
            duration: 0,
            totalProducts: 0,
            successCount: 0,
            failureCount: 0,
            skippedCount: 0,
            status: 'success',
          });
        }
      }
      
      // Look for execution completed logs
      else if (logEntry.message === 'Price sync execution completed') {
        const executionId = logEntry.context?.executionId;
        if (executionId) {
          const execution = executionsMap.get(executionId) || {
            executionId,
            startTime: logEntry.timestamp,
            endTime: logEntry.timestamp,
            duration: 0,
            totalProducts: 0,
            successCount: 0,
            failureCount: 0,
            skippedCount: 0,
            status: 'success' as const,
          };
          
          execution.endTime = logEntry.context?.endTime || logEntry.timestamp;
          execution.duration = logEntry.context?.durationMs || 0;
          execution.totalProducts = logEntry.context?.totalProducts || 0;
          execution.successCount = logEntry.context?.successCount || 0;
          execution.failureCount = logEntry.context?.failureCount || 0;
          execution.skippedCount = logEntry.context?.skippedCount || 0;
          
          // Determine status
          const processedCount = execution.totalProducts - execution.skippedCount;
          if (execution.failureCount === 0) {
            execution.status = 'success';
          } else if (execution.successCount > 0 && execution.failureCount < processedCount) {
            execution.status = 'partial';
          } else {
            execution.status = 'failed';
          }
          
          executionsMap.set(executionId, execution);
        }
      }
      
      // Look for execution failed logs
      else if (logEntry.message === 'Price sync execution failed') {
        const executionId = logEntry.context?.executionId;
        if (executionId) {
          const execution = executionsMap.get(executionId) || {
            executionId,
            startTime: logEntry.timestamp,
            endTime: logEntry.timestamp,
            duration: 0,
            totalProducts: 0,
            successCount: 0,
            failureCount: 0,
            skippedCount: 0,
            status: 'failed' as const,
          };
          
          execution.endTime = logEntry.context?.endTime || logEntry.timestamp;
          execution.duration = logEntry.context?.durationMs || 0;
          execution.totalProducts = logEntry.context?.partialResults?.totalProducts || 0;
          execution.successCount = logEntry.context?.partialResults?.successCount || 0;
          execution.failureCount = logEntry.context?.partialResults?.failureCount || 0;
          execution.skippedCount = logEntry.context?.partialResults?.skippedCount || 0;
          execution.status = 'failed';
          
          executionsMap.set(executionId, execution);
        }
      }
      
      // Look for error logs with details
      else if (logEntry.message === 'Price sync completed with errors' && logEntry.context?.errors) {
        const executionId = logEntry.context?.executionId;
        if (executionId) {
          const execution = executionsMap.get(executionId);
          if (execution) {
            execution.errors = logEntry.context.errors;
            executionsMap.set(executionId, execution);
          }
        }
      }
    } catch (error) {
      // Skip malformed log entries
      logger.debug('Failed to parse log entry', { 
        message: event.message?.substring(0, 100) 
      });
    }
  }

  // Convert map to array and sort by start time
  return Array.from(executionsMap.values())
    .filter(exec => exec.executionId && exec.startTime)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}

/**
 * Main handler function
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  logger.logRequest(event);
  const startTime = Date.now();

  try {
    // Parse query parameters
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;
    const status = event.queryStringParameters?.status as 'success' | 'partial' | 'failed' | undefined;
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

    // Calculate time range (default: last 30 days)
    const endTimestamp = endDate 
      ? new Date(endDate).getTime() 
      : Date.now();
    const startTimestamp = startDate 
      ? new Date(startDate).getTime() 
      : endTimestamp - (30 * 24 * 60 * 60 * 1000); // 30 days ago

    logger.info('Fetching sync history', {
      startDate: new Date(startTimestamp).toISOString(),
      endDate: new Date(endTimestamp).toISOString(),
      status,
      limit,
    });

    // Query CloudWatch Logs
    const command = new FilterLogEventsCommand({
      logGroupName: LOG_GROUP_NAME,
      startTime: startTimestamp,
      endTime: endTimestamp,
      filterPattern: '{ $.message = "Price sync execution started" || $.message = "Price sync execution completed" || $.message = "Price sync execution failed" || $.message = "Price sync completed with errors" }',
      limit: 1000, // Fetch more logs to ensure we get complete execution data
    });

    const response = await cloudWatchLogsClient.send(command);
    
    logger.info('CloudWatch Logs query completed', {
      eventsFound: response.events?.length || 0,
    });

    // Parse log events into sync executions
    let executions = parseSyncExecutions(response.events || []);

    // Filter by status if specified
    if (status) {
      executions = executions.filter(exec => exec.status === status);
    }

    // Apply limit
    executions = executions.slice(0, limit);

    logger.info('Sync history retrieved', {
      executionsFound: executions.length,
      statusFilter: status,
    });

    const duration = Date.now() - startTime;
    logger.logResponse(200, duration);

    return successResponse(200, {
      executions,
      count: executions.length,
      filters: {
        startDate: new Date(startTimestamp).toISOString(),
        endDate: new Date(endTimestamp).toISOString(),
        status,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch sync history', error as Error, {
      requestId,
    });

    const duration = Date.now() - startTime;
    logger.logResponse(500, duration);

    return errorResponse(
      500,
      'SYNC_HISTORY_ERROR',
      'Failed to fetch sync history',
      requestId,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
