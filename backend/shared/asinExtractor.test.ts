import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractASIN, validateASIN } from './asinExtractor';

describe('validateASIN', () => {
  it('should validate correct ASIN format', () => {
    expect(validateASIN('B08N5WRWNW')).toBe(true);
    expect(validateASIN('0123456789')).toBe(true);
    expect(validateASIN('ABCDEFGHIJ')).toBe(true);
    expect(validateASIN('A1B2C3D4E5')).toBe(true);
  });

  it('should reject invalid ASIN formats', () => {
    expect(validateASIN('B08N5WRWN')).toBe(false); // Too short
    expect(validateASIN('B08N5WRWNWX')).toBe(false); // Too long
    expect(validateASIN('b08n5wrwnw')).toBe(false); // Lowercase
    expect(validateASIN('B08N5-WRWNW')).toBe(false); // Contains hyphen
    expect(validateASIN('B08N5 WRWNW')).toBe(false); // Contains space
    expect(validateASIN('')).toBe(false); // Empty string
    expect(validateASIN(null as any)).toBe(false); // Null
    expect(validateASIN(undefined as any)).toBe(false); // Undefined
  });
});

describe('extractASIN', () => {
  describe('standard Amazon URLs', () => {
    it('should extract ASIN from /dp/ URLs', () => {
      expect(extractASIN('https://www.amazon.com/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://amazon.com/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('http://www.amazon.com/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from /gp/product/ URLs', () => {
      expect(extractASIN('https://www.amazon.com/gp/product/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://amazon.com/gp/product/B08N5WRWNW/')).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from URLs with product names', () => {
      expect(extractASIN('https://www.amazon.com/Product-Name-Here/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://www.amazon.com/Some-Product/dp/B08N5WRWNW/ref=sr_1_1')).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from URLs with query parameters', () => {
      expect(extractASIN('https://www.amazon.com/dp/B08N5WRWNW?tag=mytag-20')).toBe('B08N5WRWNW');
      expect(extractASIN('https://www.amazon.com/dp/B08N5WRWNW?ref=nav_logo&tag=mytag-20')).toBe('B08N5WRWNW');
    });
  });

  describe('mobile Amazon URLs', () => {
    it('should extract ASIN from mobile URLs', () => {
      expect(extractASIN('https://m.amazon.com/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://m.amazon.com/gp/product/B08N5WRWNW')).toBe('B08N5WRWNW');
    });
  });

  describe('international Amazon domains', () => {
    it('should extract ASIN from amazon.co.uk', () => {
      expect(extractASIN('https://www.amazon.co.uk/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from amazon.de', () => {
      expect(extractASIN('https://www.amazon.de/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from amazon.ca', () => {
      expect(extractASIN('https://www.amazon.ca/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from amazon.fr', () => {
      expect(extractASIN('https://www.amazon.fr/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
    });
  });

  describe('short links', () => {
    it('should extract ASIN from amzn.to short links', () => {
      expect(extractASIN('https://amzn.to/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://amzn.to/3xYz123456')).toBe('3XYZ123456');
    });

    it('should extract ASIN from a.co short links', () => {
      expect(extractASIN('https://a.co/d/B08N5WRWNW')).toBe('B08N5WRWNW');
    });
  });

  describe('ASIN in query parameters', () => {
    it('should extract ASIN from asin query parameter', () => {
      expect(extractASIN('https://www.amazon.com/product?asin=B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('https://www.amazon.com/product?tag=mytag&asin=B08N5WRWNW')).toBe('B08N5WRWNW');
    });
  });

  describe('URLs without protocol', () => {
    it('should handle URLs without https://', () => {
      expect(extractASIN('www.amazon.com/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
      expect(extractASIN('amazon.com/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
    });
  });

  describe('invalid URLs', () => {
    it('should return null for non-Amazon URLs', () => {
      expect(extractASIN('https://www.google.com/search?q=B08N5WRWNW')).toBe(null);
      expect(extractASIN('https://www.ebay.com/itm/B08N5WRWNW')).toBe(null);
    });

    it('should return null for Amazon URLs without ASIN', () => {
      expect(extractASIN('https://www.amazon.com')).toBe(null);
      expect(extractASIN('https://www.amazon.com/bestsellers')).toBe(null);
    });

    it('should return null for invalid ASIN format', () => {
      expect(extractASIN('https://www.amazon.com/dp/B08N5')).toBe(null); // Too short
      expect(extractASIN('https://www.amazon.com/dp/invalid')).toBe(null); // Not alphanumeric
    });

    it('should return null for empty or invalid input', () => {
      expect(extractASIN('')).toBe(null);
      expect(extractASIN(null as any)).toBe(null);
      expect(extractASIN(undefined as any)).toBe(null);
      expect(extractASIN('not a url')).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should handle URLs with multiple potential ASINs (use first valid)', () => {
      // In real URLs, there should only be one ASIN, but if multiple exist, we take the first valid one
      expect(extractASIN('https://www.amazon.com/dp/B08N5WRWNW/ref/B123456789')).toBe('B08N5WRWNW');
    });

    it('should handle case-insensitive ASINs in URLs', () => {
      expect(extractASIN('https://www.amazon.com/dp/b08n5wrwnw')).toBe('B08N5WRWNW');
    });

    it('should handle URLs with trailing slashes', () => {
      expect(extractASIN('https://www.amazon.com/dp/B08N5WRWNW/')).toBe('B08N5WRWNW');
      expect(extractASIN('https://www.amazon.com/dp/B08N5WRWNW///')).toBe('B08N5WRWNW');
    });
  });
});

// Property-Based Tests
describe('Property-Based Tests', () => {
  /**
   * Feature: amazon-price-sync, Property 5: ASIN extraction correctness
   * Validates: Requirements 4.1, 4.4
   * 
   * Property: For any valid Amazon URL format containing a valid ASIN,
   * the ASIN extractor should return the correct 10-character ASIN
   */
  it('Property 5: ASIN extraction correctness - should extract correct ASIN from any valid Amazon URL format', () => {
    // Generator for valid ASINs (10 characters, alphanumeric uppercase, must contain at least one digit)
    const asinArbitrary = fc.tuple(
      fc.constantFrom('B', 'A', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), // First char
      fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 9, maxLength: 9 })
    ).map(([first, rest]) => {
      const asin = first + rest.join('');
      // Ensure at least one digit exists
      if (!/\d/.test(asin)) {
        // Replace a random character with a digit
        const pos = Math.floor(Math.random() * 10);
        const digit = String(Math.floor(Math.random() * 10));
        return asin.substring(0, pos) + digit + asin.substring(pos + 1);
      }
      return asin;
    });

    // Generator for Amazon domains
    const domainArbitrary = fc.constantFrom(
      'www.amazon.com',
      'amazon.com',
      'm.amazon.com',
      'www.amazon.co.uk',
      'amazon.co.uk',
      'www.amazon.de',
      'amazon.de',
      'www.amazon.ca',
      'amazon.ca',
      'www.amazon.fr',
      'amazon.fr',
      'www.amazon.it',
      'amazon.it',
      'www.amazon.es',
      'amazon.es',
      'amzn.to',
      'a.co'
    );

    // Generator for URL patterns
    const urlPatternArbitrary = fc.constantFrom(
      (domain: string, asin: string) => `https://${domain}/dp/${asin}`,
      (domain: string, asin: string) => `https://${domain}/gp/product/${asin}`,
      (domain: string, asin: string) => `https://${domain}/product/${asin}`,
      (domain: string, asin: string) => `https://${domain}/Product-Name/dp/${asin}`,
      (domain: string, asin: string) => `https://${domain}/Some-Product-Title/dp/${asin}/ref=sr_1_1`,
      (domain: string, asin: string) => `https://${domain}/dp/${asin}?tag=mytag-20`,
      (domain: string, asin: string) => `https://${domain}/dp/${asin}?ref=nav&tag=mytag-20`,
      (domain: string, asin: string) => `https://${domain}/gp/product/${asin}/`,
      (domain: string, asin: string) => `http://${domain}/dp/${asin}`,
      (domain: string, asin: string) => domain.includes('amzn.to') || domain.includes('a.co') 
        ? `https://${domain}/${asin}` 
        : `https://${domain}/dp/${asin}`,
      (domain: string, asin: string) => domain.includes('a.co') 
        ? `https://${domain}/d/${asin}` 
        : `https://${domain}/dp/${asin}`,
      (domain: string, asin: string) => `https://${domain}/product?asin=${asin}`,
    );

    // Generator for optional protocol
    const protocolArbitrary = fc.constantFrom('https://', 'http://', '');

    // Property: extractASIN should return the correct ASIN for any valid Amazon URL
    fc.assert(
      fc.property(
        asinArbitrary,
        domainArbitrary,
        urlPatternArbitrary,
        protocolArbitrary,
        (asin, domain, urlPattern, protocol) => {
          // Generate URL using the pattern
          let url = urlPattern(domain, asin);
          
          // Apply protocol variation
          if (protocol === '') {
            url = url.replace(/^https?:\/\//, '');
          } else if (protocol === 'http://') {
            url = url.replace(/^https:\/\//, 'http://');
          }
          
          // Extract ASIN from the generated URL
          const extractedASIN = extractASIN(url);
          
          // The extracted ASIN should match the original ASIN (case-insensitive comparison)
          expect(extractedASIN).toBe(asin.toUpperCase());
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });
});
