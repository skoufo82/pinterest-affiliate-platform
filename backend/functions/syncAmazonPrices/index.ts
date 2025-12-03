/**
 * Amazon Price Sync Lambda Function
 * 
 * Scheduled Lambda that synchronizes product prices with Amazon PA-API.
 * Runs daily at 2 AM UTC via EventBridge rule.
 * 
 * Process:
 * 1. Scan all products from DynamoDB
 * 2. Extract ASINs from Amazon URLs
 * 3. Batch ASINs into groups of 10 (PA-API limit)
 * 4. Call PA-API for each batch with rate limiting
 * 5. Update products with new prices
 * 6. Track and log success/failure counts
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import { ScheduledEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { createLogger } from '../../shared/logger.js';
import { extractASIN } from '../../shared/asinExtractor.js';
import { 
  createPAAPIClient, 
  PAAPIAuthenticationError,
  PAAPIRateLimitError 
} from '../../shared/amazonPAAPI.js';
import { updateProductPrice, markPriceSyncFailed } from '../../shared/productUpdater.js';
import { withRetry, RateLimiter } from '../../shared/retryUtils.js';
import { Product } from '../../shared/types.js';
import {
  sendAuthenticationErrorAlert,
  sendHighFailureRateAlert,
  sendParameterStoreErrorAlert,
  sendSyncExecutionFailureAlert,
} from '../../shared/snsNotifications.js';

const logger = createLogger(undefined, { service: 'PriceSync' });

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'ProductsTable';

export interface SyncResult {
  executionId: string;
  startTime: string;
  endTime: string;
  totalProducts: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  errors: SyncError[];
}

export interface SyncError {
  productId: string;
  asin: string;
  errorMessage: string;
  errorCode: string;
}

/**
 * Publishes custom metrics to CloudWatch
 * Requirement 8.3: Publish metrics including success rate and duration
 */
async function publishMetrics(
  successCount: number,
  failureCount: number,
  durationMs: number,
  totalProducts: number,
  skippedCount: number
): Promise<void> {
  try {
    const namespace = 'PriceSync';
    const timestamp = new Date();

    const command = new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: 'SuccessCount',
          Value: successCount,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'FailureCount',
          Value: failureCount,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'Duration',
          Value: durationMs,
          Unit: 'Milliseconds',
          Timestamp: timestamp,
        },
        {
          MetricName: 'TotalProducts',
          Value: totalProducts,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'SkippedCount',
          Value: skippedCount,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'ProcessedCount',
          Value: totalProducts - skippedCount,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'SuccessRate',
          Value: totalProducts - skippedCount > 0 
            ? (successCount / (totalProducts - skippedCount)) * 100 
            : 0,
          Unit: 'Percent',
          Timestamp: timestamp,
        },
        {
          MetricName: 'FailureRate',
          Value: totalProducts - skippedCount > 0 
            ? (failureCount / (totalProducts - skippedCount)) * 100 
            : 0,
          Unit: 'Percent',
          Timestamp: timestamp,
        },
      ],
    });

    await cloudWatchClient.send(command);
    
    logger.info('CloudWatch metrics published successfully', {
      namespace,
      metricsPublished: 8,
      successCount,
      failureCount,
      durationMs,
    });
  } catch (error) {
    // Don't fail the entire sync if metrics publishing fails
    logger.error('Failed to publish CloudWatch metrics', error as Error, {
      successCount,
      failureCount,
      durationMs,
    });
  }
}

/**
 * Fetches all products from DynamoDB
 */
