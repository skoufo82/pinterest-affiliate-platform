# Amazon Price Sync Infrastructure Setup

This document summarizes the AWS infrastructure changes made to support the Amazon Price Sync feature.

## Infrastructure Changes

### 1. SNS Topic for Alerts

Created an SNS topic for price sync alerts:
- **Topic Name**: `pinterest-affiliate-price-sync-alerts`
- **Display Name**: Amazon Price Sync Alerts
- **Purpose**: Receive notifications when critical errors occur during price synchronization

### 2. Parameter Store Parameters

Created four Parameter Store parameters for PA-API credentials:

| Parameter Name | Description | Default Value |
|---------------|-------------|---------------|
| `/amazon-affiliate/pa-api/access-key` | PA-API Access Key | PLACEHOLDER_ACCESS_KEY |
| `/amazon-affiliate/pa-api/secret-key` | PA-API Secret Key | PLACEHOLDER_SECRET_KEY |
| `/amazon-affiliate/pa-api/partner-tag` | Amazon Associates Tag | PLACEHOLDER_PARTNER_TAG |
| `/amazon-affiliate/pa-api/marketplace` | Amazon Marketplace | www.amazon.com |

**Important**: The placeholder values must be replaced with actual credentials before the price sync feature can work. See `PA_API_SETUP.md` for detailed instructions.

### 3. IAM Permissions

Added the following permissions to the Lambda execution role:

#### Parameter Store Access
```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameter",
    "ssm:GetParameters"
  ],
  "Resource": "arn:aws:ssm:us-east-1:788222620487:parameter/amazon-affiliate/*"
}
```

#### SNS Publish Access
```json
{
  "Effect": "Allow",
  "Action": "sns:Publish",
  "Resource": "<PriceSyncAlertTopicArn>"
}
```

#### CloudWatch Metrics Access
```json
{
  "Effect": "Allow",
  "Action": "cloudwatch:PutMetricData",
  "Resource": "*"
}
```

### 4. Price Sync Lambda Function

Created a dedicated Lambda function for price synchronization:
- **Function Name**: `pinterest-affiliate-syncAmazonPrices`
- **Handler**: `functions/syncAmazonPrices/index.handler`
- **Timeout**: 10 minutes (for batch processing)
- **Memory**: 1024 MB
- **Description**: Synchronize product prices with Amazon PA-API
- **Environment Variables**:
  - `PRODUCTS_TABLE_NAME`: DynamoDB products table
  - `SNS_TOPIC_ARN`: Price sync alert topic ARN
  - `REGION`: AWS region

### 5. EventBridge Scheduled Rule

Created an EventBridge rule to trigger price sync daily:
- **Rule Name**: `pinterest-affiliate-price-sync-daily`
- **Schedule**: Daily at 2:00 AM UTC (cron: 0 2 * * ? *)
- **Target**: Price Sync Lambda function
- **Retry Policy**: 2 retries with exponential backoff
- **Max Event Age**: 2 hours
- **Status**: Enabled

### 6. CloudFormation Outputs

Added the following outputs to the backend stack:

- **PriceSyncAlertTopicArn**: ARN of the SNS topic for alerts
- **PAAPIParametersPrefix**: Parameter Store prefix for PA-API credentials
- **PriceSyncLambdaArn**: ARN of the Price Sync Lambda function
- **PriceSyncLambdaName**: Name of the Price Sync Lambda function
- **PriceSyncRuleArn**: ARN of the EventBridge rule
- **PriceSyncRuleName**: Name of the EventBridge rule
- **PriceSyncSchedule**: Human-readable schedule description

## Deployment Instructions

### Prerequisites

1. Ensure AWS SSO is configured (see `aws-sso-config.md`)
2. Build the backend code:
   ```bash
   cd backend
   npm run build
   ```

### Deploy Infrastructure

```bash
cd infrastructure
npx cdk deploy PinterestAffiliateBackendStack --profile default
```

### Post-Deployment Steps

1. **Set PA-API Credentials**
   
   Follow the instructions in `PA_API_SETUP.md` to set your actual PA-API credentials in Parameter Store.

2. **Subscribe to SNS Alerts**
   
   Subscribe to the SNS topic to receive price sync alerts:
   ```bash
   aws sns subscribe \
     --topic-arn <PriceSyncAlertTopicArn> \
     --protocol email \
     --notification-endpoint your-email@example.com \
     --profile default
   ```
   
   Confirm the subscription by clicking the link in the confirmation email.

3. **Verify Parameter Store Access**
   
   Test that the Lambda role can access the parameters:
   ```bash
   aws ssm get-parameters-by-path \
     --path "/amazon-affiliate/pa-api/" \
     --profile default
   ```

