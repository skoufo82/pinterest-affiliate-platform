/**
 * Retry and Rate Limiting Utilities
 * 
 * Provides exponential backoff retry logic and rate limit handling for API calls.
 * 
 * Features:
 * - Configurable retry attempts (default: 3)
 * - Exponential backoff with jitter
 * - Rate limit detection and handling
 * - Comprehensive logging of retry attempts
 * 
 * @example
 * // Basic retry with default options (3 attempts, exponential backoff)
 * const result = await withRetry(async () => {
 *   return await apiClient.fetchData();
 * });
 * 
 * @example
 * // Custom retry options
 * const result = await withRetry(
 *   async () => await apiClient.fetchData(),
 *   { maxAttempts: 5, initialDelayMs: 2000 }
 * );
 * 
 * @example
 * // Rate limiting (1 request per second)
 * const limiter = new RateLimiter(1);
 * for (const item of items) {
 *   await limiter.execute(async () => {
 *     return await apiClient.process(item);
 *   });
 * }
 */

import { createLogger } from './logger.js';

const logger = createLogger(undefined, { service: 'RetryUtils' });

export interface RetryOptions {
  maxAttempts?: number;        // Maximum number of retry attempts (default: 3)
  initialDelayMs?: number;      // Initial delay in milliseconds (default: 1000)
  maxDelayMs?: number;          // Maximum delay in milliseconds (default: 30000)
  backoffMultiplier?: number;   // Multiplier for exponential backoff (default: 2)
  jitterFactor?: number;        // Jitter factor to add randomness (default: 0.1)
}

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  lastError?: Error;
  delayMs?: number;
}

export class RetryableError extends Error {
  constructor(message: string, public readonly isRetryable: boolean = true) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class RateLimitError extends RetryableError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(message, true);
    this.name = 'RateLimitError';
  }
}

/**
 * Calculates the delay for the next retry attempt using exponential backoff with jitter
 * 
 * @param attempt - Current attempt number (0-indexed)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const {
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    jitterFactor = 0.1,
  } = options;

  // Calculate exponential delay: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter: random value between -jitterFactor and +jitterFactor
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);
  const delayWithJitter = cappedDelay + jitter;

  // Ensure non-negative delay
  return Math.max(0, Math.round(delayWithJitter));
}

/**
 * Sleeps for the specified duration
 * 
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable
 * 
 * @param error - Error to check
 * @returns True if the error should trigger a retry
 */
export function isRetryableError(error: Error): boolean {
  // Explicit RetryableError
  if (error instanceof RetryableError) {
    return error.isRetryable;
  }

  // Rate limit errors are always retryable
  if (error instanceof RateLimitError) {
    return true;
  }

  // Check error name for PA-API specific errors
  const errorName = error.name;
  
  // Requirement 5.4: Authentication errors are NOT retryable - abort and alert
  if (errorName === 'PAAPIAuthenticationError') {
    return false;
  }
  
  // Requirement 5.2, 5.5: Rate limit errors are retryable - backoff and retry
  if (errorName === 'PAAPIRateLimitError') {
    return true;
  }
  
  // Requirement 5.1: Product not found errors are NOT retryable - log and continue
  if (errorName === 'PAAPIProductNotFoundError') {
    return false;
  }

  const message = error.message.toLowerCase();

  // Requirement 5.2: Network errors are retryable - retry with backoff
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('socket hang up') ||
    message.includes('enotfound')
  ) {
    return true;
  }

  // Rate limit errors are retryable
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429')
  ) {
    return true;
  }

  // Temporary server errors are retryable (5xx)
  if (
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504')
  ) {
    return true;
  }

  // Authentication errors are NOT retryable
  if (
    message.includes('authentication failed') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return false;
  }

  // Not found errors are NOT retryable
  if (message.includes('404') || message.includes('not found')) {
    return false;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Extracts retry-after delay from rate limit error
 * 
 * @param error - Error that may contain retry-after information
 * @returns Delay in milliseconds, or undefined if not available
 */
export function extractRetryAfterDelay(error: Error): number | undefined {
  if (error instanceof RateLimitError && error.retryAfterMs) {
    return error.retryAfterMs;
  }

  // Check for PA-API rate limit error with retry-after
  if (error.name === 'PAAPIRateLimitError') {
    const rateLimitError = error as any;
    if (rateLimitError.retryAfterSeconds) {
      return rateLimitError.retryAfterSeconds * 1000; // Convert seconds to milliseconds
    }
  }

  // Try to parse from error message
  const match = error.message.match(/retry after (\d+)/i);
  if (match) {
    return parseInt(match[1], 10) * 1000; // Convert seconds to milliseconds
  }

  return undefined;
}

/**
 * Executes a function with retry logic and exponential backoff
 * 
 * @param fn - Async function to execute
 * @param options - Retry options
 * @param context - Optional context for logging
 * @returns Result of the function
 * @throws Error if all retry attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context?: Record<string, unknown>
): Promise<T> {
  const { maxAttempts = 3 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const retryContext: RetryContext = {
        attempt: attempt + 1,
        totalAttempts: maxAttempts,
        lastError,
      };

      if (attempt > 0) {
        logger.info('Retrying operation', {
          ...context,
          attempt: retryContext.attempt,
          totalAttempts: retryContext.totalAttempts,
        });
      }

      const result = await fn();
      
      if (attempt > 0) {
        logger.info('Retry succeeded', {
          ...context,
          attempt: retryContext.attempt,
        });
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(lastError)) {
        logger.warn('Non-retryable error encountered', {
          ...context,
          attempt: attempt + 1,
          error: lastError.message,
        });
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts - 1) {
        logger.error('All retry attempts exhausted', lastError, {
          ...context,
          totalAttempts: maxAttempts,
        });
        throw lastError;
      }

      // Calculate delay for next retry
      let delayMs: number;

      // Check for rate limit with retry-after
      const retryAfterMs = extractRetryAfterDelay(lastError);
      if (retryAfterMs !== undefined) {
        delayMs = retryAfterMs;
        logger.warn('Rate limit detected, waiting before retry', {
          ...context,
          attempt: attempt + 1,
          delayMs,
          retryAfterMs,
        });
      } else {
        delayMs = calculateBackoffDelay(attempt, options);
        logger.warn('Retryable error encountered, backing off', {
          ...context,
          attempt: attempt + 1,
          delayMs,
          error: lastError.message,
        });
      }

      // Wait before next retry
      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Rate limiter that enforces a minimum delay between operations
 */
export class RateLimiter {
  private lastExecutionTime: number = 0;
  private minDelayMs: number;

  constructor(requestsPerSecond: number = 1) {
    this.minDelayMs = 1000 / requestsPerSecond;
  }

  /**
   * Waits if necessary to enforce rate limit, then executes the function
   * 
   * @param fn - Function to execute
   * @returns Result of the function
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecutionTime;

    if (timeSinceLastExecution < this.minDelayMs) {
      const delayMs = this.minDelayMs - timeSinceLastExecution;
      logger.debug('Rate limiting: waiting before execution', { delayMs });
      await sleep(delayMs);
    }

    this.lastExecutionTime = Date.now();
    return await fn();
  }

  /**
   * Resets the rate limiter state
   */
  reset(): void {
    this.lastExecutionTime = 0;
  }
}
