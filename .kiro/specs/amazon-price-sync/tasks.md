# Implementation Plan

- [x] 1. Set up AWS infrastructure and configuration
  - Create Parameter Store parameters for PA-API credentials
  - Add IAM permissions to Lambda execution role
  - Create SNS topic for alerts
  - _Requirements: 2.1, 2.2_

- [x] 2. Implement ASIN extraction utility
  - Create asinExtractor.ts with URL parsing logic
  - Support multiple Amazon URL formats (standard, short links, mobile)
  - Implement ASIN validation (10-character alphanumeric)
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 2.1 Write property test for ASIN extraction
  - **Property 5: ASIN extraction correctness**
  - **Validates: Requirements 4.1, 4.4**

- [ ]* 2.2 Write property test for ASIN validation
  - **Property 6: ASIN validation**
  - **Validates: Requirements 4.2**

- [ ]* 2.3 Write property test for invalid URL handling
  - **Property 7: Invalid URL handling**
  - **Validates: Requirements 4.3**

- [x] 3. Implement PA-API client service
  - Create amazonPAAPI.ts with AWS Signature V4 signing
  - Implement GetItems API call with batch support (10 ASINs per request)
  - Parse PA-API responses to extract price, currency, availability
  - Handle PA-API error responses
  - Cache credentials from Parameter Store
  - _Requirements: 1.1, 1.3, 2.2, 5.1_

- [ ]* 3.1 Write unit tests for PA-API client
  - Test request signing
  - Test response parsing
  - Test error handling
  - Mock PA-API responses
  - _Requirements: 1.1, 1.3_

- [x] 4. Implement retry and rate limiting logic
  - Create retry utility with exponential backoff
  - Implement rate limit detection and handling
  - Add configurable retry attempts (default: 3)
  - _Requirements: 1.4, 5.2, 5.5_

- [ ]* 4.1 Write property test for retry behavior
  - **Property 8: Retry behavior**
  - **Validates: Requirements 5.2**

- [x] 5. Implement product update service
  - Create productUpdater.ts for DynamoDB updates
  - Update price, currency, and priceLastUpdated timestamp
  - Set priceSyncStatus field (success/failed/pending)
  - Handle update failures gracefully
  - _Requirements: 1.2, 6.1_

- [ ]* 5.1 Write property test for price update consistency
  - **Property 2: Price update consistency**
  - **Validates: Requirements 1.2**

- [ ]* 5.2 Write property test for timestamp updates
  - **Property 10: Timestamp update on success**
  - **Validates: Requirements 6.1**

- [ ]* 5.3 Write property test for price preservation on failure
  - **Property 9: Price preservation on failure**
  - **Validates: Requirements 5.3**

- [ ]* 5.4 Write property test for timestamp preservation on failure
  - **Property 11: Timestamp preservation on failure**
  - **Validates: Requirements 6.3**

- [x] 6. Create Price Sync Lambda function
  - Create syncAmazonPrices/index.ts handler
  - Scan all products from DynamoDB
  - Extract ASINs from Amazon URLs
  - Batch ASINs into groups of 10
  - Call PA-API for each batch with rate limiting
  - Update products with new prices
  - Track success/failure counts
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ]* 6.1 Write property test for complete product processing
  - **Property 1: Complete product processing**
  - **Validates: Requirements 1.1**

- [ ]* 6.2 Write property test for error isolation
  - **Property 3: Error isolation**
  - **Validates: Requirements 1.3, 5.1**

- [ ]* 6.3 Write property test for summary accuracy
  - **Property 4: Summary accuracy**
  - **Validates: Requirements 1.5**

- [x] 7. Implement comprehensive logging
  - Log execution start/end times
  - Log total products processed
  - Log success/failure/skipped counts
  - Log detailed error information (ASIN, message, stack trace)
  - Structure logs for CloudWatch Insights queries
  - _Requirements: 8.1, 8.2_

- [ ]* 7.1 Write property test for execution logging completeness
  - **Property 13: Execution logging completeness**
  - **Validates: Requirements 8.1**

- [ ]* 7.2 Write property test for error logging completeness
  - **Property 14: Error logging completeness**
  - **Validates: Requirements 8.2**

- [x] 8. Add CloudWatch metrics and monitoring
  - Publish custom metrics (SuccessCount, FailureCount, Duration)
  - Create CloudWatch dashboard for price sync monitoring
  - Set up alarms for high failure rates
  - Set up alarms for authentication errors
  - _Requirements: 8.3, 8.4_

- [x] 9. Implement error handling and notifications
  - Handle authentication errors (401) - abort and alert
  - Handle rate limit errors (429) - backoff and retry
  - Handle product not found (404) - log and continue
  - Handle network errors - retry with backoff
  - Send SNS notifications for critical errors
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 10. Set up EventBridge scheduled rule
  - Create EventBridge rule in CDK
  - Configure cron schedule (daily at 2 AM UTC)
  - Set Lambda as target
  - Configure retry policy (2 retries with exponential backoff)
  - _Requirements: 3.1, 3.2_

- [x] 11. Update Product model and database schema
  - Add asin field to Product type
  - Add priceLastUpdated field
  - Add priceSyncStatus field
  - Add priceSyncError field
  - Update TypeScript interfaces
  - _Requirements: 4.1, 6.1, 6.3_

- [x] 12. Update admin product form
  - Auto-extract ASIN when Amazon URL is entered
  - Display ASIN in product form (read-only)
  - Show priceLastUpdated timestamp
  - Show priceSyncStatus indicator
  - Display sync errors if present
  - _Requirements: 4.1, 6.2_

- [x] 13. Update product display components
  - Show "Price last updated" timestamp
  - Display "Price may have changed" notice if > 7 days old
  - Show "Price not available" when price is null
  - Ensure displayed price matches database
  - _Requirements: 7.1, 7.2, 7.3_

- [ ]* 13.1 Write property test for price display consistency
  - **Property 12: Price display consistency**
  - **Validates: Requirements 7.1**

- [x] 14. Create manual sync trigger endpoint
  - Add POST /admin/sync-prices API endpoint
  - Require admin authentication
  - Invoke Price Sync Lambda asynchronously
  - Return execution ID for tracking
  - _Requirements: 3.4_

- [x] 15. Create sync history view in admin panel
  - Add page to display sync execution logs
  - Show execution time, duration, success/failure counts
  - Display detailed errors for failed products
  - Add filtering by date and status
  - _Requirements: 6.4_

- [x] 16. Update infrastructure CDK stack
  - Add Price Sync Lambda to backend stack
  - Configure Lambda environment variables
  - Add EventBridge rule and permissions
  - Add SNS topic for alerts
  - Add CloudWatch log group
  - Deploy updated infrastructure
  - _Requirements: 3.1, 8.4_

- [x] 17. Create deployment documentation
  - Document PA-API credential setup process
  - Document Parameter Store configuration
  - Document how to trigger manual sync
  - Document monitoring and troubleshooting
  - Create runbook for common issues
  - _Requirements: 2.1, 2.2, 3.4_

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 19. Integration testing
  - Test end-to-end sync with real PA-API (sandbox)
  - Test with invalid credentials
  - Test with non-existent ASINs
  - Test rate limit handling
  - Verify CloudWatch logs and metrics
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 8.1, 8.3_

- [x] 20. Final checkpoint - Production readiness
  - Ensure all tests pass, ask the user if questions arise.
