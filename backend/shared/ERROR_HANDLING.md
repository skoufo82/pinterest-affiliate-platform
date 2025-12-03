# Error Handling and Notifications

This document describes the comprehensive error handling and notification system implemented for the Amazon Price Sync feature.

## Overview

The price sync system implements robust error handling to ensure:
- Individual product failures don't stop the entire sync
- Critical errors trigger immediate alerts
- All errors are logged with detailed context
- Appropriate retry strategies for different error types

## Error Types and Handling

### 1. Authentication Errors (401)

**Behavior:** Abort sync and alert administrators

**Implementation:**
- Custom error type: `PAAPIAuthenticationError`
- Non-retryable (stops immediately)
- Sends SNS alert via `sendAuthenticationErrorAlert()`
- Marks all remaining products as failed
- Logs detailed error information

**Example:**
```typescript
if (error instanceof PAAPIAuthenticationError) {
  await sendAuthenticationErrorAlert(executionId, errorMessage);
  throw error; // Abort sync
}
```

**Alert includes:**
- Execution ID
- Error message
- Required Parameter Store parameters
- Action items for resolution

### 2. Rate Limit Errors (429)

**Behavior:** Backoff and retry

**Implementation:**
- Custom error type: `PAAPIRateLimitError`
- Retryable with exponential backoff
- Respects `Retry-After` header if provided
- Logs rate limit occurrences
- Continues processing after backoff

