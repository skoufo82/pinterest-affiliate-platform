#!/usr/bin/env node
/**
 * Migration Script: Transform single-creator platform to multi-creator platform
 * 
 * This script:
 * 1. Creates a default creator account for "jesskoufo" (existing user)
 * 2. Backfills all existing products with jesskoufo's creatorId
 * 3. Sets featured=false and status='approved' for existing products
 * 4. Verifies data integrity after migration
 * 
 * Requirements: 15.1, 15.2
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  UpdateCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const CREATORS_TABLE = process.env.CREATORS_TABLE_NAME || 'CreatorsTable';
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME || 'ProductsTable';

// Default creator configuration
const DEFAULT_CREATOR = {
  id: uuidv4(),
  userId: 'jesskoufo-user-id', // This should match the Cognito user ID
  slug: 'jesskoufo',
  displayName: 'Jess Koufo',
  bio: 'Curating the best products for you',
  profileImage: '',
  coverImage: '',
  socialLinks: {
    instagram: '',
    pinterest: '',
    tiktok: '',
  },
  theme: {
    primaryColor: '#000000',
    accentColor: '#FF6B6B',
    font: 'Inter',
  },
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface Product {
  id: string;
  creatorId?: string;
  featured?: boolean;
  status?: string;
  [key: string]: any;
}

/**
 * Step 1: Create the default creator account
 */
async function createDefaultCreator(): Promise<string> {
  console.log('Step 1: Creating default creator account...');
  
  try {
    // Check if creator already exists
    const getCommand = new GetCommand({
      TableName: CREATORS_TABLE,
      Key: { id: DEFAULT_CREATOR.id },
    });
    
    const existingCreator = await docClient.send(getCommand);
    
    if (existingCreator.Item) {
      console.log(`✓ Creator already exists with ID: ${DEFAULT_CREATOR.id}`);
      return DEFAULT_CREATOR.id;
    }
    
    // Create new creator
    const putCommand = new PutCommand({
      TableName: CREATORS_TABLE,
      Item: DEFAULT_CREATOR,
    });
    
    await docClient.send(putCommand);
    console.log(`✓ Created default creator with ID: ${DEFAULT_CREATOR.id}`);
    console.log(`  - Slug: ${DEFAULT_CREATOR.slug}`);
    console.log(`  - Display Name: ${DEFAULT_CREATOR.displayName}`);
    
    return DEFAULT_CREATOR.id;
  } catch (error) {
    console.error('✗ Failed to create default creator:', error);
    throw error;
  }
}

/**
 * Step 2: Scan all products and backfill with creator data
 */
async function backfillProducts(creatorId: string): Promise<void> {
  console.log('\nStep 2: Backfilling products with creator data...');
  
  let processedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;
  
  try {
    do {
      // Scan products table
      const scanCommand = new ScanCommand({
        TableName: PRODUCTS_TABLE,
        ExclusiveStartKey: lastEvaluatedKey,
      });
      
      const result = await docClient.send(scanCommand);
      const products = (result.Items || []) as Product[];
      
      console.log(`  Processing batch of ${products.length} products...`);
      
      // Update each product
      for (const product of products) {
        processedCount++;
        
        // Skip if product already has creatorId
        if (product.creatorId) {
          skippedCount++;
          continue;
        }
        
        try {
          const updateCommand = new UpdateCommand({
            TableName: PRODUCTS_TABLE,
            Key: { id: product.id },
            UpdateExpression: 'SET creatorId = :creatorId, featured = :featured, #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':creatorId': creatorId,
              ':featured': false,
              ':status': 'approved',
              ':updatedAt': new Date().toISOString(),
            },
          });
          
          await docClient.send(updateCommand);
          updatedCount++;
          
          if (updatedCount % 10 === 0) {
            console.log(`  ✓ Updated ${updatedCount} products so far...`);
          }
        } catch (error) {
          console.error(`  ✗ Failed to update product ${product.id}:`, error);
        }
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n✓ Product backfill complete:`);
    console.log(`  - Total processed: ${processedCount}`);
    console.log(`  - Updated: ${updatedCount}`);
    console.log(`  - Skipped (already migrated): ${skippedCount}`);
  } catch (error) {
    console.error('✗ Failed to backfill products:', error);
    throw error;
  }
}

/**
 * Step 3: Verify data integrity
 */
async function verifyDataIntegrity(creatorId: string): Promise<void> {
  console.log('\nStep 3: Verifying data integrity...');
  
  try {
    // Verify creator exists
    const getCreatorCommand = new GetCommand({
      TableName: CREATORS_TABLE,
      Key: { id: creatorId },
    });
    
    const creatorResult = await docClient.send(getCreatorCommand);
    
    if (!creatorResult.Item) {
      throw new Error('Creator not found after migration!');
    }
    
    console.log('✓ Creator exists in database');
    
    // Count products without creatorId
    let productsWithoutCreator = 0;
    let productsWithCreator = 0;
    let lastEvaluatedKey: Record<string, any> | undefined;
    
    do {
      const scanCommand = new ScanCommand({
        TableName: PRODUCTS_TABLE,
        ExclusiveStartKey: lastEvaluatedKey,
      });
      
      const result = await docClient.send(scanCommand);
      const products = (result.Items || []) as Product[];
      
      for (const product of products) {
        if (product.creatorId) {
          productsWithCreator++;
        } else {
          productsWithoutCreator++;
          console.warn(`  ⚠ Product ${product.id} missing creatorId`);
        }
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n✓ Data integrity check complete:`);
    console.log(`  - Products with creatorId: ${productsWithCreator}`);
    console.log(`  - Products without creatorId: ${productsWithoutCreator}`);
    
    if (productsWithoutCreator > 0) {
      console.warn('\n⚠ Warning: Some products are missing creatorId. You may need to run the migration again.');
    } else {
      console.log('\n✓ All products have been successfully migrated!');
    }
  } catch (error) {
    console.error('✗ Data integrity verification failed:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Multi-Creator Platform Migration');
  console.log('='.repeat(60));
  console.log();
  
  try {
    // Step 1: Create default creator
    const creatorId = await createDefaultCreator();
    
    // Step 2: Backfill products
    await backfillProducts(creatorId);
    
    // Step 3: Verify data integrity
    await verifyDataIntegrity(creatorId);
    
    console.log();
    console.log('='.repeat(60));
    console.log('Migration completed successfully!');
    console.log('='.repeat(60));
    console.log();
    console.log('Next steps:');
    console.log('1. Update the userId in the creator record to match the actual Cognito user ID');
    console.log('2. Add the creator role to the jesskoufo user in Cognito');
    console.log('3. Test the creator landing page at /creator/jesskoufo');
    console.log();
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if executed directly
migrate().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { migrate, createDefaultCreator, backfillProducts, verifyDataIntegrity };
