# Price Sync CloudWatch Monitoring

This document describes the CloudWatch monitoring setup for the Amazon Price Sync feature.

## Overview

The Price Sync Lambda function now publishes custom metrics to CloudWatch and has a dedicated dashboard with alarms for monitoring sync operations.

## Custom Metrics Published

The sync function publishes the following metrics to the `PriceSync` namespace:

| Metric Name | Unit | Description |
|------------|------|-------------|
| `SuccessCount` | Count | Number of products successfully updated |
| `FailureCount` | Count | Number of products that failed to update |
| `Duration` | Milliseconds | Execution time of the sync operation |
| `TotalProducts` | Count | Total number of products in the database |
| `SkippedCount` | Count | Number of products without ASINs (skipped) |
| `ProcessedCount` | Count | Number of products with ASINs (processed) |
| `SuccessRate` | Percent | Percentage of successful updates |
| `FailureRate` | Percent | Percentage of failed updates |

## CloudWatch Dashboard

A CloudWatch dashboard named `PinterestAffiliate-PriceSync` has been created with the following widgets:

### 1. Success vs Failure
- Line graph showing successful and failed updates over time
- Green line for successes, red line for failures

### 2. Success Rate
- Line graph showing the success rate percentage
- Y-axis ranges from 0-100%

### 3. Execution Duration
- Line graph showing average and maximum execution duration
- Helps identify performance issues

### 4. Products Processed
- Line graph showing total products, processed products, and skipped products
- Helps understand the sync workload

## CloudWatch Alarms

Three alarms have been configured to monitor critical conditions:

### 1. High Failure Rate Alarm
- **Name:** `PriceSync-HighFailureRate`
- **Condition:** Failure rate exceeds 50%
- **Action:** Sends notification to SNS topic
- **Purpose:** Alerts when more than half of price updates are failing

### 2. Authentication Error Alarm
- **Name:** `PriceSync-AuthenticationError`
- **Condition:** Any authentication errors detected in logs
- **Action:** Sends notification to SNS topic
- **Purpose:** Immediately alerts on PA-API credential issues
- **Monitored Terms:** 401, Unauthorized, InvalidSignature, SignatureDoesNotMatch

### 3. Long Execution Alarm
- **Name:** `PriceSync-LongExecution`
- **Condition:** Execution duration exceeds 5 minutes (300,000 ms)
- **Action:** Sends notification to SNS topic
- **Purpose:** Alerts on performance degradation or timeout risks

## SNS Topic

All alarms send notifications to the SNS topic:
- **Topic Name:** `pinterest-affiliate-price-sync-alerts`
- **Display Name:** Amazon Price Sync Alerts

To receive alerts, subscribe to this topic via:
- Email
- SMS
- Lambda function
- SQS queue
- HTTP/HTTPS endpoint

## Accessing the Dashboard

After deployment, the dashboard URL will be available in the CloudFormation outputs:
```
PriceSyncDashboardUrl
```

Or navigate manually:
1. Open AWS Console
2. Go to CloudWatch service
3. Click "Dashboards" in the left menu
4. Select "PinterestAffiliate-PriceSync"

## Viewing Metrics

To view metrics programmatically or create custom queries:

```bash
# Get success count for the last hour
aws cloudwatch get-metric-statistics \
  --namespace PriceSync \
  --metric-name SuccessCount \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# Get failure rate for the last 24 hours
aws cloudwatch get-metric-statistics \
  --namespace PriceSync \
  --metric-name FailureRate \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

## Troubleshooting

### No Metrics Appearing

If metrics don't appear in CloudWatch:
1. Verify the Lambda function has executed at least once
2. Check Lambda execution logs for metric publishing errors
3. Verify IAM permissions include `cloudwatch:PutMetricData`

### Alarms Not Triggering

If alarms don't trigger when expected:
1. Check alarm state in CloudWatch console
2. Verify SNS topic has active subscriptions
3. Check alarm threshold and evaluation period settings
4. Review CloudWatch Logs for authentication error patterns

### High Failure Rates

If the high failure rate alarm triggers:
1. Check CloudWatch Logs for error details
2. Verify PA-API credentials are valid
3. Check for rate limiting issues
4. Verify product ASINs are valid
5. Check Amazon PA-API service status

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 8.3:** Publish custom metrics (SuccessCount, FailureCount, Duration) to CloudWatch
- **Requirement 8.4:** Create CloudWatch dashboard for price sync monitoring
- **Requirement 8.4:** Set up alarms for high failure rates
- **Requirement 8.4:** Set up alarms for authentication errors

## Next Steps

After deployment:
1. Subscribe to the SNS alert topic to receive notifications
2. Monitor the dashboard after the first scheduled sync
3. Adjust alarm thresholds if needed based on actual performance
4. Consider adding additional metrics or alarms based on operational needs
