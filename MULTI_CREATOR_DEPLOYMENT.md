# Multi-Creator Platform Deployment Guide

This guide covers the deployment of the database schema changes for the multi-creator platform feature.

## Overview

Task 1 of the multi-creator platform implementation adds:
- **CreatorsTable**: Stores creator profiles with slug and userId indexes
- **AnalyticsEventsTable**: Tracks page views and clicks with TTL
- **AnalyticsSummariesTable**: Stores aggregated analytics data
- **Products table updates**: New GSIs for creatorId and status fields
- **Migration script**: Backfills existing data with default creator

## Prerequisites

1. **AWS SSO configured** (see aws-sso-config.md)
2. **AWS CLI v2** installed and authenticated
3. **Node.js 18+** installed
4. **Existing infrastructure** deployed (ProductsTable, Cognito, etc.)

## Deployment Steps

### Step 1: Authenticate with AWS

```bash
/usr/local/bin/aws sso login --profile default
```

Verify authentication:
```bash
aws sts get-caller-identity --profile default
```

### Step 2: Build the Infrastructure Code

```bash
cd infrastructure
npm install  # If not already done
npm run build
```

### Step 3: Review Infrastructure Changes

Preview the changes that will be deployed:

```bash
npx cdk diff --all --profile default
```

Expected changes:
- **New DynamoDB Tables**:
  - CreatorsTable (with slug-index and userId-index GSIs)
  - AnalyticsEventsTable (with TTL attribute)
  - AnalyticsSummariesTable
  
- **Updated ProductsTable**:
  - New GSI: creatorId-index (partition: creatorId, sort: createdAt)
  - New GSI: status-index (partition: status, sort: createdAt)
  
- **Lambda Environment Variables**:
  - CREATORS_TABLE_NAME
  - ANALYTICS_EVENTS_TABLE_NAME
  - ANALYTICS_SUMMARIES_TABLE_NAME

### Step 4: Deploy the Storage Stack

Deploy only the storage stack first to create the new tables:

```bash
npx cdk deploy PinterestAffiliateStorageStack --profile default
```

**Important**: Review the changes carefully before confirming. The deployment will:
- Create 3 new DynamoDB tables
- Add 2 new GSIs to the existing ProductsTable
- Update CloudFormation outputs

**Note**: Adding GSIs to an existing table can take several minutes. DynamoDB will backfill the indexes with existing data.

### Step 5: Wait for GSI Creation

After deployment, wait for the new GSIs to become active:

```bash
# Check ProductsTable GSI status
aws dynamodb describe-table \
  --table-name ProductsTable \
  --profile default \
  --query 'Table.GlobalSecondaryIndexes[*].[IndexName,IndexStatus]' \
  --output table
```

Wait until all indexes show `ACTIVE` status before proceeding.

### Step 6: Deploy the Backend Stack

Once the storage stack is deployed and GSIs are active, deploy the backend:

```bash
npx cdk deploy PinterestAffiliateBackendStack --profile default
```

This will:
- Update Lambda environment variables with new table names
- Grant Lambda permissions to access new tables
- No downtime expected for existing functionality

### Step 7: Run the Data Migration

After infrastructure is deployed, run the migration script:

```bash
cd backend
npm run migrate
```

The migration will:
1. Create a default creator account for "jesskoufo"
2. Backfill all existing products with the creator's ID
3. Set featured=false and status='approved' for all products
4. Verify data integrity

Expected output:
```
============================================================
Multi-Creator Platform Migration
============================================================

Step 1: Creating default creator account...
✓ Created default creator with ID: <uuid>
  - Slug: jesskoufo
  - Display Name: Jess Koufo

Step 2: Backfilling products with creator data...
  Processing batch of X products...
  ✓ Updated 10 products so far...
  ✓ Updated 20 products so far...

✓ Product backfill complete:
  - Total processed: X
  - Updated: X
  - Skipped (already migrated): 0

Step 3: Verifying data integrity...
✓ Creator exists in database

✓ Data integrity check complete:
  - Products with creatorId: X
  - Products without creatorId: 0

✓ All products have been successfully migrated!

============================================================
Migration completed successfully!
============================================================
```

### Step 8: Post-Migration Configuration

#### 8.1 Create Creators Group in Cognito

```bash
# Get User Pool ID from CloudFormation outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name PinterestAffiliateStorageStack \
  --profile default \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

# Create Creators group
aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name Creators \
  --description "Content creators with product management access" \
  --precedence 10 \
  --profile default
```

#### 8.2 Add jesskoufo to Creators Group

```bash
# Add existing user to Creators group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username jesskoufo \
  --group-name Creators \
  --profile default
```

#### 8.3 Update Creator Record with Cognito User ID

