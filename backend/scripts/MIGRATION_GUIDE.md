# Multi-Creator Platform Migration Guide

This guide explains how to migrate the existing single-creator Pinterest Affiliate Platform to the new multi-creator platform.

## Overview

The migration script (`migrateToMultiCreator.ts`) performs the following operations:

1. **Creates a default creator account** for "jesskoufo" (the existing platform owner)
2. **Backfills all existing products** with the creator's ID
3. **Sets default values** for new fields (featured=false, status='approved')
4. **Verifies data integrity** to ensure all products have been migrated correctly

## Prerequisites

Before running the migration:

1. **Deploy the new infrastructure** with the updated DynamoDB tables:
   ```bash
   cd infrastructure
   npm run build
   npx cdk deploy --all --profile default
   ```

2. **Ensure AWS credentials are configured** with access to DynamoDB tables

3. **Build the backend code**:
   ```bash
   cd backend
   npm run build
   ```

## Running the Migration

### Option 1: Using npm script (Recommended)

```bash
cd backend
npm run migrate
```

### Option 2: Direct execution

```bash
cd backend
tsx scripts/migrateToMultiCreator.ts
```

### Option 3: With custom environment variables

```bash
cd backend
CREATORS_TABLE_NAME=CreatorsTable \
PRODUCTS_TABLE_NAME=ProductsTable \
REGION=us-east-1 \
npm run migrate
```

## What the Migration Does

### Step 1: Create Default Creator

Creates a creator record with:
- **ID**: Auto-generated UUID
- **Slug**: `jesskoufo`
- **Display Name**: `Jess Koufo`
- **Status**: `active`
- **Default theme**: Black primary color, red accent

### Step 2: Backfill Products

For each existing product:
- Adds `creatorId` field pointing to the default creator
- Sets `featured` to `false`
- Sets `status` to `approved` (so products remain visible)
- Updates `updatedAt` timestamp

### Step 3: Verify Data Integrity

Checks:
- Creator exists in the database
- All products have a `creatorId`
- Reports any products missing the creator field

## Post-Migration Steps

After running the migration successfully:

1. **Update the creator's userId in DynamoDB**:
   - Get the actual Cognito user ID for jesskoufo
   - Update the creator record with the correct userId

2. **Add creator role to Cognito user**:
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <USER_POOL_ID> \
     --username jesskoufo \
     --group-name Creators \
     --profile default
   ```

3. **Create the Creators group in Cognito** (if it doesn't exist):
   ```bash
   aws cognito-idp create-group \
     --user-pool-id <USER_POOL_ID> \
     --group-name Creators \
     --description "Content creators with product management access" \
     --profile default
   ```

4. **Test the creator landing page**:
   - Visit `/creator/jesskoufo` on your frontend
   - Verify all products are displayed
   - Test product management features

5. **Update creator profile**:
   - Log in as jesskoufo
   - Navigate to profile settings
   - Add profile image, cover image, bio, and social links

## Rollback

If you need to rollback the migration:

1. **Remove creator fields from products**:
   ```bash
   # This would require a custom script to remove the fields
   # Not recommended unless absolutely necessary
   ```

2. **Delete the creator record**:
   ```bash
   aws dynamodb delete-item \
     --table-name CreatorsTable \
     --key '{"id": {"S": "<CREATOR_ID>"}}' \
     --profile default
   ```

## Troubleshooting

### Migration fails with "Table not found"

**Solution**: Ensure the new tables have been deployed:
```bash
cd infrastructure
npx cdk deploy PinterestAffiliateStorageStack --profile default
```

### Some products missing creatorId after migration

**Solution**: Run the migration script again. It will skip products that already have a creatorId and only update the missing ones.

### Creator already exists error

**Solution**: The script checks for existing creators and will skip creation if one already exists. This is safe and expected on subsequent runs.

## Monitoring

After migration, monitor:

1. **Product visibility**: Ensure all products are still visible on the platform
2. **Creator landing page**: Verify `/creator/jesskoufo` loads correctly
3. **Product management**: Test CRUD operations work as expected
4. **Analytics**: Check that analytics tracking is working

## Support

If you encounter issues during migration:

1. Check CloudWatch Logs for error details
2. Verify DynamoDB table permissions
3. Ensure AWS credentials have sufficient permissions
4. Review the migration script output for specific error messages

## Migration Checklist

- [ ] Infrastructure deployed with new tables
- [ ] Backend code built
- [ ] Migration script executed successfully
- [ ] Creator userId updated in DynamoDB
- [ ] Creator role added to Cognito user
- [ ] Creators group created in Cognito
- [ ] Creator landing page tested
- [ ] Product management tested
- [ ] Creator profile updated with images and bio
- [ ] Analytics tracking verified
