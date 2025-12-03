# Enable Price Sync - Quick Reference

This guide provides the exact steps to enable automated price syncing once you have PA-API credentials.

## Prerequisites

✅ Amazon Associates account approved  
✅ PA-API access granted  
✅ PA-API credentials obtained (Access Key, Secret Key, Partner Tag)

## Step 1: Update PA-API Credentials

```bash
# Update Access Key
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/access-key" \
  --value "YOUR_ACTUAL_ACCESS_KEY" \
  --type "SecureString" \
  --overwrite \
  --profile default \
  --region us-east-1

# Update Secret Key
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/secret-key" \
  --value "YOUR_ACTUAL_SECRET_KEY" \
  --type "SecureString" \
  --overwrite \
  --profile default \
  --region us-east-1

# Update Partner Tag (your Amazon Associates tracking ID)
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/partner-tag" \
  --value "YOUR_ACTUAL_PARTNER_TAG" \
  --type "String" \
  --overwrite \
  --profile default \
  --region us-east-1
```

## Step 2: Verify Credentials

```bash
# Check that credentials are set (values will be hidden for SecureString)
aws ssm get-parameters \
  --names "/amazon-affiliate/pa-api/access-key" \
         "/amazon-affiliate/pa-api/secret-key" \
         "/amazon-affiliate/pa-api/partner-tag" \
         "/amazon-affiliate/pa-api/marketplace" \
  --profile default \
  --region us-east-1 \
  --query "Parameters[*].[Name,Value]" \
  --output table
```

## Step 3: Test Manual Sync

Before enabling the scheduled sync, test manually:

```bash
# Option A: Via AWS CLI (invoke Lambda directly)
aws lambda invoke \
  --function-name pinterest-affiliate-syncAmazonPrices \
  --profile default \
  --region us-east-1 \
  --log-type Tail \
  response.json

# View the response
cat response.json

# Option B: Via Admin Panel
# 1. Log into your admin panel
# 2. Navigate to Dashboard or Sync History
# 3. Click "Trigger Manual Sync" button
```

## Step 4: Check CloudWatch Logs

```bash
# View recent logs
aws logs tail /aws/lambda/pinterest-affiliate-syncAmazonPrices \
  --follow \
  --profile default \
  --region us-east-1

# Or view in AWS Console:
# https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fpinterest-affiliate-syncAmazonPrices
```

## Step 5: Verify Results

Check that prices were updated:
1. Log into admin panel
2. View products list
3. Check "Price Last Updated" timestamps
4. Verify "Price Sync Status" shows "success"

## Step 6: Enable Scheduled Sync

Once manual sync works successfully:

```bash
# Enable the EventBridge rule
aws events enable-rule \
  --name pinterest-affiliate-price-sync-daily \
  --profile default \
  --region us-east-1

# Verify it's enabled
aws events describe-rule \
  --name pinterest-affiliate-price-sync-daily \
  --profile default \
  --region us-east-1 \
  --query "State" \
  --output text
```

Expected output: `ENABLED`

## Step 7: Monitor First Scheduled Execution

The sync runs daily at 2:00 AM UTC. After the first scheduled run:

1. **Check CloudWatch Dashboard:**
   https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=PinterestAffiliate-PriceSync

2. **Review Metrics:**
   - Success Count
   - Failure Count
   - Duration
   - API Call Count

3. **Check Alarms:**
   ```bash
   aws cloudwatch describe-alarms \
     --alarm-names "PriceSync-HighFailureRate" \
                   "PriceSync-AuthenticationError" \
                   "PriceSync-LongExecution" \
     --profile default \
     --region us-east-1 \
     --query "MetricAlarms[*].[AlarmName,StateValue]" \
     --output table
   ```

## Step 8: Configure Alerts (Optional)

Subscribe to SNS notifications for critical errors:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:788222620487:pinterest-affiliate-price-sync-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --profile default \
  --region us-east-1
```

You'll receive a confirmation email - click the link to confirm subscription.

## Troubleshooting

### Authentication Errors

If you see 401 errors:
- Verify credentials are correct in Parameter Store
- Check that your PA-API access is approved
- Ensure your Amazon Associates account is in good standing

### Rate Limit Errors

If you see 429 errors:
- This is normal for large product catalogs
- The system will automatically retry with backoff
- Consider requesting higher rate limits from Amazon

### Products Not Updating

If prices aren't updating:
- Check that products have valid Amazon URLs
- Verify ASINs are being extracted correctly
- Check CloudWatch logs for specific errors
- Ensure products exist on Amazon

## Quick Commands Reference

```bash
# Check rule status
aws events describe-rule --name pinterest-affiliate-price-sync-daily --profile default --region us-east-1

# Enable rule
aws events enable-rule --name pinterest-affiliate-price-sync-daily --profile default --region us-east-1

# Disable rule
aws events disable-rule --name pinterest-affiliate-price-sync-daily --profile default --region us-east-1

# View logs
aws logs tail /aws/lambda/pinterest-affiliate-syncAmazonPrices --follow --profile default --region us-east-1

# Trigger manual sync
aws lambda invoke --function-name pinterest-affiliate-syncAmazonPrices --profile default --region us-east-1 response.json

# Check alarms
aws cloudwatch describe-alarms --alarm-names "PriceSync-HighFailureRate" "PriceSync-AuthenticationError" "PriceSync-LongExecution" --profile default --region us-east-1
```

## Documentation

- **PA-API Setup:** `PA_API_SETUP.md`
- **Deployment Status:** `PRICE_SYNC_DEPLOYMENT_STATUS.md`
- **Manual Sync Guide:** `MANUAL_PRICE_SYNC.md`
- **Monitoring Guide:** `PRICE_SYNC_MONITORING.md`
- **Error Handling:** `backend/shared/ERROR_HANDLING.md`

---

**You're all set!** Once you complete these steps, your prices will automatically sync daily at 2 AM UTC. 🚀
