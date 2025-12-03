import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateBackoffDelay,
  isRetryableError,
  extractRetryAfterDelay,
  withRetry,
  RateLimiter,
  RetryableError,
  RateLimitError,
} from './retryUtils';

describe('calculateBackoffDelay', () => {
  it('should calculate exponential backoff correctly', () => {
    // Default options: initialDelay=1000ms, multiplier=2
    expect(calculateBackoffDelay(0)).toBeGreaterThanOrEqual(900); // ~1000ms with jitter
    expect(calculateBackoffDelay(0)).toBeLessThanOrEqual(1100);
    
    expect(calculateBackoffDelay(1)).toBeGreaterThanOrEqual(1800); // ~2000ms with jitter
    expect(calculateBackoffDelay(1)).toBeLessThanOrEqual(2200);
    
    expect(calculateBackoffDelay(2)).toBeGreaterThanOrEqual(3600); // ~4000ms with jitter
    expect(calculateBackoffDelay(2)).toBeLessThanOrEqual(4400);
  });

  it('should respect maximum delay', () => {
    const delay = calculateBackoffDelay(10, { maxDelayMs: 5000 });
    expect(delay).toBeLessThanOrEqual(5500); // Max + jitter
  });

  it('should use custom initial delay', () => {
    const delay = calculateBackoffDelay(0, { initialDelayMs: 500 });
    expect(delay).toBeGreaterThanOrEqual(450);
    expect(delay).toBeLessThanOrEqual(550);
  });
});

describe('isRetryableError', () => {
  it('should identify retryable errors', () => {
    expect(isRetryableError(new Error('Network error occurred'))).toBe(true);
    expect(isRetryableError(new Error('Connection timeout'))).toBe(true);
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('HTTP 429: Too many requests'))).toBe(true);
    expect(isRetryableError(new Error('HTTP 503: Service unavailable'))).toBe(true);
    expect(isRetryableError(new RetryableError('Custom retryable error'))).toBe(true);
    expect(isRetryableError(new RateLimitError('Rate limited'))).toBe(true);
  });

  it('should identify non-retryable errors', () => {
    expect(isRetryableError(new Error('PA-API authentication failed'))).toBe(false);
    expect(isRetryableError(new Error('HTTP 401: Unauthorized'))).toBe(false);
    expect(isRetryableError(new Error('HTTP 403: Forbidden'))).toBe(false);
    expect(isRetryableError(new Error('HTTP 404: Not found'))).toBe(false);
    expect(isRetryableError(new Error('Product not found'))).toBe(false);
    expect(isRetryableError(new RetryableError('Non-retryable', false))).toBe(false);
  });
});

describe('extractRetryAfterDelay', () => {
  it('should extract retry-after from RateLimitError', () => {
    const error = new RateLimitError('Rate limited', 5000);
    expect(extractRetryAfterDelay(error)).toBe(5000);
  });

  it('should parse retry-after from error message', () => {
    const error = new Error('Rate limit exceeded, retry after 10 seconds');
    expect(extractRetryAfterDelay(error)).toBe(10000);
  });

  it('should return undefined if no retry-after info', () => {
    const error = new Error('Some error');
    expect(extractRetryAfterDelay(error)).toBeUndefined();
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');
    
    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));
    
    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })
    ).rejects.toThrow('Network error');
    
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Authentication failed'));
    
    await expect(
      withRetry(fn, { maxAttempts: 3 })
    ).rejects.toThrow('Authentication failed');
    
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle rate limit with retry-after', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError('Rate limited', 50))
      .mockResolvedValue('success');
    
    const startTime = Date.now();
    const result = await withRetry(fn, { maxAttempts: 3 });
    const duration = Date.now() - startTime;
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(duration).toBeGreaterThanOrEqual(45); // Should wait ~50ms
  });
});

describe('RateLimiter', () => {
  it('should enforce rate limit', async () => {
    const limiter = new RateLimiter(10); // 10 requests per second = 100ms between requests
    const fn = vi.fn().mockResolvedValue('success');
    
    const startTime = Date.now();
    
    await limiter.execute(fn);
    await limiter.execute(fn);
    await limiter.execute(fn);
    
    const duration = Date.now() - startTime;
    
    expect(fn).toHaveBeenCalledTimes(3);
    expect(duration).toBeGreaterThanOrEqual(180); // Should take at least 200ms (2 delays of 100ms)
  });

  it('should not delay first execution', async () => {
    const limiter = new RateLimiter(1);
    const fn = vi.fn().mockResolvedValue('success');
    
    const startTime = Date.now();
    await limiter.execute(fn);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(50); // Should be nearly instant
  });

  it('should reset state', async () => {
    const limiter = new RateLimiter(1);
    const fn = vi.fn().mockResolvedValue('success');
    
    await limiter.execute(fn);
    limiter.reset();
    
    const startTime = Date.now();
    await limiter.execute(fn);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(50); // Should be instant after reset
  });
});
