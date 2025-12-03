# Manual Price Sync Trigger

This document describes how to manually trigger the Amazon price synchronization process.

## Overview

The manual price sync trigger allows administrators to initiate a price synchronization with Amazon PA-API on-demand, outside of the scheduled daily sync at 2 AM UTC.

## API Endpoint

**Endpoint:** `POST /api/admin/sync-prices`

**Authentication:** Requires Cognito authentication with admin privileges

**Authorization:** Bearer token in the `Authorization` header

## Request

### Headers
```
Authorization: Bearer <cognito-id-token>
Content-Type: application/json
```

### Body
No request body required.

## Response

### Success Response (200 OK)

```json
{
  "message": "Price sync triggered successfully",
  "executionId": "manual-1701234567890-abc123",
  "status": "running",
  "triggeredBy": "admin-username",
  "triggeredAt": "2024-12-02T10:30:00.000Z",
  "note": "Check CloudWatch logs for execution details"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "error": {
    "code": "SYNC_TRIGGER_FAILED",
    "message": "Failed to trigger price sync",
    "details": {
      "error": "Error message details"
    },
    "timestamp": "2024-12-02T10:30:00.000Z",
    "requestId": "abc-123-def-456"
  }
}
```

## Usage Examples

### Using cURL

```bash
# Get your Cognito ID token first (from login)
ID_TOKEN="your-cognito-id-token"

# Trigger the sync
curl -X POST https://your-api-gateway-url/api/admin/sync-prices \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json"
```

### Using JavaScript/TypeScript

```typescript
async function triggerPriceSync(idToken: string) {
  const response = await fetch(
    'https://your-api-gateway-url/api/admin/sync-prices',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to trigger sync: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Sync triggered:', result.executionId);
  return result;
}
```

### Using AWS CLI (Direct Lambda Invocation)

```bash
# Alternative: Invoke the Lambda directly (requires AWS credentials)
aws lambda invoke \
  --function-name pinterest-affiliate-triggerPriceSync \
  --invocation-type RequestResponse \
  --profile default \
  response.json

cat response.json
```

## Monitoring Execution

### CloudWatch Logs

After triggering the sync, you can monitor the execution in CloudWatch Logs:

1. Go to CloudWatch Console
2. Navigate to Log Groups
3. Find `/aws/lambda/pinterest-affiliate-syncAmazonPrices`
4. Search for your execution ID

### CloudWatch Dashboard

View the Price Sync Dashboard for real-time metrics:
- Success/Failure counts
- Success rate
- Execution duration
- Products processed

### Execution ID Format

The execution ID follows this format:
```
manual-<timestamp>-<random-string>
```

Example: `manual-1701234567890-abc123`

## Implementation Details

### Lambda Function

**Function Name:** `pinterest-affiliate-triggerPriceSync`

**Handler:** `functions/triggerPriceSync/index.handler`

**Timeout:** 30 seconds

**Memory:** 256 MB

### Invocation Type

The trigger Lambda invokes the price sync Lambda **asynchronously** using `InvocationType: 'Event'`. This means:

- The trigger endpoint returns immediately with the execution ID
- The actual price sync runs in the background
- You must check CloudWatch logs to see the sync results

### IAM Permissions Required

The trigger Lambda requires:
- `lambda:InvokeFunction` on the `pinterest-affiliate-syncAmazonPrices` function

### API Gateway Configuration

- **Method:** POST
- **Resource:** `/api/admin/sync-prices`
- **Authorizer:** Cognito User Pools Authorizer
- **Authorization Type:** COGNITO
- **CORS:** Enabled

## Use Cases

### When to Use Manual Sync

1. **After Bulk Product Updates:** When you've added or updated many products and want immediate price updates
2. **Testing:** To verify the price sync functionality is working correctly
3. **Emergency Updates:** When you need to refresh prices outside the scheduled time
4. **After PA-API Credential Changes:** To verify new credentials are working

### When NOT to Use Manual Sync

1. **Frequent Triggers:** Avoid triggering multiple times in quick succession (respect PA-API rate limits)
2. **During Scheduled Sync:** Don't trigger manually while the scheduled sync is running
3. **Without Valid Credentials:** Ensure PA-API credentials are configured in Parameter Store

## Troubleshooting

### Common Issues

#### 401 Unauthorized
- **Cause:** Invalid or expired Cognito token
- **Solution:** Re-authenticate and get a fresh ID token

#### 403 Forbidden
- **Cause:** User doesn't have admin privileges
- **Solution:** Ensure the user is in the Admins or Editors Cognito group

#### 500 Internal Server Error
- **Cause:** Lambda invocation failed
- **Solution:** Check CloudWatch logs for the trigger Lambda function

### Checking Sync Status

Since the sync runs asynchronously, you need to check CloudWatch logs:

```bash
# Using AWS CLI to tail logs
aws logs tail /aws/lambda/pinterest-affiliate-syncAmazonPrices \
  --follow \
  --profile default
```

Or use the CloudWatch Console to search for your execution ID.

## Security Considerations

1. **Authentication Required:** Only authenticated users can trigger the sync
2. **Admin Authorization:** The API Gateway Cognito authorizer ensures only admin users can access this endpoint
3. **Audit Trail:** All manual triggers are logged with the username and timestamp
4. **Rate Limiting:** Consider implementing additional rate limiting if needed

## Related Documentation

- [PA API Setup Guide](PA_API_SETUP.md)
- [Price Sync Infrastructure](PRICE_SYNC_INFRASTRUCTURE.md)
- [Price Sync Monitoring](PRICE_SYNC_MONITORING.md)
- [API Documentation](API_DOCUMENTATION.md)

## Requirements Satisfied

This implementation satisfies **Requirement 3.4** from the design document:

> WHERE manual price updates are needed THEN administrators SHALL be able to trigger the sync manually via API

The endpoint:
- ✅ Requires admin authentication (Cognito authorizer)
- ✅ Invokes the Price Sync Lambda asynchronously
- ✅ Returns an execution ID for tracking
- ✅ Logs who triggered the sync and when