**Example:**
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  throw new PAAPIRateLimitError(errorMsg, retryAfterSeconds);
}
```

**Retry strategy:**
- Initial delay: 1 second
- Exponential backoff: 2x multiplier
- Max attempts: 3
- Jitter: ±10% to prevent thundering herd

### 3. Product Not Found (404)

**Behavior:** Log and continue

**Implementation:**
- Custom error type: `PAAPIProductNotFoundError`
- Non-retryable (no point retrying)
- Marks product as failed with specific error message
- Continues processing other products
- Logs warning with ASIN

**Example:**
```typescript
const missingASINs = batch.filter(asin => !returnedASINs.has(asin));
for (const asin of missingASINs) {
  await markPriceSyncFailed(product.id, 'Product not found on Amazon');
}
```

### 4. Network Errors

**Behavior:** Retry with backoff

**Implementation:**
- Detected by error message patterns
- Retryable with exponential backoff
- Max attempts: 3
- Logs each retry attempt
- Preserves existing price on failure

**Detected patterns:**
- `network`
- `timeout`
- `ECONNRESET`
- `ECONNREFUSED`
- `ETIMEDOUT`
- `socket hang up`
- `ENOTFOUND`

### 5. Parameter Store Errors

**Behavior:** Abort and alert

**Implementation:**
- Detected during credential retrieval
- Sends SNS alert via `sendParameterStoreErrorAlert()`
- Aborts sync execution
- Logs detailed IAM permission requirements

**Alert includes:**
- Required IAM permissions
- Parameter Store prefix
- Action items for resolution

## SNS Notifications

### Alert Types

1. **Authentication Error Alert**
   - Triggered by: 401 errors from PA-API
   - Subject: `[Price Sync Alert] PA-API Authentication Failed`
   - Includes: Credential verification steps

2. **High Failure Rate Alert**
   - Triggered by: >50% failure rate
   - Subject: `[Price Sync Alert] High Price Sync Failure Rate`
   - Includes: Failure statistics and percentages

3. **Parameter Store Error Alert**
   - Triggered by: SSM access failures
   - Subject: `[Price Sync Alert] Parameter Store Access Failed`
   - Includes: Required IAM permissions

4. **Sync Execution Failure Alert**
   - Triggered by: Complete sync failures
   - Subject: `[Price Sync Alert] Price Sync Execution Failed`
   - Includes: Partial results if available

### Alert Format

All alerts include:
- Error type and message
- Execution ID for tracking
- Timestamp and region
- Affected product count
- Action items for resolution
- Additional context details

### Configuration

SNS topic ARN must be set via environment variable:
```
PRICE_SYNC_ALERT_TOPIC_ARN=arn:aws:sns:region:account:topic-name
```

## Retry Logic

### Exponential Backoff

The retry system uses exponential backoff with jitter:

```
delay = min(initialDelay * (multiplier ^ attempt) + jitter, maxDelay)
```

**Default configuration:**
- Initial delay: 1000ms
- Multiplier: 2x
- Max delay: 30000ms (30 seconds)
- Jitter: ±10%

**Example delays:**
- Attempt 1: ~1000ms
- Attempt 2: ~2000ms
- Attempt 3: ~4000ms

### Retry Decision Logic

```typescript
function isRetryableError(error: Error): boolean {
  // Authentication errors: NO
  if (error.name === 'PAAPIAuthenticationError') return false;
  
  // Rate limit errors: YES
  if (error.name === 'PAAPIRateLimitError') return true;
  
  // Product not found: NO
  if (error.name === 'PAAPIProductNotFoundError') return false;
  
  // Network errors: YES
  if (message.includes('network') || message.includes('timeout')) return true;
  
  // Default: NO (fail fast for unknown errors)
  return false;
}
```

## Error Isolation

**Principle:** One product's failure should not affect others

**Implementation:**
- Each batch is processed independently
- Batch failures mark only that batch's products as failed
- Sync continues with next batch
- Final summary includes all successes and failures

**Example:**
```
Batch 1: 10 products → Success
Batch 2: 10 products → Failed (network error)
Batch 3: 10 products → Success
Result: 20 successes, 10 failures
```

## Logging

### Log Levels

- **ERROR:** Critical failures, authentication errors, batch failures
- **WARN:** Rate limits, product not found, high failure rates
- **INFO:** Execution start/end, batch progress, retry success
- **DEBUG:** Rate limiting delays, ASIN extraction details

### Structured Logging

All logs include:
- Timestamp (ISO 8601)
- Log level
- Message
- Context object with relevant details
- Error object (for ERROR level)

**Example:**
```json
{
  "timestamp": "2024-12-03T00:00:00.000Z",
  "level": "ERROR",
  "message": "Batch processing failed",
  "context": {
    "service": "PriceSync",
    "executionId": "abc-123",
    "batchNumber": 2,
    "totalBatches": 10,
    "asinCount": 10,
    "errorCode": "NETWORK_ERROR"
  },
  "error": {
    "message": "Network timeout",
    "stack": "..."
  }
}
```

## CloudWatch Integration

### Metrics Published

- `SuccessCount`: Number of successful updates
- `FailureCount`: Number of failed updates
- `Duration`: Execution time in milliseconds
- `TotalProducts`: Total products in database
- `SkippedCount`: Products without ASINs
- `ProcessedCount`: Products with ASINs
- `SuccessRate`: Percentage of successful updates
- `FailureRate`: Percentage of failed updates

### Alarms

1. **High Failure Rate Alarm**
   - Threshold: >50% failure rate
   - Action: Send SNS notification

2. **Authentication Error Alarm**
   - Threshold: ≥1 authentication error
   - Action: Send SNS notification

3. **Long Execution Alarm**
   - Threshold: >5 minutes
   - Action: Send SNS notification

## Best Practices

### For Developers

1. **Always use structured logging**
   ```typescript
   logger.error('Operation failed', error, {
     productId: product.id,
     asin: asin,
     context: 'additional context'
   });
   ```

2. **Preserve existing data on failure**
   ```typescript
   // Don't update price if fetch fails
   if (error) {
     await markPriceSyncFailed(productId, errorMessage);
     // Price and timestamp remain unchanged
   }
   ```

3. **Fail fast for non-retryable errors**
   ```typescript
   if (!isRetryableError(error)) {
     throw error; // Don't waste time retrying
   }
   ```

4. **Include context in errors**
   ```typescript
   throw new Error(`Failed to process batch ${batchNumber}/${totalBatches}`);
   ```

### For Operators

1. **Monitor CloudWatch Dashboard**
   - Check success rate trends
   - Watch for failure spikes
   - Review execution duration

2. **Subscribe to SNS Alerts**
   - Add email/SMS endpoints to SNS topic
   - Set up PagerDuty/Slack integration
   - Ensure 24/7 coverage for critical alerts

3. **Review Logs Regularly**
   - Use CloudWatch Insights for pattern analysis
   - Filter by error type
   - Track specific ASINs with repeated failures

4. **Maintain PA-API Credentials**
   - Rotate credentials periodically
   - Test credentials in sandbox environment
   - Keep Parameter Store values up to date

## Testing

### Unit Tests

Test individual error handling functions:
```typescript
test('should not retry authentication errors', async () => {
  const error = new PAAPIAuthenticationError('Auth failed');
  expect(isRetryableError(error)).toBe(false);
});
```

### Integration Tests

Test end-to-end error scenarios:
- Invalid credentials → abort and alert
- Rate limit → retry with backoff
- Network error → retry then fail
- Mixed success/failure → continue processing

## Requirements Mapping

This implementation satisfies the following requirements:

- **5.1:** Error handling - log and continue for individual failures
- **5.2:** Network errors - retry up to 3 times with exponential backoff
- **5.3:** PA-API unavailable - preserve existing prices
- **5.4:** Authentication fails - send alert notification
- **5.5:** Rate limits - pause and resume with required delay
- **8.2:** Error logging - detailed information with stack traces
- **8.4:** Critical errors - SNS notifications

## Future Enhancements

1. **Dead Letter Queue (DLQ)**
   - Store failed products for manual review
   - Retry failed products separately

2. **Circuit Breaker**
   - Stop calling PA-API after consecutive failures
   - Prevent cascading failures

3. **Adaptive Rate Limiting**
   - Dynamically adjust rate based on 429 responses
   - Learn optimal rate over time

4. **Error Categorization**
   - Group similar errors for pattern analysis
   - Identify systemic issues vs. one-off failures