```bash
# Get the Cognito user ID
COGNITO_USER_ID=$(aws cognito-idp admin-get-user \
  --user-pool-id $USER_POOL_ID \
  --username jesskoufo \
  --profile default \
  --query 'Username' \
  --output text)

# Get the creator ID from the migration output or query DynamoDB
CREATOR_ID=$(aws dynamodb scan \
  --table-name CreatorsTable \
  --filter-expression "slug = :slug" \
  --expression-attribute-values '{":slug":{"S":"jesskoufo"}}' \
  --profile default \
  --query 'Items[0].id.S' \
  --output text)

# Update the creator record with the correct userId
aws dynamodb update-item \
  --table-name CreatorsTable \
  --key "{\"id\":{\"S\":\"$CREATOR_ID\"}}" \
  --update-expression "SET userId = :userId" \
  --expression-attribute-values "{\":userId\":{\"S\":\"$COGNITO_USER_ID\"}}" \
  --profile default
```

## Verification

### Verify Tables Created

```bash
# List all tables
aws dynamodb list-tables --profile default

# Check CreatorsTable
aws dynamodb describe-table \
  --table-name CreatorsTable \
  --profile default \
  --query 'Table.[TableName,TableStatus,GlobalSecondaryIndexes[*].IndexName]'

# Check AnalyticsEventsTable
aws dynamodb describe-table \
  --table-name AnalyticsEventsTable \
  --profile default \
  --query 'Table.[TableName,TableStatus,TimeToLiveDescription]'

# Check AnalyticsSummariesTable
aws dynamodb describe-table \
  --table-name AnalyticsSummariesTable \
  --profile default \
  --query 'Table.[TableName,TableStatus]'
```

### Verify Creator Record

```bash
# Query creator by slug
aws dynamodb query \
  --table-name CreatorsTable \
  --index-name slug-index \
  --key-condition-expression "slug = :slug" \
  --expression-attribute-values '{":slug":{"S":"jesskoufo"}}' \
  --profile default
```

### Verify Products Have CreatorId

```bash
# Sample a few products to verify migration
aws dynamodb scan \
  --table-name ProductsTable \
  --max-items 5 \
  --profile default \
  --query 'Items[*].[id.S,creatorId.S,featured.BOOL,status.S]' \
  --output table
```

### Verify Lambda Environment Variables

```bash
# Check one of the Lambda functions
aws lambda get-function-configuration \
  --function-name pinterest-affiliate-getProducts \
  --profile default \
  --query 'Environment.Variables' \
  --output json
```

Expected environment variables should include:
- `CREATORS_TABLE_NAME`
- `ANALYTICS_EVENTS_TABLE_NAME`
- `ANALYTICS_SUMMARIES_TABLE_NAME`

## Rollback Procedure

If you need to rollback the deployment:

### Option 1: Rollback via CDK (Recommended)

```bash
# Revert to previous git commit
git checkout <previous-commit>

# Rebuild and deploy
cd infrastructure
npm run build
npx cdk deploy --all --profile default
```

### Option 2: Manual Cleanup

```bash
# Delete new tables (WARNING: This will delete all data)
aws dynamodb delete-table --table-name CreatorsTable --profile default
aws dynamodb delete-table --table-name AnalyticsEventsTable --profile default
aws dynamodb delete-table --table-name AnalyticsSummariesTable --profile default

# Note: GSIs cannot be easily removed without downtime
# Consider keeping them as they don't affect existing functionality
```

## Monitoring

After deployment, monitor:

1. **CloudWatch Metrics**:
   - DynamoDB table metrics (read/write capacity, throttles)
   - Lambda execution metrics
   - API Gateway metrics

2. **CloudWatch Logs**:
   - Lambda function logs for errors
   - Migration script output

3. **DynamoDB Console**:
   - Table item counts
   - GSI status
   - Consumed capacity

## Cost Implications

The new infrastructure will incur additional costs:

- **3 new DynamoDB tables**: Pay-per-request billing
- **2 new GSIs on ProductsTable**: Included in table costs
- **Storage**: Minimal for creator profiles, grows with analytics data
- **TTL**: No additional cost (automatic cleanup after 90 days)

Estimated monthly cost increase: $5-20 depending on usage

## Troubleshooting

### GSI Creation Stuck

If GSI creation takes longer than 30 minutes:
```bash
# Check GSI status
aws dynamodb describe-table \
  --table-name ProductsTable \
  --profile default \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`creatorId-index`].IndexStatus'
```

### Migration Script Fails

Check the error message and:
1. Verify table names in environment variables
2. Ensure AWS credentials have DynamoDB permissions
3. Check CloudWatch Logs for detailed errors
4. Re-run the migration (it's idempotent)

### Lambda Functions Can't Access New Tables

Verify IAM permissions:
```bash
# Check Lambda execution role
aws iam get-role-policy \
  --role-name <LambdaExecutionRole> \
  --policy-name <PolicyName> \
  --profile default
```

## Next Steps

After successful deployment:

1. **Proceed to Task 2**: Backend creator service implementation
2. **Test creator landing page**: Once frontend is deployed
3. **Monitor analytics**: Ensure tracking is working
4. **Update documentation**: Add creator onboarding guide

## Support

For issues or questions:
- Check CloudWatch Logs for detailed error messages
- Review the MIGRATION_GUIDE.md in backend/scripts/
- Verify all prerequisites are met
- Ensure AWS credentials have sufficient permissions
