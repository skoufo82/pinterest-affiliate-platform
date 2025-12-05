# Multi-Creator Platform Deployment Guide

This guide walks through deploying the multi-creator platform infrastructure and running the data migration.

## Prerequisites

- AWS CLI v2 configured with SSO
- Node.js and npm installed
- Backend code built (`npm run build` in backend directory)
- AWS account with appropriate permissions

## Deployment Overview

The deployment consists of:
1. DynamoDB table updates (new tables and GSIs)
2. Lambda function updates
3. API Gateway updates
4. Data migration script
5. Frontend deployment

## Important: DynamoDB GSI Limitation

**DynamoDB only allows adding ONE Global Secondary Index (GSI) per update operation.**

Since we're adding multiple GSIs to the Products table, we need to deploy them incrementally.

## Step-by-Step Deployment

### Step 1: Authenticate with AWS

```bash
/usr/local/bin/aws sso login --profile default
```

Verify authentication:

```bash
/usr/local/bin/aws sts get-caller-identity --profile default
```

### Step 2: Build Backend

```bash
cd backend
npm run build
cd ..
```

### Step 3: Deploy Storage Stack (First Pass - New Tables)

The first deployment will create the new tables (Creators, AnalyticsEvents, AnalyticsSummaries) and attempt to add GSIs to Products table.

```bash
cd infrastructure
npx cdk deploy PinterestAffiliateStorageStack --profile default
```

**Expected Result**: This may fail with "Cannot perform more than one GSI creation" error. This is expected if multiple GSIs are being added.

### Step 4: Manual GSI Deployment (If Needed)

If the deployment failed due to multiple GSI additions, we need to add them one at a time using AWS CLI:

#### Check Current GSIs

```bash
aws dynamodb describe-table \
  --table-name ProductsTable \
  --profile default \
  --query 'Table.GlobalSecondaryIndexes[*].IndexName'
```

#### Add creatorId-index (if not exists)

```bash
aws dynamodb update-table \
  --table-name ProductsTable \
  --attribute-definitions \
    AttributeName=creatorId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"creatorId-index\",\"KeySchema\":[{\"AttributeName\":\"creatorId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"createdAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
  --profile default
```

Wait for index to be ACTIVE (check status):

```bash
aws dynamodb describe-table \
  --table-name ProductsTable \
  --profile default \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`creatorId-index`].IndexStatus'
```

#### Add status-index (if not exists)

```bash
aws dynamodb update-table \
  --table-name ProductsTable \
  --attribute-definitions \
    AttributeName=status,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"status-index\",\"KeySchema\":[{\"AttributeName\":\"status\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"createdAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
  --profile default
```

Wait for index to be ACTIVE.

### Step 5: Deploy Backend Stack

Once all GSIs are created, deploy the backend Lambda functions:

```bash
npx cdk deploy PinterestAffiliateBackendStack --profile default
```

This will:
- Create/update all Lambda functions
- Update API Gateway routes
- Configure IAM permissions

### Step 6: Run Data Migration

After infrastructure is deployed, run the migration script to:
- Create default creator account
- Backfill existing products with creatorId
- Set default status and featured flags

```bash
cd ../backend
npx ts-node scripts/migrateToMultiCreator.ts
```

**What the migration does**:
1. Creates a "platform" creator account (or uses existing "jesskoufo")
2. Updates all existing products to assign them to this creator
3. Sets `status: 'approved'` for all existing products
4. Sets `featured: false` for all existing products
5. Verifies data integrity

### Step 7: Verify Migration

Check that products were migrated successfully:

```bash
aws dynamodb scan \
  --table-name ProductsTable \
  --profile default \
  --select COUNT
```

Check that creators table has entries:

```bash
aws dynamodb scan \
  --table-name CreatorsTable \
  --profile default
```

### Step 8: Deploy Frontend

Build and deploy the frontend application:

```bash
cd ../frontend
npm run build
```

The frontend will be deployed via AWS Amplify automatically on git push, or manually:

```bash
# If using Amplify CLI
amplify publish
```

### Step 9: Update Environment Variables

Update frontend environment variables in Amplify Console:

1. Go to AWS Amplify Console
2. Select your app
3. Go to "Environment variables"
4. Add/update:
   - `VITE_API_URL`: Your API Gateway URL
   - `VITE_USER_POOL_ID`: Cognito User Pool ID
   - `VITE_USER_POOL_CLIENT_ID`: Cognito User Pool Client ID
   - `VITE_IMAGES_CDN_URL`: CloudFront CDN URL

