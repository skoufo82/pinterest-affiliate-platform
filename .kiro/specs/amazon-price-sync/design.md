# Design Document

## Overview

This design implements an automated price synchronization system that integrates with Amazon's Product Advertising API (PA-API 5.0) to keep product prices current. The system uses a scheduled Lambda function to periodically fetch prices from Amazon and update the DynamoDB product table. The design emphasizes reliability, error handling, and maintainability.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│  EventBridge    │
│  (Daily 2AM)    │
└────────┬────────┘
         │ triggers
         ▼
┌─────────────────────────┐
│  Price Sync Lambda      │
│  - Fetch all products   │
│  - Extract ASINs        │
│  - Call PA-API          │
│  - Update DynamoDB      │
└───┬─────────────────┬───┘
    │                 │
    ▼                 ▼
┌─────────────┐  ┌──────────────┐
│  DynamoDB   │  │  PA-API 5.0  │
│  Products   │  │  (Amazon)    │
└─────────────┘  └──────────────┘
         │
         ▼
┌─────────────────┐
│  CloudWatch     │
│  Logs/Metrics   │
└─────────────────┘
```

### Data Flow

1. EventBridge triggers Price Sync Lambda on schedule
2. Lambda retrieves all products from DynamoDB
3. For each product with an Amazon link:
   - Extract ASIN from URL
   - Call PA-API to get current price
   - Update product in DynamoDB with new price and timestamp
4. Log results and metrics to CloudWatch

## Components and Interfaces

### 1. Price Sync Lambda Function

**Location:** `backend/functions/syncAmazonPrices/index.ts`

**Responsibilities:**
- Fetch all products from DynamoDB
- Extract ASINs from Amazon URLs
- Make PA-API requests with proper authentication
- Update product prices in DynamoDB
- Handle errors and implement retry logic
- Log execution metrics

**Interface:**
```typescript
export const handler = async (event: ScheduledEvent): Promise<SyncResult> => {
  // Returns summary of sync operation
}
```

### 2. PA-API Client Service

**Location:** `backend/shared/amazonPAAPI.ts`

**Responsibilities:**
- Sign PA-API requests with AWS Signature V4
- Make GetItems API calls to fetch product data
- Parse API responses
- Handle rate limiting and errors
- Cache credentials from Parameter Store

**Interface:**
```typescript
interface PAAPIClient {
  getProductInfo(asins: string[]): Promise<ProductInfo[]>;
  extractASIN(amazonUrl: string): string | null;
}

interface ProductInfo {
  asin: string;
  price: string | null;
  currency: string;
  availability: boolean;
  title: string;
  imageUrl: string;
}
```

### 3. ASIN Extractor Utility

**Location:** `backend/shared/asinExtractor.ts`

**Responsibilities:**
- Parse Amazon URLs to extract ASINs
- Validate ASIN format
- Handle various Amazon URL formats

**Interface:**
```typescript
export function extractASIN(url: string): string | null;
export function validateASIN(asin: string): boolean;
```

### 4. Product Update Service

**Location:** `backend/shared/productUpdater.ts`

**Responsibilities:**
- Update product prices in DynamoDB
- Set priceLastUpdated timestamp
- Handle update failures gracefully

**Interface:**
```typescript
export async function updateProductPrice(
  productId: string,
  price: string,
  currency: string
): Promise<void>;
```

### 5. EventBridge Schedule Rule

**Configuration in CDK:**
- Schedule: `cron(0 2 * * ? *)` (Daily at 2 AM UTC)
- Target: Price Sync Lambda
- Retry policy: 2 retries with exponential backoff

### 6. Parameter Store Configuration

**Parameters:**
- `/amazon-affiliate/pa-api/access-key` - PA-API Access Key
- `/amazon-affiliate/pa-api/secret-key` - PA-API Secret Key
- `/amazon-affiliate/pa-api/partner-tag` - Amazon Associate Tag
- `/amazon-affiliate/pa-api/marketplace` - Amazon Marketplace (default: US)

## Data Models

### Extended Product Model

Add new fields to existing Product type:

```typescript
interface Product {
  // ... existing fields
  asin?: string;                    // Amazon Standard Identification Number
  priceLastUpdated?: string;        // ISO timestamp of last price sync
  priceSyncStatus?: 'success' | 'failed' | 'pending';
  priceSyncError?: string;          // Last error message if sync failed
}
```

### Sync Execution Log

```typescript
interface SyncExecutionLog {
  executionId: string;              // Unique execution ID
  startTime: string;                // ISO timestamp
  endTime: string;                  // ISO timestamp
  totalProducts: number;            // Total products processed
  successCount: number;             // Successfully updated
  failureCount: number;             // Failed updates
  skippedCount: number;             // Products without ASINs
  errors: SyncError[];              // Detailed error list
}