## Verification

After deployment, verify the following resources were created:

1. **SNS Topic**: Check in AWS SNS Console
   ```bash
   aws sns list-topics --profile default | grep price-sync-alerts
   ```

2. **Parameter Store Parameters**: Check in AWS Systems Manager Console
   ```bash
   aws ssm describe-parameters \
     --parameter-filters "Key=Name,Option=BeginsWith,Values=/amazon-affiliate/pa-api/" \
     --profile default
   ```

3. **Price Sync Lambda Function**: Verify the function was created
   ```bash
   aws lambda get-function \
     --function-name pinterest-affiliate-syncAmazonPrices \
     --profile default
   ```

4. **EventBridge Rule**: Verify the scheduled rule was created
   ```bash
   aws events describe-rule \
     --name pinterest-affiliate-price-sync-daily \
     --profile default
   ```

5. **IAM Permissions**: Verify the Lambda execution role has the required permissions
   ```bash
   aws iam get-role-policy \
     --role-name <LambdaExecutionRoleName> \
     --policy-name LambdaExecutionRoleDefaultPolicy \
     --profile default
   ```

## Testing the Price Sync

### Manual Trigger

You can manually trigger the price sync Lambda for testing:

```bash
aws lambda invoke \
  --function-name pinterest-affiliate-syncAmazonPrices \
  --payload '{"source":"manual","time":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","id":"manual-test"}' \
  --profile default \
  response.json

cat response.json
```

### View Execution Logs

Check CloudWatch Logs for execution details:

```bash
aws logs tail /aws/lambda/pinterest-affiliate-syncAmazonPrices \
  --follow \
  --profile default
```

### Disable/Enable Scheduled Execution

To temporarily disable the scheduled execution:

```bash
aws events disable-rule \
  --name pinterest-affiliate-price-sync-daily \
  --profile default
```

To re-enable:

```bash
aws events enable-rule \
  --name pinterest-affiliate-price-sync-daily \
  --profile default
```

## Next Steps

After completing this infrastructure setup:

1. Set actual PA-API credentials (see `PA_API_SETUP.md`)
2. Deploy the infrastructure to AWS
3. Test the price sync manually
4. Monitor CloudWatch Logs and Metrics
5. Subscribe to SNS alerts

## Rollback

If you need to rollback these changes:

```bash
# Note: This will destroy the entire backend stack
cd infrastructure
npx cdk destroy PinterestAffiliateBackendStack --profile default
```

To remove only the price sync resources, manually delete:
- SNS Topic: `pinterest-affiliate-price-sync-alerts`
- Parameter Store parameters under `/amazon-affiliate/pa-api/`

## Cost Considerations

- **SNS**: Free tier includes 1,000 email notifications per month
- **Parameter Store**: Standard parameters are free
- **CloudWatch Metrics**: First 10 custom metrics are free
- **Lambda**: Existing Lambda execution role, no additional cost

## Security Notes

1. Parameter Store parameters are created as `String` type by default
2. Consider changing the secret key parameter to `SecureString` type for encryption
3. Never commit actual credentials to version control
4. Rotate PA-API credentials periodically
5. Monitor Parameter Store access via CloudTrail

## Troubleshooting

### Parameter Store Access Denied

If Lambda functions cannot access Parameter Store:
1. Verify the IAM role has `ssm:GetParameter` permission
2. Check the resource ARN matches the parameter path
3. Ensure the AWS region is correct

### SNS Notifications Not Received

If you're not receiving SNS notifications:
1. Verify you confirmed the subscription
2. Check spam/junk folders
3. Verify the topic ARN is correct
4. Check CloudWatch Logs for SNS publish errors

### CloudWatch Metrics Not Appearing

If custom metrics don't appear:
1. Wait up to 15 minutes for metrics to appear
2. Verify the Lambda role has `cloudwatch:PutMetricData` permission
3. Check CloudWatch Logs for errors

### EventBridge Rule Not Triggering

If the scheduled rule is not triggering the Lambda:
1. Verify the rule is enabled: `aws events describe-rule --name pinterest-affiliate-price-sync-daily --profile default`
2. Check the Lambda has permission to be invoked by EventBridge
3. Review CloudWatch Logs for any invocation errors
4. Verify the cron expression is correct (0 2 * * ? * = 2 AM UTC daily)

### Lambda Timeout

If the Lambda times out during execution:
1. Check CloudWatch Logs for the last processed batch
2. Consider increasing the timeout (currently 10 minutes)
3. Verify the PA-API is responding within expected timeframes
4. Check if rate limiting is causing delays
