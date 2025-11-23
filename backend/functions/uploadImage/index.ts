import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { successResponse, errorResponse } from '../../shared/responses';
import { validateImageUpload } from '../../shared/validation';
import { createLogger } from '../../shared/logger';

const s3Client = new S3Client({ region: process.env.REGION || 'us-east-1' });
const BUCKET_NAME = process.env.IMAGES_BUCKET_NAME || '';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

    // Validate input data
    const validation = validateImageUpload(data);
    if (!validation.valid) {
      logger.warn('Image upload validation failed', { errors: validation.errors });
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid image upload data',
        event.requestContext.requestId,
        { errors: validation.errors }
      );
    }

    // Validate file size if provided
    if (data.fileSize && data.fileSize > MAX_FILE_SIZE) {
      logger.warn('File size exceeds limit', { fileSize: data.fileSize, maxSize: MAX_FILE_SIZE });
      logger.logResponse(400, Date.now() - startTime);
      return errorResponse(
        400,
        'FILE_TOO_LARGE',
        'File size exceeds 5MB limit',
        event.requestContext.requestId
      );
    }

    // Generate unique file name with timestamp
    const timestamp = Date.now();
    const sanitizedFileName = data.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `products/${timestamp}-${sanitizedFileName}`;

    // Create presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: data.fileType,
    });

    // Generate presigned URL with 5-minute expiration
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // Generate public URL for the image
    const imageUrl = `https://${BUCKET_NAME}.s3.${process.env.REGION || 'us-east-1'}.amazonaws.com/${key}`;

    const duration = Date.now() - startTime;
    logger.info('Presigned URL generated successfully', {
      fileName: data.fileName,
      fileType: data.fileType,
      key,
    });
    logger.logResponse(200, duration);

    return successResponse(200, {
      uploadUrl,
      imageUrl,
      expiresAt: Date.now() + 300000, // 5 minutes from now
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error generating upload URL', error as Error);
    logger.logResponse(500, duration);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An error occurred while generating upload URL',
      event.requestContext.requestId
    );
  }
}