interface SyncError {
  productId: string;
  asin: string;
  errorMessage: string;
  errorCode: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Complete product processing
*For any* set of products with valid ASINs, the sync service should attempt to fetch prices for all of them
**Validates: Requirements 1.1**

### Property 2: Price update consistency
*For any* product where a price is successfully retrieved from Amazon, the database record should be updated with that price and a current timestamp
**Validates: Requirements 1.2**

### Property 3: Error isolation
*For any* sync execution where one product fails, all other products should still be processed
**Validates: Requirements 1.3, 5.1**

### Property 4: Summary accuracy
*For any* sync execution, the sum of successful updates, failures, and unchanged prices should equal the total number of products processed
**Validates: Requirements 1.5**

### Property 5: ASIN extraction correctness
*For any* valid Amazon URL format, the ASIN extractor should return the correct 10-character ASIN
**Validates: Requirements 4.1, 4.4**

### Property 6: ASIN validation
*For any* extracted ASIN, it should match the standard 10-character alphanumeric format
**Validates: Requirements 4.2**

### Property 7: Invalid URL handling
*For any* Amazon URL that does not contain a valid ASIN, the system should return a validation error
**Validates: Requirements 4.3**

### Property 8: Retry behavior
*For any* network error, the system should retry up to 3 times with exponentially increasing delays
**Validates: Requirements 5.2**

### Property 9: Price preservation on failure
*For any* product where the PA-API call fails, the existing price should remain unchanged in the database
**Validates: Requirements 5.3**

### Property 10: Timestamp update on success
*For any* successful price update, the priceLastUpdated timestamp should be set to the current time
**Validates: Requirements 6.1**

### Property 11: Timestamp preservation on failure
*For any* failed price sync, the priceLastUpdated timestamp should remain unchanged
**Validates: Requirements 6.3**

### Property 12: Price display consistency
*For any* product, the displayed price should match the price stored in the database
**Validates: Requirements 7.1**

### Property 13: Execution logging completeness
*For any* sync execution, the logs should contain start time, end time, and total products processed
**Validates: Requirements 8.1**

### Property 14: Error logging completeness
*For any* error that occurs during sync, the log should contain the ASIN, error message, and stack trace
**Validates: Requirements 8.2**

## Error Handling

### PA-API Errors

1. **Authentication Errors (401)**
   - Log error with full details
   - Send SNS notification to administrators
   - Abort sync execution
   - Preserve all existing prices

2. **Rate Limit Errors (429)**
   - Implement exponential backoff starting at 1 second
   - Retry up to 3 times
   - If still failing, pause and resume in next scheduled run
   - Log rate limit occurrences

3. **Product Not Found (404)**
   - Log warning with ASIN
   - Mark product with sync status 'failed'
   - Continue processing other products
   - Don't update price or timestamp

4. **Network Errors**
   - Retry up to 3 times with exponential backoff
   - Log each retry attempt
   - If all retries fail, mark as failed and continue
   - Preserve existing price

5. **Invalid Response Format**
   - Log error with response body
   - Skip product and continue
   - Alert if pattern of invalid responses detected

### DynamoDB Errors

1. **Update Failures**
   - Retry up to 2 times
   - Log error details
   - Continue processing other products
   - Include in failure count

2. **Scan/Query Failures**
   - Retry with exponential backoff
   - If persistent, abort execution
   - Send alert notification

### Parameter Store Errors

1. **Missing Parameters**
   - Log critical error
   - Abort execution immediately
   - Send SNS notification
   - Don't attempt any API calls

2. **Access Denied**
   - Log error with IAM role details
   - Abort execution
   - Send alert to administrators

## Testing Strategy

### Unit Testing

**ASIN Extraction Tests:**
- Test various Amazon URL formats (short links, long URLs, mobile URLs)
- Test invalid URLs return null
- Test ASIN validation regex

**PA-API Client Tests:**
- Mock PA-API responses
- Test request signing
- Test error response parsing
- Test rate limit handling

**Product Update Tests:**
- Test successful updates
- Test update failures
- Test timestamp setting

### Property-Based Testing

We will use **fast-check** (JavaScript/TypeScript property-based testing library) for testing universal properties.

**Configuration:**
- Minimum 100 iterations per property test
- Each property test must reference its design document property number
- Tag format: `// Feature: amazon-price-sync, Property {number}: {property_text}`

**Key Properties to Test:**
1. ASIN extraction works for all valid Amazon URL formats
2. Price updates always set timestamps
3. Failed syncs never modify existing prices
4. Retry logic always respects exponential backoff timing
5. Summary counts always equal total products

### Integration Testing

**End-to-End Sync Test:**
- Create test products with known ASINs
- Trigger sync function
- Verify prices updated correctly
- Verify timestamps set
- Verify logs contain expected data

**Error Scenario Tests:**
- Test with invalid credentials
- Test with non-existent ASINs
- Test with rate limit simulation
- Verify error handling and recovery

### Manual Testing

**PA-API Setup:**
- Verify credentials in Parameter Store
- Test manual sync trigger
- Review CloudWatch logs
- Check price updates in admin panel

## Deployment Considerations

### Prerequisites

1. **PA-API Access**
   - Amazon Associates account with 3+ qualifying sales
   - PA-API credentials (Access Key, Secret Key)
   - Associate Tag (Partner Tag)

2. **AWS Resources**
   - Parameter Store parameters created
   - IAM role with necessary permissions
   - EventBridge rule configured
   - CloudWatch log group created

### IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/Products"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/amazon-affiliate/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:*:*:price-sync-alerts"
    }
  ]
}
```

### Environment Variables

- `PRODUCTS_TABLE_NAME`: DynamoDB table name
- `AWS_REGION`: AWS region for Parameter Store
- `LOG_LEVEL`: Logging verbosity (INFO, DEBUG, ERROR)

### Monitoring and Alerts

**CloudWatch Metrics:**
- `PriceSync/SuccessCount`: Number of successful updates
- `PriceSync/FailureCount`: Number of failed updates
- `PriceSync/Duration`: Execution time in milliseconds
- `PriceSync/APICallCount`: Number of PA-API calls made

**CloudWatch Alarms:**
- Alert if failure rate > 50%
- Alert if execution duration > 5 minutes
- Alert if authentication errors occur
- Alert if no execution in 25 hours

### Rollback Plan

If issues occur:
1. Disable EventBridge rule to stop scheduled executions
2. Prices will remain at last known good values
3. Fix issues and re-enable schedule
4. Manual sync can be triggered to catch up

## Performance Considerations

### PA-API Rate Limits

- 1 request per second (default)
- Can request higher limits from Amazon
- Batch up to 10 ASINs per request to optimize

### Optimization Strategies

1. **Batch Processing**
   - Group ASINs into batches of 10
   - Make single API call per batch
   - Reduces total API calls by 90%

2. **Parallel Processing**
   - Process batches in parallel (respecting rate limits)
   - Use Promise.all with concurrency control
   - Target: Process 100 products in < 2 minutes

3. **Caching**
   - Cache PA-API credentials for Lambda execution lifetime
   - Reuse HTTP connections
   - Cache product list for duration of execution

### Scalability

- Current design handles up to 1000 products efficiently
- For > 1000 products, consider:
  - Breaking into multiple Lambda invocations
  - Using Step Functions for orchestration
  - Implementing pagination in product scan

## Security Considerations

1. **Credential Management**
   - Never log PA-API credentials
   - Use Parameter Store with encryption
   - Rotate credentials periodically

2. **API Key Protection**
   - Restrict IAM role to minimum permissions
   - Use VPC endpoints for Parameter Store access
   - Enable CloudTrail logging for credential access

3. **Data Validation**
   - Validate all PA-API responses
   - Sanitize error messages before logging
   - Prevent injection attacks in ASIN extraction

## Future Enhancements

1. **Additional Product Data**
   - Sync product images from Amazon
   - Sync ratings and review counts
   - Sync product availability status

2. **Smart Scheduling**
   - More frequent updates for featured products
   - Less frequent updates for older products
   - Dynamic scheduling based on price volatility

3. **Price History**
   - Track price changes over time
   - Display price trends to users
   - Alert on significant price drops

4. **Multi-Marketplace Support**
   - Support Amazon.co.uk, Amazon.de, etc.
   - Currency conversion
   - Regional pricing display
