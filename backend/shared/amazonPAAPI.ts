/**
 * Amazon Product Advertising API (PA-API 5.0) Client
 * 
 * Provides integration with Amazon's PA-API to fetch product information including:
 * - Current prices
 * - Currency
 * - Availability status
 * - Product titles and images
 * 
 * Features:
 * - AWS Signature V4 request signing
 * - Batch support (up to 10 ASINs per request)
 * - Credential caching from Parameter Store
 * - Comprehensive error handling
 * - Rate limit detection
 */

import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import { createHmac, createHash } from 'crypto';
import { createLogger } from './logger.js';

const logger = createLogger(undefined, { service: 'PA-API-Client' });

// PA-API Configuration
const PA_API_HOST = 'webservices.amazon.com';
const PA_API_REGION = 'us-east-1';
const PA_API_ENDPOINT = '/paapi5/getitems';
const PA_API_SERVICE = 'ProductAdvertisingAPI';

// Cached credentials (valid for Lambda execution lifetime)
let cachedCredentials: PAAPICredentials | null = null;

export interface PAAPICredentials {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  marketplace: string;
}

export interface ProductInfo {
  asin: string;
  price: string | null;
  currency: string;
  availability: boolean;
  title: string;
  imageUrl: string;
}

export interface PAAPIError {
  code: string;
  message: string;
}

export class PAAPIAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PAAPIAuthenticationError';
  }
}

export class PAAPIRateLimitError extends Error {
  constructor(message: string, public readonly retryAfterSeconds?: number) {
    super(message);
    this.name = 'PAAPIRateLimitError';
  }
}

export class PAAPIProductNotFoundError extends Error {
  constructor(message: string, public readonly asin: string) {
    super(message);
    this.name = 'PAAPIProductNotFoundError';
  }
}

export class PAAPIClient {
  private ssmClient: SSMClient;

  constructor(region: string = PA_API_REGION) {
    this.ssmClient = new SSMClient({ region });
  }

  /**
   * Retrieves PA-API credentials from Parameter Store
   * Caches credentials for the Lambda execution lifetime
   */
  private async getCredentials(): Promise<PAAPICredentials> {
    // Return cached credentials if available
    if (cachedCredentials) {
      logger.debug('Using cached PA-API credentials');
      return cachedCredentials;
    }

    logger.info('Fetching PA-API credentials from Parameter Store');

    try {
      const command = new GetParametersCommand({
        Names: [
          '/amazon-affiliate/pa-api/access-key',
          '/amazon-affiliate/pa-api/secret-key',
          '/amazon-affiliate/pa-api/partner-tag',
          '/amazon-affiliate/pa-api/marketplace',
        ],
        WithDecryption: true,
      });

      const response = await this.ssmClient.send(command);

      if (!response.Parameters || response.Parameters.length < 4) {
        throw new Error('Missing required PA-API parameters in Parameter Store');
      }

      const params = response.Parameters.reduce((acc: Record<string, string>, param) => {
        if (param.Name && param.Value) {
          acc[param.Name] = param.Value;
        }
        return acc;
      }, {} as Record<string, string>);

      cachedCredentials = {
        accessKey: params['/amazon-affiliate/pa-api/access-key'],
        secretKey: params['/amazon-affiliate/pa-api/secret-key'],
        partnerTag: params['/amazon-affiliate/pa-api/partner-tag'],
        marketplace: params['/amazon-affiliate/pa-api/marketplace'] || 'www.amazon.com',
      };

      logger.info('Successfully retrieved PA-API credentials');
      return cachedCredentials;
    } catch (error) {
      logger.error('Failed to retrieve PA-API credentials', error as Error);
      throw new Error('PA-API credentials not available');
    }
  }

