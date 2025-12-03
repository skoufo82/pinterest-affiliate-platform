/**
 * Manual Price Sync Trigger Lambda Function
 * 
 * Admin endpoint to manually trigger price synchronization with Amazon PA-API.
 * Invokes the syncAmazonPrices Lambda asynchronously and returns execution ID.
 * 
 * Requirements: 3.4
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { successResponse, errorResponse } from '../../shared/responses.js';
import { createLogger } from '../../shared/logger.js';

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
const PRICE_SYNC_LAMBDA_NAME = process.env.PRICE_SYNC_LAMBDA_NAME || 'pinterest-affiliate-syncAmazonPrices';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const logger = createLogger(event.requestContext.requestId);
  
  logger.logRequest(event);
  
  try {
    // Requirement 3.4: Require admin authentication (handled by API Gateway Cognito Authorizer)
    // The authorizer ensures only authenticated admin users can access this endpoint
    
    // Extract user information from the authorizer context
    const userEmail = event.requestContext.authorizer?.claims?.email || 'unknown';
    const username = event.requestContext.authorizer?.claims?.['cognito:username'] || 'unknown';
    
    logger.info('Manual price sync triggered', {
      triggeredBy: username,
      email: userEmail,
    });

    // Generate a unique execution ID for tracking
    const executionId = `manual-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Create event payload for the sync Lambda
    const syncEvent = {
      id: executionId,
      source: 'manual-trigger',
      time: new Date().toISOString(),
      'detail-type': 'Manual Price Sync',
      detail: {
        triggeredBy: username,
        triggeredAt: new Date().toISOString(),
      },
    };

    // Requirement 3.4: Invoke Price Sync Lambda asynchronously
    const invokeCommand = new InvokeCommand({
      FunctionName: PRICE_SYNC_LAMBDA_NAME,
      InvocationType: 'Event', // Asynchronous invocation
      Payload: Buffer.from(JSON.stringify(syncEvent)),
    });

    await lambdaClient.send(invokeCommand);
    
    logger.info('Price sync Lambda invoked successfully', {
      executionId,
      lambdaName: PRICE_SYNC_LAMBDA_NAME,
      triggeredBy: username,
    });

    const duration = Date.now() - startTime;
    logger.logResponse(200, duration);

    // Requirement 3.4: Return execution ID for tracking
    return successResponse(200, {
      message: 'Price sync triggered successfully',
      executionId,
      status: 'running',
      triggeredBy: username,
      triggeredAt: new Date().toISOString(),
      note: 'Check CloudWatch logs for execution details',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error triggering price sync', error as Error);
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'SYNC_TRIGGER_FAILED',
      'Failed to trigger price sync',
      event.requestContext.requestId,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    );
  }
}
