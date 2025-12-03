/**
 * ASIN Extraction and Validation Utility
 * 
 * Extracts Amazon Standard Identification Numbers (ASINs) from various Amazon URL formats
 * and validates them according to Amazon's 10-character alphanumeric standard.
 * 
 * Supports:
 * - Standard Amazon URLs: amazon.com/dp/ASIN, amazon.com/gp/product/ASIN
 * - Short links: amzn.to/ASIN, a.co/d/ASIN
 * - Mobile URLs: amazon.com/...?...&asin=ASIN
 * - International domains: amazon.co.uk, amazon.de, etc.
 */

/**
 * Validates if a string matches the ASIN format
 * ASINs are exactly 10 characters, alphanumeric (A-Z, 0-9)
 * 
 * @param asin - The string to validate
 * @returns true if valid ASIN format, false otherwise
 */
export function validateASIN(asin: string): boolean {
  if (!asin || typeof asin !== 'string') {
    return false;
  }
  
  // ASIN must be exactly 10 characters, alphanumeric
  const asinRegex = /^[A-Z0-9]{10}$/;
  return asinRegex.test(asin);
}

/**
 * Extracts ASIN from an Amazon URL
 * 
 * Supports multiple URL formats:
 * - https://www.amazon.com/dp/B08N5WRWNW
 * - https://www.amazon.com/gp/product/B08N5WRWNW
 * - https://www.amazon.com/Product-Name/dp/B08N5WRWNW/ref=...
 * - https://amzn.to/3xYz123 (short links - ASIN in path)
 * - https://a.co/d/B08N5WRWNW
 * - https://www.amazon.com/...?asin=B08N5WRWNW
 * - https://m.amazon.com/... (mobile URLs)
 * - International domains: amazon.co.uk, amazon.de, amazon.ca, etc.
 * 
 * @param url - The Amazon URL to extract ASIN from
 * @returns The extracted ASIN if found and valid, null otherwise
 */
export function extractASIN(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Normalize the URL - handle cases without protocol
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    // Verify it's an Amazon domain
    const isAmazonDomain = 
      hostname.includes('amazon.com') ||
      hostname.includes('amazon.co.') ||
      hostname.includes('amazon.de') ||
      hostname.includes('amazon.fr') ||
      hostname.includes('amazon.it') ||
      hostname.includes('amazon.es') ||
      hostname.includes('amazon.ca') ||
      hostname.includes('amazon.com.') ||
      hostname.includes('amzn.to') ||
      hostname.includes('a.co');

    if (!isAmazonDomain) {
      return null;
    }

    // Strategy 1: Check for ASIN in query parameters
    const asinParam = searchParams.get('asin') || searchParams.get('ASIN');
    if (asinParam && validateASIN(asinParam)) {
      return asinParam;
    }

    // Strategy 2: Extract from common path patterns
    // Patterns: /dp/ASIN, /gp/product/ASIN, /product/ASIN, /d/ASIN
    const pathPatterns = [
      /\/dp\/([A-Z0-9]{10})/i,
      /\/gp\/product\/([A-Z0-9]{10})/i,
      /\/product\/([A-Z0-9]{10})/i,
      /\/d\/([A-Z0-9]{10})/i,
      /\/exec\/obidos\/ASIN\/([A-Z0-9]{10})/i,
    ];

    for (const pattern of pathPatterns) {
      const match = pathname.match(pattern);
      if (match && match[1]) {
        const asin = match[1].toUpperCase();
        if (validateASIN(asin)) {
          return asin;
        }
      }
    }

    // Strategy 3: For short links (amzn.to, a.co), extract potential ASIN from path
    if (hostname.includes('amzn.to') || hostname.includes('a.co')) {
      // Short links may have ASIN directly in path or as last segment
      const pathSegments = pathname.split('/').filter(seg => seg.length > 0);
      for (const segment of pathSegments) {
        const cleaned = segment.toUpperCase();
        if (validateASIN(cleaned)) {
          return cleaned;
        }
      }
    }

    // Strategy 4: Look for any 10-character alphanumeric sequence in the path
    // This is a fallback for unusual URL formats
    // ASINs typically contain at least one digit, so we filter out pure letter sequences
    const potentialASINs = pathname.match(/[A-Z0-9]{10}/gi);
    if (potentialASINs && potentialASINs.length > 0) {
      for (const potential of potentialASINs) {
        const asin = potential.toUpperCase();
        // Additional check: ASINs typically contain at least one digit
        // This helps avoid false positives like "BESTSELLER"
        if (validateASIN(asin) && /\d/.test(asin)) {
          return asin;
        }
      }
    }

    // No valid ASIN found
    return null;
  } catch (error) {
    // Invalid URL format
    return null;
  }
}