  /**
   * Creates AWS Signature V4 for PA-API request
   */
  private createSignature(
    method: string,
    path: string,
    queryString: string,
    headers: Record<string, string>,
    payload: string,
    credentials: PAAPICredentials,
    timestamp: string
  ): string {
    const dateStamp = timestamp.substring(0, 8);

    // Step 1: Create canonical request
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n');

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = createHash('sha256').update(payload).digest('hex');

    const canonicalRequest = [
      method,
      path,
      queryString,
      canonicalHeaders + '\n',
      signedHeaders,
      payloadHash,
    ].join('\n');

    // Step 2: Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${PA_API_REGION}/${PA_API_SERVICE}/aws4_request`;
    const canonicalRequestHash = createHash('sha256').update(canonicalRequest).digest('hex');

    const stringToSign = [
      algorithm,
      timestamp,
      credentialScope,
      canonicalRequestHash,
    ].join('\n');

    // Step 3: Calculate signature
    const kDate = createHmac('sha256', `AWS4${credentials.secretKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(PA_API_REGION).digest();
    const kService = createHmac('sha256', kRegion).update(PA_API_SERVICE).digest();
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    // Step 4: Create authorization header
    return `${algorithm} Credential=${credentials.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  /**
   * Makes a signed request to PA-API
   */
  private async makeRequest(
    payload: object,
    credentials: PAAPICredentials
  ): Promise<any> {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const payloadString = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      'host': PA_API_HOST,
      'x-amz-date': timestamp,
      'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
    };

    const authorization = this.createSignature(
      'POST',
      PA_API_ENDPOINT,
      '',
      headers,
      payloadString,
      credentials,
      timestamp
    );

    headers['authorization'] = authorization;

    const url = `https://${PA_API_HOST}${PA_API_ENDPOINT}`;

    logger.debug('Making PA-API request', { url, asinCount: (payload as any).ItemIds?.length });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payloadString,
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        logger.warn('PA-API request failed', {
          status: response.status,
          statusText: response.statusText,
          response: responseText,
        });

        // Parse error response
        let errorData: any;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          throw new Error(`PA-API HTTP ${response.status}: ${response.statusText}`);
        }

        // Requirement 5.4: Handle authentication errors (401) - abort and alert
        if (response.status === 401) {
          const errorMsg = 'PA-API authentication failed - check credentials';
          logger.error('PA-API authentication error', new Error(errorMsg), {
            status: 401,
            response: responseText,
          });
          throw new PAAPIAuthenticationError(errorMsg);
        }
        
        // Requirement 5.2, 5.5: Handle rate limit errors (429) - backoff and retry
        if (response.status === 429) {
          // Try to extract retry-after header
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
          
          const errorMsg = `PA-API rate limit exceeded${retryAfterSeconds ? ` - retry after ${retryAfterSeconds}s` : ''}`;
          logger.warn('PA-API rate limit error', {
            status: 429,
            retryAfterSeconds,
            response: responseText,
          });
          throw new PAAPIRateLimitError(errorMsg, retryAfterSeconds);
        }
        
        // Handle other error responses
        if (errorData.Errors && errorData.Errors.length > 0) {
          const error = errorData.Errors[0];
          throw new Error(`PA-API error: ${error.Code} - ${error.Message}`);
        } else {
          throw new Error(`PA-API request failed: ${response.statusText}`);
        }
      }

      return JSON.parse(responseText);
    } catch (error) {
      if (error instanceof Error) {
        logger.error('PA-API request error', error);
        throw error;
      }
      throw new Error('Unknown PA-API request error');
    }
  }

  /**
   * Parses PA-API response to extract product information
   */
  private parseProductInfo(item: any): ProductInfo {
    const asin = item.ASIN;
    
    // Extract price information
    let price: string | null = null;
    let currency = 'USD';
    
    if (item.Offers?.Listings?.[0]?.Price) {
      const priceData = item.Offers.Listings[0].Price;
      price = priceData.Amount?.toString() || null;
      currency = priceData.Currency || 'USD';
    }

    // Extract availability
    const availability = item.Offers?.Listings?.[0]?.Availability?.Type === 'Now' || false;

    // Extract title
    const title = item.ItemInfo?.Title?.DisplayValue || '';

    // Extract image URL
    const imageUrl = item.Images?.Primary?.Large?.URL || 
                     item.Images?.Primary?.Medium?.URL || 
                     item.Images?.Primary?.Small?.URL || 
                     '';

    return {
      asin,
      price,
      currency,
      availability,
      title,
      imageUrl,
    };
  }

  /**
   * Fetches product information for a batch of ASINs
   * Supports up to 10 ASINs per request (PA-API limit)
   * 
   * @param asins - Array of ASINs to fetch (max 10)
   * @returns Array of ProductInfo objects
   * @throws Error if credentials unavailable or API request fails
   */
  async getProductInfo(asins: string[]): Promise<ProductInfo[]> {
    if (!asins || asins.length === 0) {
      return [];
    }

    if (asins.length > 10) {
      throw new Error('PA-API supports maximum 10 ASINs per request');
    }

    logger.info('Fetching product info from PA-API', { asinCount: asins.length });

    const credentials = await this.getCredentials();

    const payload = {
      ItemIds: asins,
      PartnerTag: credentials.partnerTag,
      PartnerType: 'Associates',
      Marketplace: credentials.marketplace,
      Resources: [
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.Availability.Type',
        'Images.Primary.Large',
        'Images.Primary.Medium',
        'Images.Primary.Small',
      ],
    };

    try {
      const response = await this.makeRequest(payload, credentials);

      const products: ProductInfo[] = [];

      // Process successful items
      if (response.ItemsResult?.Items) {
        for (const item of response.ItemsResult.Items) {
          try {
            const productInfo = this.parseProductInfo(item);
            products.push(productInfo);
            logger.debug('Parsed product info', { asin: productInfo.asin, hasPrice: !!productInfo.price });
          } catch (error) {
            logger.warn('Failed to parse product info', { asin: item.ASIN, error });
          }
        }
      }

      // Log errors for items that failed
      if (response.Errors) {
        for (const error of response.Errors) {
          logger.warn('PA-API item error', {
            asin: error.ASIN,
            code: error.Code,
            message: error.Message,
          });
        }
      }

      logger.info('Successfully fetched product info', {
        requested: asins.length,
        received: products.length,
        errors: response.Errors?.length || 0,
      });

      return products;
    } catch (error) {
      logger.error('Failed to fetch product info', error as Error, { asins });
      throw error;
    }
  }
}

/**
 * Factory function to create a PA-API client
 */
export function createPAAPIClient(region?: string): PAAPIClient {
  return new PAAPIClient(region);
}