async function getAllProducts(): Promise<Product[]> {
  logger.info('Scanning all products from DynamoDB');
  
  const products: Product[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  try {
    do {
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const result = await docClient.send(scanCommand);
      
      if (result.Items) {
        products.push(...(result.Items as Product[]));
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    logger.info('Successfully scanned all products', { count: products.length });
    return products;
  } catch (error) {
    logger.error('Failed to scan products from DynamoDB', error as Error);
    throw error;
  }
}

/**
 * Extracts ASINs from products with Amazon links
 */
function extractASINsFromProducts(products: Product[]): Map<string, Product> {
  logger.info('Extracting ASINs from product URLs');
  
  const asinToProduct = new Map<string, Product>();
  let extractedCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    if (!product.amazonLink) {
      skippedCount++;
      continue;
    }

    const asin = extractASIN(product.amazonLink);
    
    if (asin) {
      asinToProduct.set(asin, product);
      extractedCount++;
      logger.debug('Extracted ASIN', {
        productId: product.id,
        asin,
        url: product.amazonLink,
      });
    } else {
      skippedCount++;
      logger.warn('Failed to extract ASIN from URL', {
        productId: product.id,
        url: product.amazonLink,
      });
    }
  }

  logger.info('ASIN extraction complete', {
    total: products.length,
    extracted: extractedCount,
    skipped: skippedCount,
  });

  return asinToProduct;
}

/**
 * Batches ASINs into groups of 10 (PA-API limit)
 */
function batchASINs(asins: string[], batchSize: number = 10): string[][] {
  const batches: string[][] = [];
  
  for (let i = 0; i < asins.length; i += batchSize) {
    batches.push(asins.slice(i, i + batchSize));
  }

  logger.info('Created ASIN batches', {
    totalASINs: asins.length,
    batchCount: batches.length,
    batchSize,
  });

  return batches;
}

/**
 * Main handler function
 */
export async function handler(event: ScheduledEvent): Promise<SyncResult> {
  const executionId = event.id || `manual-${Date.now()}`;
  const startTime = new Date().toISOString();
  const startTimestamp = Date.now();
  
  // Requirement 8.1: Log execution start time
  logger.info('Price sync execution started', {
    executionId,
    startTime,
    scheduledTime: event.time,
    eventSource: event.source,
    region: process.env.AWS_REGION,
  });

  const syncResult: SyncResult = {
    executionId,
    startTime,
    endTime: '',
    totalProducts: 0,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    // Step 1: Fetch all products from DynamoDB
    const products = await getAllProducts();
    syncResult.totalProducts = products.length;

    if (products.length === 0) {
      logger.warn('No products found in database');
      syncResult.endTime = new Date().toISOString();
      return syncResult;
    }

    // Step 2: Extract ASINs from Amazon URLs
    const asinToProduct = extractASINsFromProducts(products);
    const asins = Array.from(asinToProduct.keys());
    
    syncResult.skippedCount = products.length - asins.length;

    if (asins.length === 0) {
      logger.warn('No valid ASINs found in products');
      syncResult.endTime = new Date().toISOString();
      return syncResult;
    }

    // Step 3: Batch ASINs into groups of 10
    const batches = batchASINs(asins);

    // Step 4: Initialize PA-API client and rate limiter
    const paApiClient = createPAAPIClient();
    const rateLimiter = new RateLimiter(1); // 1 request per second

    // Step 5: Process each batch with rate limiting
    logger.info('Starting batch processing', { 
      batchCount: batches.length,
      totalASINs: asins.length,
      productsWithASINs: asins.length,
      productsWithoutASINs: syncResult.skippedCount,
    });

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;

      logger.info('Processing batch', {
        batchNumber,
        totalBatches: batches.length,
        asinCount: batch.length,
        progress: `${batchNumber}/${batches.length}`,
        percentComplete: ((batchNumber / batches.length) * 100).toFixed(1) + '%',
      });

      try {
        // Execute with rate limiting and retry logic
        const productInfos = await rateLimiter.execute(async () => {
          return await withRetry(
            async () => await paApiClient.getProductInfo(batch),
            {
              maxAttempts: 3,
              initialDelayMs: 1000,
            },
            { batch: batchNumber }
          );
        });

        logger.info('Batch fetch successful', {
          batchNumber,
          totalBatches: batches.length,
          productsReceived: productInfos.length,
          expectedProducts: batch.length,
        });

        // Step 6: Update products with new prices
        for (const productInfo of productInfos) {
          const product = asinToProduct.get(productInfo.asin);
          
          if (!product) {
            logger.warn('Product not found for ASIN', { asin: productInfo.asin });
            continue;
          }

          try {
            if (productInfo.price !== null) {
              // Update product with new price
              const updateResult = await updateProductPrice(
                product.id,
                productInfo.price,
                productInfo.currency
              );

              if (updateResult.success) {
                syncResult.successCount++;
                logger.info('Product price updated', {
                  productId: product.id,
                  asin: productInfo.asin,
                  price: productInfo.price,
                  currency: productInfo.currency,
                });
              } else {
                syncResult.failureCount++;
                const errorMsg = updateResult.error || 'Unknown update error';
                syncResult.errors.push({
                  productId: product.id,
                  asin: productInfo.asin,
                  errorMessage: errorMsg,
                  errorCode: 'UPDATE_FAILED',
                });
                // Requirement 8.2: Log detailed error information (ASIN, message, stack trace)
                logger.error('Failed to update product price', new Error(errorMsg), {
                  productId: product.id,
                  asin: productInfo.asin,
                  errorCode: 'UPDATE_FAILED',
                  attemptedPrice: productInfo.price,
                  attemptedCurrency: productInfo.currency,
                });
              }
            } else {
              // Price not available from Amazon
              const markResult = await markPriceSyncFailed(
                product.id,
                'Price not available from Amazon'
              );

              if (markResult.success) {
                syncResult.failureCount++;
                logger.warn('Price not available for product', {
                  productId: product.id,
                  asin: productInfo.asin,
                });
              } else {
                syncResult.failureCount++;
                syncResult.errors.push({
                  productId: product.id,
                  asin: productInfo.asin,
                  errorMessage: 'Failed to mark sync as failed',
                  errorCode: 'UPDATE_FAILED',
                });
              }
            }
          } catch (error) {
            syncResult.failureCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            syncResult.errors.push({
              productId: product.id,
              asin: productInfo.asin,
              errorMessage,
              errorCode: 'UPDATE_ERROR',
            });
            // Requirement 8.2: Log detailed error information (ASIN, message, stack trace)
            logger.error('Error updating product', error as Error, {
              productId: product.id,
              asin: productInfo.asin,
              errorCode: 'UPDATE_ERROR',
              price: productInfo.price,
              currency: productInfo.currency,
            });
          }
        }

        // Handle ASINs that weren't returned by PA-API (not found)
        const returnedASINs = new Set(productInfos.map(p => p.asin));
        const missingASINs = batch.filter(asin => !returnedASINs.has(asin));

        for (const asin of missingASINs) {
          const product = asinToProduct.get(asin);
          if (product) {
            try {
              await markPriceSyncFailed(product.id, 'Product not found on Amazon');
              syncResult.failureCount++;
              logger.warn('Product not found on Amazon', {
                productId: product.id,
                asin,
              });
            } catch (error) {
              syncResult.failureCount++;
              syncResult.errors.push({
                productId: product.id,
                asin,
                errorMessage: 'Failed to mark as not found',
                errorCode: 'UPDATE_FAILED',
              });
            }
          }
        }
      } catch (error) {
        // Batch processing failed - mark all products in batch as failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as Error & { code?: string }).code || 'UNKNOWN';
        const errorName = error instanceof Error ? error.name : 'Error';
        
        // Requirement 5.4: Handle authentication errors (401) - abort and alert
        if (error instanceof PAAPIAuthenticationError || errorName === 'PAAPIAuthenticationError') {
          logger.error('PA-API authentication failed - aborting sync', error as Error, {
            batchNumber,
            totalBatches: batches.length,
            executionId,
          });
          
          // Send SNS alert for authentication failure
          await sendAuthenticationErrorAlert(executionId, errorMessage);
          
          // Mark all remaining products as failed
          for (let j = i; j < batches.length; j++) {
            for (const asin of batches[j]) {
              const product = asinToProduct.get(asin);
              if (product) {
                try {
                  await markPriceSyncFailed(product.id, 'Authentication failed - sync aborted');
                  syncResult.failureCount++;
                  syncResult.errors.push({
                    productId: product.id,
                    asin,
                    errorMessage: 'Authentication failed',
                    errorCode: 'AUTH_FAILED',
                  });
                } catch (updateError) {
                  logger.error('Failed to mark product as failed', updateError as Error, {
                    productId: product.id,
                    asin,
                  });
                }
              }
            }
          }
          
          // Abort sync execution
          throw error;
        }
        
        // Requirement 5.2, 5.5: Handle rate limit errors (429) - logged and retried by withRetry
        if (error instanceof PAAPIRateLimitError || errorName === 'PAAPIRateLimitError') {
          logger.warn('PA-API rate limit error - will be retried', {
            batchNumber,
            totalBatches: batches.length,
            errorMessage,
          });
        }
        
        // Requirement 8.2: Log detailed error information (ASIN, message, stack trace)
        logger.error('Batch processing failed', error as Error, {
          batchNumber,
          totalBatches: batches.length,
          asinCount: batch.length,
          asins: batch,
          errorCode,
          errorName,
        });

        // Requirement 5.1: Continue processing other products on error
        for (const asin of batch) {
          const product = asinToProduct.get(asin);
          if (product) {
            try {
              await markPriceSyncFailed(product.id, `Batch fetch failed: ${errorMessage}`);
              syncResult.failureCount++;
              syncResult.errors.push({
                productId: product.id,
                asin,
                errorMessage,
                errorCode: 'BATCH_FAILED',
              });
            } catch (updateError) {
              logger.error('Failed to mark product as failed', updateError as Error, {
                productId: product.id,
                asin,
                errorCode: 'MARK_FAILED_ERROR',
              });
            }
          }
        }
      }

      // Log batch completion summary for progress tracking
      logger.info('Batch processing complete', {
        batchNumber,
        totalBatches: batches.length,
        runningTotals: {
          successCount: syncResult.successCount,
          failureCount: syncResult.failureCount,
          errorCount: syncResult.errors.length,
        },
      });
    }

    syncResult.endTime = new Date().toISOString();
    const endTimestamp = Date.now();
    const durationMs = endTimestamp - startTimestamp;
    
    // Requirement 8.1: Log execution end time and total products processed
    // Requirement 8.1: Log success/failure/skipped counts
    logger.info('Price sync execution completed', {
      executionId,
      startTime: syncResult.startTime,
      endTime: syncResult.endTime,
      durationMs,
      durationSeconds: (durationMs / 1000).toFixed(2),
      totalProducts: syncResult.totalProducts,
      successCount: syncResult.successCount,
      failureCount: syncResult.failureCount,
      skippedCount: syncResult.skippedCount,
      errorCount: syncResult.errors.length,
      successRate: syncResult.totalProducts > 0 
        ? ((syncResult.successCount / (syncResult.totalProducts - syncResult.skippedCount)) * 100).toFixed(2) + '%'
        : 'N/A',
    });

    // Requirement 8.3: Publish metrics to CloudWatch
    await publishMetrics(
      syncResult.successCount,
      syncResult.failureCount,
      durationMs,
      syncResult.totalProducts,
      syncResult.skippedCount
    );

    // Requirement 8.2: Log detailed error information if errors occurred
    if (syncResult.errors.length > 0) {
      logger.warn('Price sync completed with errors', {
        executionId,
        errorCount: syncResult.errors.length,
        errors: syncResult.errors.map(err => ({
          productId: err.productId,
          asin: err.asin,
          errorCode: err.errorCode,
          errorMessage: err.errorMessage,
        })),
      });
    }

    // Requirement 8.4: Send alert if failure rate is high (> 50%)
    const processedCount = syncResult.totalProducts - syncResult.skippedCount;
    if (processedCount > 0) {
      const failureRate = (syncResult.failureCount / processedCount) * 100;
      
      if (failureRate > 50) {
        logger.warn('High failure rate detected, sending alert', {
          executionId,
          failureRate: failureRate.toFixed(1) + '%',
          failureCount: syncResult.failureCount,
          processedCount,
        });
        
        await sendHighFailureRateAlert(
          executionId,
          processedCount,
          syncResult.failureCount,
          failureRate
        );
      }
    }

    return syncResult;
  } catch (error) {
    syncResult.endTime = new Date().toISOString();
    const endTimestamp = Date.now();
    const durationMs = endTimestamp - startTimestamp;
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'Error';
    
    // Requirement 8.2: Log detailed error information including stack trace
    logger.error('Price sync execution failed', error as Error, {
      executionId,
      startTime: syncResult.startTime,
      endTime: syncResult.endTime,
      durationMs,
      durationSeconds: (durationMs / 1000).toFixed(2),
      partialResults: {
        totalProducts: syncResult.totalProducts,
        successCount: syncResult.successCount,
        failureCount: syncResult.failureCount,
        skippedCount: syncResult.skippedCount,
        errorCount: syncResult.errors.length,
      },
      errorMessage,
      errorName,
    });

    // Requirement 5.4: Send SNS notifications for critical errors
    
    // Check if this is a Parameter Store error
    if (errorMessage.includes('Parameter Store') || 
        errorMessage.includes('ssm:GetParameter') ||
        errorMessage.includes('PA-API credentials not available')) {
      await sendParameterStoreErrorAlert(executionId, errorMessage);
    }
    // Check if this is an authentication error (not already handled in batch processing)
    else if (error instanceof PAAPIAuthenticationError || errorName === 'PAAPIAuthenticationError') {
      // Already sent alert in batch processing, but log it here too
      logger.info('Authentication error alert already sent during batch processing');
    }
    // For other critical failures, send general sync failure alert
    else {
      await sendSyncExecutionFailureAlert(
        executionId,
        errorMessage,
        {
          totalProducts: syncResult.totalProducts,
          successCount: syncResult.successCount,
          failureCount: syncResult.failureCount,
        }
      );
    }

    throw error;
  }
}