Get these values from CDK outputs:

```bash
cd infrastructure
npx cdk deploy --outputs-file outputs.json --profile default
cat outputs.json
```

### Step 10: Test in Production

1. **Test Creator Registration**:
   - Navigate to `/creator-signup`
   - Register a new creator account
   - Verify email and login

2. **Test Creator Profile**:
   - Update profile information
   - Upload images
   - Customize theme

3. **Test Product Creation**:
   - Create a new product
   - Verify it shows as "pending"
   - Check admin moderation panel

4. **Test Admin Approval**:
   - Login as admin
   - Navigate to moderation panel
   - Approve the pending product
   - Verify it appears on creator's landing page

5. **Test Creator Landing Page**:
   - Navigate to `/creator/{slug}`
   - Verify profile displays correctly
   - Verify products are shown
   - Test category filtering
   - Test search functionality

6. **Test Analytics**:
   - Visit creator landing page
   - Click affiliate links
   - Check analytics dashboard for data

## Rollback Plan

If issues occur, you can rollback:

### Rollback Infrastructure

```bash
cd infrastructure
npx cdk deploy --profile default --rollback
```

### Rollback Frontend

In Amplify Console:
1. Go to your app
2. Click on a previous successful deployment
3. Click "Redeploy this version"

### Rollback Database Changes

Database changes are additive (new tables, new fields, new GSIs). They don't break existing functionality. However, if you need to revert:

1. The migration script does NOT delete data
2. Old products still work with the original schema
3. New fields (creatorId, status, featured) are optional in queries

## Monitoring

### CloudWatch Logs

Monitor Lambda function logs:

```bash
aws logs tail /aws/lambda/pinterest-affiliate-createCreator --follow --profile default
```

### DynamoDB Metrics

Check DynamoDB metrics in CloudWatch:
- Read/Write capacity usage
- Throttled requests
- GSI status

### API Gateway Metrics

Monitor API Gateway:
- Request count
- Error rates (4xx, 5xx)
- Latency (p50, p95, p99)

## Troubleshooting

### GSI Creation Failed

**Error**: "Cannot perform more than one GSI creation"

**Solution**: Add GSIs one at a time using AWS CLI (see Step 4)

### Migration Script Fails

**Error**: "Creator already exists"

**Solution**: This is expected if re-running. The script is idempotent.

**Error**: "Products table not found"

**Solution**: Ensure storage stack deployed successfully first.

### Lambda Function Errors

**Error**: "Cannot read property 'creatorId' of undefined"

**Solution**: Ensure migration script ran successfully to backfill creatorId.

### Frontend Not Loading

**Error**: "API endpoint not found"

**Solution**: Check environment variables in Amplify Console.

### Authentication Errors

**Error**: "User pool not found"

**Solution**: Verify Cognito User Pool ID in environment variables.

## Post-Deployment Tasks

1. **Create Admin Users**:
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <USER_POOL_ID> \
     --username admin \
     --user-attributes Name=email,Value=admin@example.com \
     --profile default
   ```

2. **Add Users to Admin Group**:
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <USER_POOL_ID> \
     --username admin \
     --group-name Admins \
     --profile default
   ```

3. **Test Email Notifications**:
   - Verify SES is configured
   - Test approval/rejection emails
   - Check spam folders

4. **Set Up Monitoring Alerts**:
   - CloudWatch alarms for Lambda errors
   - DynamoDB throttling alerts
   - API Gateway error rate alerts

5. **Update Documentation**:
   - Share creator onboarding guide
   - Update API documentation
   - Create internal runbooks

## Success Criteria

Deployment is successful when:

- ✅ All DynamoDB tables exist with correct GSIs
- ✅ All Lambda functions deployed and accessible
- ✅ API Gateway routes responding correctly
- ✅ Migration script completed without errors
- ✅ Frontend deployed and accessible
- ✅ Creator registration works
- ✅ Product creation and approval workflow works
- ✅ Creator landing pages display correctly
- ✅ Analytics tracking works
- ✅ No errors in CloudWatch logs

## Support

For deployment issues:
1. Check CloudWatch logs for specific errors
2. Review CDK deployment output
3. Verify AWS credentials and permissions
4. Contact DevOps team if issues persist

## Next Steps

After successful deployment:
1. Announce new creator features
2. Invite beta creators to test
3. Monitor performance and errors
4. Gather feedback for improvements
5. Plan next feature releases

