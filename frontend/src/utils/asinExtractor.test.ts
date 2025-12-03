import { describe, it, expect } from 'vitest';
import { extractASIN, validateASIN } from './asinExtractor';

describe('ASIN Extractor', () => {
  describe('validateASIN', () => {
    it('should validate correct ASINs', () => {
      expect(validateASIN('B08N5WRWNW')).toBe(true);
      expect(validateASIN('1234567890')).toBe(true);
      expect(validateASIN('ABCD123456')).toBe(true);
    });

    it('should reject invalid ASINs', () => {
      expect(validateASIN('B08N5WRWN')).toBe(false); // Too short
      expect(validateASIN('B08N5WRWNWX')).toBe(false); // Too long
      expect(validateASIN('B08N5-WRWN')).toBe(false); // Invalid character
      expect(validateASIN('')).toBe(false); // Empty
    });
  });

  describe('extractASIN', () => {
    it('should extract ASIN from standard Amazon URLs', () => {
      expect(extractASIN('https://www.amazon.com/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://www.amazon.com/gp/product/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://www.amazon.com/Product-Name/dp/B08N5WRWNW/ref=xyz')).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from short links', () => {
      expect(extractASIN('https://amzn.to/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://a.co/d/B08N5WRWNW')).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from query parameters', () => {
      expect(extractASIN('https://www.amazon.com/s?asin=B08N5WRWNW')).toBe('B08N5WRWNW');
    });

    it('should return null for invalid URLs', () => {
      expect(extractASIN('https://google.com')).toBe(null);
      expect(extractASIN('not a url')).toBe(null);
      expect(extractASIN('')).toBe(null);
    });

    it('should handle international Amazon domains', () => {
      expect(extractASIN('https://www.amazon.co.uk/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://www.amazon.de/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://www.amazon.ca/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
    });
  });
});
