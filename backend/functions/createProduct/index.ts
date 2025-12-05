import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { successResponse, errorResponse } from '../../shared/responses';
import { validateProduct } from '../../shared/validation';
import { Product } from '../../shared/types';
import { createLogger } from '../../shared/logger';
import { extractUserContext, requireCreator, getCreatorId } from '../../shared/authContext';

const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'ProductsTable';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const logger = createLogger(event.requestContext.requestId);
  
  logger.logRequest(event);
  
  try {
    if (!event.body) {
      logger.warn('Request body is missing');
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Request body is required',
        event.requestContext.requestId
      );
    }

    const data = JSON.parse(event.body);

    // Extract user context and verify creator role
    const userContext = extractUserContext(event);
    requireCreator(userContext);
    const creatorId = getCreatorId(userContext);

    logger.info('User context extracted', {
      userId: userContext.userId,
      role: userContext.role,
      creatorId,
    });

    // Validate input data
    const validation = validateProduct(data);
    if (!validation.valid) {
      logger.warn('Product validation failed', { errors: validation.errors });
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid product data',
        event.requestContext.requestId,
        { errors: validation.errors }
      );
    }

    // Generate UUID and timestamps
    const now = new Date().toISOString();
    const product: Product = {
      id: uuidv4(),
      creatorId, // Auto-assign creatorId from token
      title: data.title,
      description: data.description,
      category: data.category,
      imageUrl: data.imageUrl,
      amazonLink: data.amazonLink,
      price: data.price,
      tags: data.tags,
      published: data.published ? 'true' : 'false', // Convert boolean to string for GSI
      featured: data.featured ? 'true' : 'false', // Convert boolean to string
      status: 'pending', // New products start as pending
      createdAt: now,
      updatedAt: now,
    };

    // Write to DynamoDB
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: product,
    });

    await docClient.send(command);

    // Transform string booleans back to actual booleans for frontend response
    const responseProduct = {
      ...product,
      published: product.published === 'true',
      featured: product.featured === 'true',
    };

    const duration = Date.now() - startTime;
    logger.info('Product created successfully', {
      productId: product.id,
      category: product.category,
      published: product.published,
    });
    logger.logResponse(201, duration);

    return successResponse(201, {
      product: responseProduct,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error creating product', error as Error);
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while creating the product',
      event.requestContext.requestId
    );
  }
}
