/**
 * SNS Notification Utilities
 * 
 * Provides functions to send critical error notifications via SNS.
 * Used for alerting administrators about price sync failures.
 * 
 * Requirements: 5.4, 8.4
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { createLogger } from './logger.js';

const logger = createLogger(undefined, { service: 'SNS-Notifications' });

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ALERT_TOPIC_ARN = process.env.PRICE_SYNC_ALERT_TOPIC_ARN;

export interface AlertContext {
  executionId?: string;
  errorType: string;
  errorMessage: string;
  errorCode?: string;
  affectedProducts?: number;
  additionalDetails?: Record<string, unknown>;
}

/**
 * Sends a critical error alert via SNS
 * 
 * @param subject - Alert subject line
 * @param context - Alert context with error details
 * @returns Promise<boolean> - True if notification sent successfully
 */
export async function sendCriticalAlert(
  subject: string,
  context: AlertContext
): Promise<boolean> {
  if (!ALERT_TOPIC_ARN) {
    logger.warn('SNS alert topic ARN not configured, skipping notification', {
      subject,
      errorType: context.errorType,
    });
    return false;
  }

  try {
    const message = formatAlertMessage(context);

    const command = new PublishCommand({
      TopicArn: ALERT_TOPIC_ARN,
      Subject: `[Price Sync Alert] ${subject}`,
      Message: message,
      MessageAttributes: {
        ErrorType: {
          DataType: 'String',
          StringValue: context.errorType,
        },
        Severity: {
          DataType: 'String',
          StringValue: 'CRITICAL',
        },
      },
    });

    await snsClient.send(command);

    logger.info('Critical alert sent successfully', {
      subject,
      errorType: context.errorType,
      topicArn: ALERT_TOPIC_ARN,
    });

    return true;
  } catch (error) {
    // Don't fail the entire sync if notification fails
    logger.error('Failed to send SNS notification', error as Error, {
      subject,
      errorType: context.errorType,
      topicArn: ALERT_TOPIC_ARN,
    });
    return false;
  }
}

/**
 * Formats alert context into a human-readable message
 */
function formatAlertMessage(context: AlertContext): string {
  const lines: string[] = [
    'Amazon Price Sync Critical Alert',
    '================================',
    '',
    `Error Type: ${context.errorType}`,
    `Error Message: ${context.errorMessage}`,
  ];

  if (context.errorCode) {
    lines.push(`Error Code: ${context.errorCode}`);
  }

  if (context.executionId) {
    lines.push(`Execution ID: ${context.executionId}`);
  }

  if (context.affectedProducts !== undefined) {
    lines.push(`Affected Products: ${context.affectedProducts}`);
  }

  if (context.additionalDetails) {
    lines.push('', 'Additional Details:', '-------------------');
    for (const [key, value] of Object.entries(context.additionalDetails)) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }

  lines.push(
    '',
    'Action Required:',
    '----------------',
    'Please investigate this issue in the CloudWatch logs and take appropriate action.',
    '',
    `Timestamp: ${new Date().toISOString()}`,
    `Region: ${process.env.AWS_REGION || 'us-east-1'}`,
  );

  return lines.join('\n');
}

/**
 * Sends an authentication error alert
 * Requirement 5.4: Send alert notification when authentication fails
 */
export async function sendAuthenticationErrorAlert(
  executionId: string,
  errorMessage: string
): Promise<boolean> {
  return sendCriticalAlert('PA-API Authentication Failed', {
    executionId,
    errorType: 'AUTHENTICATION_ERROR',
    errorMessage,
    errorCode: '401',
    additionalDetails: {
      action: 'Verify PA-API credentials in Parameter Store',
      parameters: [
        '/amazon-affiliate/pa-api/access-key',
        '/amazon-affiliate/pa-api/secret-key',
        '/amazon-affiliate/pa-api/partner-tag',
      ],
    },
  });
}

/**
 * Sends a high failure rate alert
 * Requirement 8.4: Alert on critical errors
 */
export async function sendHighFailureRateAlert(
  executionId: string,
  totalProducts: number,
  failureCount: number,
  failureRate: number
): Promise<boolean> {
  return sendCriticalAlert('High Price Sync Failure Rate', {
    executionId,
    errorType: 'HIGH_FAILURE_RATE',
    errorMessage: `${failureRate.toFixed(1)}% of products failed to sync`,
    affectedProducts: failureCount,
    additionalDetails: {
      totalProducts,
      failureCount,
      failureRate: `${failureRate.toFixed(1)}%`,
      action: 'Review CloudWatch logs for specific error patterns',
    },
  });
}

/**
 * Sends a parameter store access error alert
 * Requirement 5.4: Alert on critical configuration errors
 */
export async function sendParameterStoreErrorAlert(
  executionId: string,
  errorMessage: string
): Promise<boolean> {
  return sendCriticalAlert('Parameter Store Access Failed', {
    executionId,
    errorType: 'PARAMETER_STORE_ERROR',
    errorMessage,
    additionalDetails: {
      action: 'Verify Lambda IAM role has ssm:GetParameter permissions',
      requiredPermissions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
      ],
      parameterPrefix: '/amazon-affiliate/pa-api/',
    },
  });
}

/**
 * Sends a sync execution failure alert
 * Requirement 5.4: Alert on complete sync failures
 */
export async function sendSyncExecutionFailureAlert(
  executionId: string,
  errorMessage: string,
  partialResults?: {
    totalProducts: number;
    successCount: number;
    failureCount: number;
  }
): Promise<boolean> {
  return sendCriticalAlert('Price Sync Execution Failed', {
    executionId,
    errorType: 'SYNC_EXECUTION_FAILURE',
    errorMessage,
    affectedProducts: partialResults?.totalProducts,
    additionalDetails: {
      partialResults: partialResults || 'No partial results available',
      action: 'Review CloudWatch logs for detailed error information',
    },
  });
}
