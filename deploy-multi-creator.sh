#!/bin/bash

# Multi-Creator Platform Deployment Script
# This script handles the incremental deployment of DynamoDB GSIs and infrastructure

set -e

PROFILE="default"
REGION="us-east-1"

echo "========================================="
echo "Multi-Creator Platform Deployment"
echo "========================================="
echo ""

# Function to check GSI status
check_gsi_status() {
    local table_name=$1
    local index_name=$2
    
    status=$(/usr/local/bin/aws dynamodb describe-table \
        --table-name "$table_name" \
        --profile "$PROFILE" \
        --query "Table.GlobalSecondaryIndexes[?IndexName==\`$index_name\`].IndexStatus" \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    echo "$status"
}

# Function to wait for GSI to be ACTIVE
wait_for_gsi() {
    local table_name=$1
    local index_name=$2
    
    echo "Waiting for $index_name to become ACTIVE..."
    
    while true; do
        status=$(check_gsi_status "$table_name" "$index_name")
        
        if [ "$status" == "ACTIVE" ]; then
            echo "✓ $index_name is ACTIVE"
            break
        elif [ "$status" == "NOT_FOUND" ]; then
            echo "✗ $index_name not found"
            return 1
        else
            echo "  Status: $status (waiting...)"
            sleep 15
        fi
    done
}

# Step 1: Check authentication
echo "Step 1: Checking AWS authentication..."
if ! /usr/local/bin/aws sts get-caller-identity --profile "$PROFILE" > /dev/null 2>&1; then
    echo "✗ Not authenticated. Please run: /usr/local/bin/aws sso login --profile $PROFILE"
    exit 1
fi
echo "✓ Authenticated"
echo ""

# Step 2: Build backend
echo "Step 2: Building backend..."
cd backend
npm run build
cd ..
echo "✓ Backend built"
echo ""

# Step 3: Check existing GSIs
echo "Step 3: Checking existing GSIs on ProductsTable..."
existing_gsis=$(/usr/local/bin/aws dynamodb describe-table \
    --table-name ProductsTable \
    --profile "$PROFILE" \
    --query 'Table.GlobalSecondaryIndexes[*].IndexName' \
    --output text 2>/dev/null || echo "")

echo "Existing GSIs: $existing_gsis"
echo ""

# Step 4: Add creatorId-index if needed
if [[ ! $existing_gsis =~ "creatorId-index" ]]; then
    echo "Step 4: Adding creatorId-index..."
    /usr/local/bin/aws dynamodb update-table \
        --table-name ProductsTable \
        --attribute-definitions \
            AttributeName=creatorId,AttributeType=S \
            AttributeName=createdAt,AttributeType=S \
        --global-secondary-index-updates \
            '[{"Create":{"IndexName":"creatorId-index","KeySchema":[{"AttributeName":"creatorId","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}}]' \
        --profile "$PROFILE" > /dev/null
    
    wait_for_gsi "ProductsTable" "creatorId-index"
    echo ""
else
    status=$(check_gsi_status "ProductsTable" "creatorId-index")
    if [ "$status" == "CREATING" ]; then
        wait_for_gsi "ProductsTable" "creatorId-index"
        echo ""
    else
        echo "✓ creatorId-index already exists and is $status"
        echo ""
    fi
fi

# Step 5: Add status-index if needed
if [[ ! $existing_gsis =~ "status-index" ]]; then
    echo "Step 5: Adding status-index..."
    /usr/local/bin/aws dynamodb update-table \
        --table-name ProductsTable \
        --attribute-definitions \
            AttributeName=status,AttributeType=S \
            AttributeName=createdAt,AttributeType=S \
        --global-secondary-index-updates \
            '[{"Create":{"IndexName":"status-index","KeySchema":[{"AttributeName":"status","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}}]' \
        --profile "$PROFILE" > /dev/null
    
    wait_for_gsi "ProductsTable" "status-index"
    echo ""
else
    status=$(check_gsi_status "ProductsTable" "status-index")
    if [ "$status" == "CREATING" ]; then
        wait_for_gsi "ProductsTable" "status-index"
        echo ""
    else
        echo "✓ status-index already exists and is $status"
        echo ""
    fi
fi

# Step 6: Deploy storage stack
echo "Step 6: Deploying storage stack..."
cd infrastructure
npx cdk deploy PinterestAffiliateStorageStack --profile "$PROFILE" --require-approval never
echo "✓ Storage stack deployed"
echo ""

# Step 7: Deploy backend stack
echo "Step 7: Deploying backend stack..."
npx cdk deploy PinterestAffiliateBackendStack --profile "$PROFILE" --require-approval never
echo "✓ Backend stack deployed"
echo ""

cd ..

# Step 8: Run migration
echo "Step 8: Running data migration..."
echo "Would you like to run the data migration now? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    cd backend
    npx ts-node scripts/migrateToMultiCreator.ts
    cd ..
    echo "✓ Migration completed"
else
    echo "⚠ Skipping migration. Run manually with: cd backend && npx ts-node scripts/migrateToMultiCreator.ts"
fi
echo ""

echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Update frontend environment variables in Amplify Console"
echo "2. Deploy frontend: cd frontend && npm run build"
echo "3. Test creator registration and product creation"
echo "4. Monitor CloudWatch logs for errors"
echo ""
echo "For detailed instructions, see MULTI_CREATOR_DEPLOYMENT_GUIDE.md"
