import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'ProductsTable';

export interface PriceUpdateResult {
  success: boolean;
  productId: string;
  error?: string;
}

/**
 * Update a product's price information from Amazon PA-API sync
 * @param productId - The product ID to update
 * @param price - The new price from Amazon (or null if unavailable)
 * @param _currency - The currency code (e.g., 'USD') - reserved for future multi-currency support
 * @returns Promise<PriceUpdateResult>
 */
export async function updateProductPrice(
  productId: string,
  price: string | null,
  _currency: string
): Promise<PriceUpdateResult> {
  try {
    const now = new Date().toISOString();
    
    const updateExpression = 
      'SET price = :price, priceLastUpdated = :timestamp, priceSyncStatus = :status, updatedAt = :updatedAt';
    
    const expressionAttributeValues: Record<string, any> = {
      ':price': price,
      ':timestamp': now,
      ':status': 'success',
      ':updatedAt': now,
    };

    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        id: productId,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'NONE',
    });

    await docClient.send(updateCommand);

    return {
      success: true,
      productId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      productId,
      error: errorMessage,
    };
  }
}

/**
 * Mark a product's price sync as failed
 * @param productId - The product ID to update
 * @param errorMessage - The error message to store
 * @returns Promise<PriceUpdateResult>
 */
export async function markPriceSyncFailed(
  productId: string,
  errorMessage: string
): Promise<PriceUpdateResult> {
  try {
    const now = new Date().toISOString();
    
    const updateExpression = 
      'SET priceSyncStatus = :status, priceSyncError = :error, updatedAt = :updatedAt';
    
    const expressionAttributeValues = {
      ':status': 'failed',
      ':error': errorMessage,
      ':updatedAt': now,
    };

    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        id: productId,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'NONE',
    });

    await docClient.send(updateCommand);

    return {
      success: true,
      productId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      productId,
      error: errorMessage,
    };
  }
}

/**
 * Mark a product's price sync as pending
 * @param productId - The product ID to update
 * @returns Promise<PriceUpdateResult>
 */
export async function markPriceSyncPending(
  productId: string
): Promise<PriceUpdateResult> {
  try {
    const now = new Date().toISOString();
    
    const updateExpression = 
      'SET priceSyncStatus = :status, updatedAt = :updatedAt';
    
    const expressionAttributeValues = {
      ':status': 'pending',
      ':updatedAt': now,
    };

    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        id: productId,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'NONE',
    });

    await docClient.send(updateCommand);

    return {
      success: true,
      productId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      productId,
      error: errorMessage,
    };
  }
}
