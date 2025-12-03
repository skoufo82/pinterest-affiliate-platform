# Amazon Price Sync - Complete Deployment Guide

This comprehensive guide walks you through deploying and configuring the Amazon Price Sync feature from start to finish.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [PA-API Credential Setup](#pa-api-credential-setup)
3. [Infrastructure Deployment](#infrastructure-deployment)
4. [Parameter Store Configuration](#parameter-store-configuration)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Manual Sync Trigger](#manual-sync-trigger)
7. [Monitoring and Alerts](#monitoring-and-alerts)
8. [Troubleshooting](#troubleshooting)
9. [Common Issues Runbook](#common-issues-runbook)

---

## Prerequisites

### Required Accounts and Access

1. **Amazon Associates Account**
   - Active Amazon Associates account
   - At least 3 qualifying sales in the last 180 days
   - Without qualifying sales, PA-API access will be revoked after 30 days

2. **AWS Account Access**
   - AWS SSO configured (see `aws-sso-config.md`)
   - Permissions to deploy CloudFormation stacks
   - Access to Parameter Store, Lambda, EventBridge, SNS, and CloudWatch

3. **Development Environment**
   - Node.js 18+ installed
   - AWS CLI v2 installed
   - AWS CDK installed (`npm install -g aws-cdk`)

### Verify AWS Authentication

```bash
# Login to AWS SSO
/usr/local/bin/aws sso login --profile default

# Verify authentication
aws sts get-caller-identity --profile default
```

Expected output:
```json
{
  "UserId": "...",
  "Account": "788222620487",
  "Arn": "arn:aws:sts::788222620487:assumed-role/..."
}
```

---

## PA-API Credential Setup

### Step 1: Obtain PA-API Credentials

1. Log in to [Amazon Associates Central](https://affiliate-program.amazon.com/)
2. Navigate to **Tools** → **Product Advertising API**
3. Click **Add Credentials** or view existing credentials
4. Note down the following (save securely):
   - **Access Key**: Your PA-API access key
   - **Secret Key**: Shown only once - save immediately
   - **Associate Tag**: Your tracking ID (e.g., `yoursite-20`)

### Step 2: Prepare Credential Values

Create a temporary file to store your credentials (DO NOT commit to git):

```bash
# Create a secure temporary file
cat > /tmp/pa-api-creds.txt << 'EOF'
ACCESS_KEY=your_actual_access_key_here
SECRET_KEY=your_actual_secret_key_here
PARTNER_TAG=yoursite-20
MARKETPLACE=www.amazon.com
EOF

# Secure the file
chmod 600 /tmp/pa-api-creds.txt
```

---

## Infrastructure Deployment

### Step 1: Build Backend Code

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if not already done)
npm install

# Build the backend
npm run build

# Verify build succeeded
ls -la dist/
```

### Step 2: Deploy CDK Stack

```bash
# Navigate to infrastructure directory
cd ../infrastructure

# Install dependencies (if not already done)
npm install

# Bootstrap CDK (first time only)
npx cdk bootstrap --profile default

# Review changes before deployment
npx cdk diff PinterestAffiliateBackendStack --profile default

# Deploy the stack
npx cdk deploy PinterestAffiliateBackendStack --profile default
```

### Step 3: Note CloudFormation Outputs

After deployment completes, save the following outputs:

```bash
# View all stack outputs
aws cloudformation describe-stacks \
  --stack-name PinterestAffiliateBackendStack \
  --query 'Stacks[0].Outputs' \
  --profile default
```

Key outputs to note:
- `PriceSyncAlertTopicArn`: SNS topic ARN for alerts
- `PriceSyncLambdaName`: Lambda function name
- `PriceSyncDashboardUrl`: CloudWatch dashboard URL
- `PAAPIParametersPrefix`: Parameter Store prefix

---

## Parameter Store Configuration

### Option 1: Using AWS CLI (Recommended)

```bash
# Source your credentials (from the temp file created earlier)
source /tmp/pa-api-creds.txt

# Set PA-API Access Key
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/access-key" \
  --value "$ACCESS_KEY" \
  --type String \
  --overwrite \
  --profile default

# Set PA-API Secret Key (using SecureString for encryption)
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/secret-key" \
  --value "$SECRET_KEY" \
  --type SecureString \
  --overwrite \
  --profile default

# Set Partner Tag
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/partner-tag" \
  --value "$PARTNER_TAG" \
  --type String \
  --overwrite \
  --profile default

# Set Marketplace
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/marketplace" \
  --value "$MARKETPLACE" \
  --type String \
  --overwrite \
  --profile default

# Clean up temporary credentials file
shred -u /tmp/pa-api-creds.txt
```

### Option 2: Using AWS Console

1. Open [AWS Systems Manager Console](https://console.aws.amazon.com/systems-manager/)
2. Navigate to **Parameter Store** in the left sidebar
3. Update each parameter:

   | Parameter Name | Type | Value |
   |---------------|------|-------|
   | `/amazon-affiliate/pa-api/access-key` | String | Your PA-API Access Key |
   | `/amazon-affiliate/pa-api/secret-key` | SecureString | Your PA-API Secret Key |
   | `/amazon-affiliate/pa-api/partner-tag` | String | Your Associate Tag |
   | `/amazon-affiliate/pa-api/marketplace` | String | `www.amazon.com` |

### Verify Parameter Configuration

```bash
# List all PA-API parameters
aws ssm get-parameters-by-path \
  --path "/amazon-affiliate/pa-api/" \
  --profile default

# Verify secret key (decrypted)
aws ssm get-parameter \
  --name "/amazon-affiliate/pa-api/secret-key" \
  --with-decryption \
  --profile default \
  --query 'Parameter.Value' \
  --output text
```

---

## Post-Deployment Verification

### Step 1: Verify Lambda Function

```bash
# Check Lambda function exists
aws lambda get-function \
  --function-name pinterest-affiliate-syncAmazonPrices \
  --profile default

# Check function configuration
aws lambda get-function-configuration \
  --function-name pinterest-affiliate-syncAmazonPrices \
  --profile default
```

### Step 2: Verify EventBridge Rule

```bash
# Check scheduled rule
aws events describe-rule \
  --name pinterest-affiliate-price-sync-daily \
  --profile default

# Verify rule is enabled
aws events list-targets-by-rule \
  --rule pinterest-affiliate-price-sync-daily \
  --profile default
```

### Step 3: Verify SNS Topic

```bash
# List SNS topics
aws sns list-topics --profile default | grep price-sync-alerts

# Get topic attributes
aws sns get-topic-attributes \
  --topic-arn <PriceSyncAlertTopicArn> \
  --profile default
```

### Step 4: Subscribe to SNS Alerts

```bash
# Subscribe with email
aws sns subscribe \
  --topic-arn <PriceSyncAlertTopicArn> \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --profile default

# Check your email and confirm the subscription
```

### Step 5: Test Manual Sync

```bash
# Trigger a manual sync to verify everything works
aws lambda invoke \
  --function-name pinterest-affiliate-syncAmazonPrices \
  --invocation-type Event \
  --payload '{"source":"manual-test","time":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
  --profile default \
  response.json

# Check the response
cat response.json
```

### Step 6: Monitor Execution

```bash
# Tail CloudWatch logs (wait 10-30 seconds after triggering)
aws logs tail /aws/lambda/pinterest-affiliate-syncAmazonPrices \
  --follow \
  --profile default
```

Look for:
- ✅ "Starting price sync execution"
- ✅ "Retrieved X products from database"
- ✅ "Successfully updated X products"
- ✅ "Price sync completed successfully"

---

## Manual Sync Trigger

### Via Admin UI

1. Log in to the admin panel
2. Navigate to **Sync History** page
3. Click **Trigger Manual Sync** button
4. Monitor the execution in the sync history table

### Via API

```bash
# Get your Cognito ID token (from browser dev tools or login response)
ID_TOKEN="your-cognito-id-token"

# Trigger sync via API
curl -X POST https://your-api-gateway-url/api/admin/sync-prices \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json"
```

### Via AWS CLI

```bash
# Direct Lambda invocation
aws lambda invoke \
  --function-name pinterest-affiliate-syncAmazonPrices \
  --invocation-type Event \
  --profile default \
  response.json
```

For more details, see [MANUAL_PRICE_SYNC.md](MANUAL_PRICE_SYNC.md).

---

## Monitoring and Alerts

### CloudWatch Dashboard

Access the Price Sync Dashboard:

1. Open [CloudWatch Console](https://console.aws.amazon.com/cloudwatch/)
2. Navigate to **Dashboards**
3. Select **PinterestAffiliate-PriceSync**

Or use the direct URL from CloudFormation outputs: `PriceSyncDashboardUrl`

### Key Metrics to Monitor

| Metric | What to Watch | Normal Range |
|--------|---------------|--------------|
| Success Rate | Should be high | > 90% |
| Failure Rate | Should be low | < 10% |
| Duration | Execution time | < 2 minutes for 100 products |
| Success Count | Products updated | Varies by product count |
| Failure Count | Failed updates | Should be minimal |

### CloudWatch Alarms

Three alarms are configured:

1. **High Failure Rate** (> 50%)
   - Triggers when more than half of updates fail
   - Action: SNS notification

2. **Authentication Error**
   - Triggers on PA-API credential issues
   - Action: SNS notification
   - Requires immediate attention

3. **Long Execution** (> 5 minutes)
   - Triggers on performance degradation
   - Action: SNS notification
   - May indicate timeout risk

### Viewing Logs

```bash
# Tail recent logs
aws logs tail /aws/lambda/pinterest-affiliate-syncAmazonPrices \
  --since 1h \
  --profile default

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/pinterest-affiliate-syncAmazonPrices \
  --filter-pattern "ERROR" \
  --profile default

# Search for specific execution
aws logs filter-log-events \
  --log-group-name /aws/lambda/pinterest-affiliate-syncAmazonPrices \
  --filter-pattern "executionId: manual-1234567890" \
  --profile default
```

For more details, see [PRICE_SYNC_MONITORING.md](PRICE_SYNC_MONITORING.md).

---

## Troubleshooting

### General Troubleshooting Steps

1. **Check CloudWatch Logs**
   ```bash
   aws logs tail /aws/lambda/pinterest-affiliate-syncAmazonPrices \
     --since 1h \
     --profile default
   ```

2. **Verify Parameter Store Access**
   ```bash
   aws ssm get-parameters-by-path \
     --path "/amazon-affiliate/pa-api/" \
     --profile default
   ```

3. **Check Lambda IAM Permissions**
   ```bash
   aws lambda get-function \
     --function-name pinterest-affiliate-syncAmazonPrices \
     --query 'Configuration.Role' \
     --profile default
   ```

4. **Review CloudWatch Metrics**
   - Check the dashboard for anomalies
   - Look at success/failure trends
   - Review execution duration

### Common Error Messages

#### "Parameter not found"
- **Cause**: Parameter Store parameters not configured
- **Solution**: Follow [Parameter Store Configuration](#parameter-store-configuration)

#### "Access Denied" (Parameter Store)
- **Cause**: Lambda role lacks `ssm:GetParameter` permission
- **Solution**: Redeploy CDK stack or manually add IAM permission

#### "401 Unauthorized" (PA-API)
- **Cause**: Invalid PA-API credentials
- **Solution**: Verify credentials in Parameter Store match Amazon Associates

#### "429 Too Many Requests" (PA-API)
- **Cause**: Rate limit exceeded
- **Solution**: System will automatically retry with backoff

#### "SignatureDoesNotMatch" (PA-API)
- **Cause**: Incorrect secret key or signing issue
- **Solution**: Verify secret key in Parameter Store

---

## Common Issues Runbook

### Issue 1: No Products Being Updated

**Symptoms:**
- Sync completes but SuccessCount = 0
- Logs show "No products with ASINs found"

**Diagnosis:**
```bash
# Check if products have ASINs
aws dynamodb scan \
  --table-name <ProductsTableName> \
  --filter-expression "attribute_exists(asin)" \
  --select COUNT \
  --profile default
```

**Resolution:**
1. Verify products have Amazon URLs in the database
2. Check that ASIN extraction is working:
   ```bash
   # Test ASIN extraction
   cd backend
   npm test -- asinExtractor.test.ts
   ```
3. Manually add ASINs to products via admin panel
4. Trigger manual sync to verify

**Prevention:**
- Ensure Amazon URLs are entered when creating products
- Validate ASIN extraction in product form

---

### Issue 2: High Failure Rate (> 50%)

**Symptoms:**
- CloudWatch alarm triggered
- Many products showing "failed" status
- High FailureCount metric

**Diagnosis:**
```bash
# Check recent errors in logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/pinterest-affiliate-syncAmazonPrices \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --profile default
```

**Resolution:**

**If errors are "Product not found (404)":**
1. ASINs may be invalid or products discontinued
2. Review products with failed status in admin panel
3. Update or remove invalid products

**If errors are "Rate limit exceeded (429)":**
1. System should auto-retry with backoff
2. Check if rate limit is being respected
3. Consider requesting higher limits from Amazon

**If errors are "Network timeout":**
1. Check AWS region connectivity to PA-API
2. Increase Lambda timeout if needed
3. Verify VPC configuration (if applicable)

**Prevention:**
- Regularly audit product ASINs
- Monitor PA-API rate limits
- Set up proactive alerts

---

### Issue 3: Authentication Errors (401)

**Symptoms:**
- CloudWatch alarm triggered immediately
- All requests failing with 401
- Logs show "Unauthorized" or "InvalidSignature"

**Diagnosis:**
```bash
# Verify credentials in Parameter Store
aws ssm get-parameter \
  --name "/amazon-affiliate/pa-api/access-key" \
  --profile default

aws ssm get-parameter \
  --name "/amazon-affiliate/pa-api/secret-key" \
  --with-decryption \
  --profile default
```

**Resolution:**
1. **Verify credentials are correct:**
   - Log in to Amazon Associates
   - Check PA-API credentials match Parameter Store
   
2. **Check Amazon Associates account status:**
   - Ensure account has 3+ qualifying sales
   - Verify account is in good standing
   
3. **Update credentials if needed:**
   ```bash
   aws ssm put-parameter \
     --name "/amazon-affiliate/pa-api/secret-key" \
     --value "NEW_SECRET_KEY" \
     --type SecureString \
     --overwrite \
     --profile default
   ```

4. **Test with manual sync:**
   ```bash
   aws lambda invoke \
     --function-name pinterest-affiliate-syncAmazonPrices \
     --invocation-type Event \
     --profile default \
     response.json
   ```

**Prevention:**
- Set calendar reminder to check account status monthly
- Monitor for PA-API access revocation emails
- Maintain qualifying sales threshold

---

### Issue 4: Lambda Timeout (10 minutes)

**Symptoms:**
- Execution stops abruptly
- Logs show incomplete processing
- Duration metric shows 600,000ms (10 minutes)

**Diagnosis:**
```bash
# Check execution duration trend
aws cloudwatch get-metric-statistics \
  --namespace PriceSync \
  --metric-name Duration \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Maximum \
  --profile default
```

**Resolution:**
1. **Check product count:**
   ```bash
   aws dynamodb describe-table \
     --table-name <ProductsTableName> \
     --query 'Table.ItemCount' \
     --profile default
   ```

2. **If > 1000 products:**
   - Consider increasing Lambda timeout to 15 minutes
   - Implement pagination or batch processing
   - Split into multiple Lambda invocations

3. **Increase timeout temporarily:**
   ```bash
   aws lambda update-function-configuration \
     --function-name pinterest-affiliate-syncAmazonPrices \
     --timeout 900 \
     --profile default
   ```

4. **Optimize batch processing:**
   - Review batch size (currently 10 ASINs per request)
   - Check PA-API response times
   - Consider parallel processing with concurrency limits

**Prevention:**
- Monitor product count growth
- Set up alarm for execution duration > 8 minutes
- Plan for scaling before reaching 1000 products

---

### Issue 5: Scheduled Sync Not Running

**Symptoms:**
- No executions at scheduled time (2 AM UTC)
- No recent logs in CloudWatch
- Dashboard shows no recent data

**Diagnosis:**
```bash
# Check EventBridge rule status
aws events describe-rule \
  --name pinterest-affiliate-price-sync-daily \
  --profile default

# Check rule targets
aws events list-targets-by-rule \
  --rule pinterest-affiliate-price-sync-daily \
  --profile default

# Check recent Lambda invocations
aws lambda get-function \
  --function-name pinterest-affiliate-syncAmazonPrices \
  --profile default
```

**Resolution:**
1. **Verify rule is enabled:**
   ```bash
   aws events enable-rule \
     --name pinterest-affiliate-price-sync-daily \
     --profile default
   ```

2. **Check Lambda permissions:**
   ```bash
   # EventBridge needs permission to invoke Lambda
   aws lambda get-policy \
     --function-name pinterest-affiliate-syncAmazonPrices \
     --profile default
   ```

3. **Manually trigger to test:**
   ```bash
   aws lambda invoke \
     --function-name pinterest-affiliate-syncAmazonPrices \
     --invocation-type Event \
     --profile default \
     response.json
   ```

4. **If permissions missing, redeploy:**
   ```bash
   cd infrastructure
   npx cdk deploy PinterestAffiliateBackendStack --profile default
   ```

**Prevention:**
- Set up alarm for "no execution in 25 hours"
- Regularly check EventBridge rule status
- Monitor CloudWatch dashboard daily

---

### Issue 6: Prices Not Displaying on Frontend

**Symptoms:**
- Sync shows successful updates
- Database has updated prices
- Frontend shows "Price not available"

**Diagnosis:**
```bash
# Check a specific product in DynamoDB
aws dynamodb get-item \
  --table-name <ProductsTableName> \
  --key '{"id":{"S":"product-id-here"}}' \
  --profile default

# Verify price fields exist
# Look for: price, priceLastUpdated, priceSyncStatus
```

**Resolution:**
1. **Check product API response:**
   ```bash
   curl https://your-api-gateway-url/api/products/product-id
   ```

2. **Verify price display logic:**
   - Check `frontend/src/utils/priceDisplay.ts`
   - Ensure price formatting is correct
   - Verify currency handling

3. **Clear browser cache:**
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Clear localStorage
   - Try incognito mode

4. **Check for null/undefined prices:**
   ```typescript
   // In browser console
   fetch('/api/products/product-id')
     .then(r => r.json())
     .then(p => console.log('Price:', p.price, 'Currency:', p.currency))
   ```

**Prevention:**
- Add frontend tests for price display
- Monitor API responses
- Implement error boundaries for price components

---

### Issue 7: SNS Notifications Not Received

**Symptoms:**
- Alarms triggering (visible in CloudWatch)
- No email/SMS notifications received
- SNS topic exists

**Diagnosis:**
```bash
# Check SNS subscriptions
aws sns list-subscriptions-by-topic \
  --topic-arn <PriceSyncAlertTopicArn> \
  --profile default

# Check subscription status
# Look for "SubscriptionArn" and "Endpoint"
```

**Resolution:**
1. **Verify subscription is confirmed:**
   - Check email for confirmation link
   - Look in spam/junk folders
   - Subscription status should be "Confirmed"

2. **If not confirmed, resubscribe:**
   ```bash
   aws sns subscribe \
     --topic-arn <PriceSyncAlertTopicArn> \
     --protocol email \
     --notification-endpoint your-email@example.com \
     --profile default
   ```

3. **Test SNS topic:**
   ```bash
   aws sns publish \
     --topic-arn <PriceSyncAlertTopicArn> \
     --message "Test notification from Price Sync" \
     --subject "Price Sync Test" \
     --profile default
   ```

4. **Check SNS delivery logs:**
   - Enable SNS logging in AWS Console
   - Review CloudWatch Logs for SNS delivery status

**Prevention:**
- Confirm subscriptions immediately after setup
- Add multiple notification endpoints (email + SMS)
- Test notifications monthly

---

### Issue 8: Stale Prices (> 7 days old)

**Symptoms:**
- Products showing "Price may have changed" notice
- priceLastUpdated timestamp > 7 days ago
- Scheduled sync appears to be running

**Diagnosis:**
```bash
# Check recent sync executions
aws logs filter-log-events \
  --log-group-name /aws/lambda/pinterest-affiliate-syncAmazonPrices \
  --filter-pattern "Price sync completed" \
  --start-time $(date -d '7 days ago' +%s)000 \
  --profile default

# Check success rate
aws cloudwatch get-metric-statistics \
  --namespace PriceSync \
  --metric-name SuccessRate \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Average \
  --profile default
```

**Resolution:**
1. **Check if sync is running:**
   - Review CloudWatch logs for recent executions
   - Verify EventBridge rule is enabled

2. **Check for persistent failures:**
   - Review failure logs for specific products
   - Identify patterns (same ASINs failing?)

3. **Trigger manual sync:**
   ```bash
   aws lambda invoke \
     --function-name pinterest-affiliate-syncAmazonPrices \
     --invocation-type Event \
     --profile default \
     response.json
   ```

4. **If specific products failing:**
   - Verify ASINs are still valid on Amazon
   - Check if products are discontinued
   - Update or remove problematic products

**Prevention:**
- Monitor success rate daily
- Set up alarm for success rate < 80%
- Regularly audit old products

---

## Rollback Procedures

### Disable Price Sync

If you need to temporarily disable price sync:

```bash
# Disable EventBridge rule
aws events disable-rule \
  --name pinterest-affiliate-price-sync-daily \
  --profile default

# Verify rule is disabled
aws events describe-rule \
  --name pinterest-affiliate-price-sync-daily \
  --profile default
```

### Re-enable Price Sync

```bash
# Enable EventBridge rule
aws events enable-rule \
  --name pinterest-affiliate-price-sync-daily \
  --profile default
```

### Complete Rollback

To completely remove the price sync feature:

```bash
# Note: This will destroy the entire backend stack
cd infrastructure
npx cdk destroy PinterestAffiliateBackendStack --profile default
```

To remove only price sync resources manually:
1. Delete SNS topic: `pinterest-affiliate-price-sync-alerts`
2. Delete Parameter Store parameters under `/amazon-affiliate/pa-api/`
3. Delete Lambda function: `pinterest-affiliate-syncAmazonPrices`
4. Delete EventBridge rule: `pinterest-affiliate-price-sync-daily`

---

## Security Best Practices

1. **Credential Management**
   - Use SecureString for secret key in Parameter Store
   - Never log PA-API credentials
   - Rotate credentials every 90 days

2. **Access Control**
   - Limit Parameter Store access to Lambda execution role only
   - Use least-privilege IAM policies
   - Enable CloudTrail logging for Parameter Store access

3. **Monitoring**
   - Subscribe to SNS alerts
   - Review CloudWatch logs weekly
   - Monitor for unusual patterns

4. **Data Protection**
   - Sanitize error messages before logging
   - Don't expose ASINs or prices in public logs
   - Use VPC endpoints for Parameter Store (optional)

---

## Maintenance Schedule

### Daily
- ✅ Check CloudWatch dashboard for anomalies
- ✅ Review any alarm notifications

### Weekly
- ✅ Review CloudWatch logs for errors
- ✅ Check success rate trends
- ✅ Verify scheduled sync is running

### Monthly
- ✅ Audit product ASINs for validity
- ✅ Review Amazon Associates account status
- ✅ Check PA-API rate limit usage
- ✅ Test manual sync trigger

### Quarterly
- ✅ Rotate PA-API credentials
- ✅ Review and optimize Lambda performance
- ✅ Update documentation as needed
- ✅ Test disaster recovery procedures

---

## Additional Resources

- [PA-API Setup Guide](PA_API_SETUP.md) - Detailed PA-API credential setup
- [Infrastructure Setup](PRICE_SYNC_INFRASTRUCTURE.md) - AWS infrastructure details
- [Monitoring Guide](PRICE_SYNC_MONITORING.md) - CloudWatch monitoring setup
- [Manual Sync Guide](MANUAL_PRICE_SYNC.md) - Manual trigger documentation
- [PA-API 5.0 Documentation](https://webservices.amazon.com/paapi5/documentation/)
- [Amazon Associates Program](https://affiliate-program.amazon.com/)

---

## Support and Contact

For issues not covered in this guide:

1. Check CloudWatch Logs for detailed error messages
2. Review the [Troubleshooting](#troubleshooting) section
3. Consult the [Common Issues Runbook](#common-issues-runbook)
4. Contact AWS Support for infrastructure issues
5. Contact Amazon Associates support for PA-API issues

---

## Requirements Satisfied

This deployment guide satisfies the following requirements:

- ✅ **Requirement 2.1**: Document PA-API credential setup process
- ✅ **Requirement 2.2**: Document Parameter Store configuration
- ✅ **Requirement 3.4**: Document how to trigger manual sync
- ✅ **Requirement 8.1-8.5**: Document monitoring and troubleshooting
- ✅ **Additional**: Create runbook for common issues

---

**Document Version**: 1.0  
**Last Updated**: December 2, 2024  
**Maintained By**: Development Team
