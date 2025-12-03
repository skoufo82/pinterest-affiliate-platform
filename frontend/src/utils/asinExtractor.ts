/**
 * ASIN Extraction and Validation Utility (Frontend)
 * 
 * Extracts Amazon Standard Identification Numbers (ASINs) from various Amazon URL formats
 * and validates them according to Amazon's 10-character alphanumeric standard.
 */

/**
 * Validates if a string matches the ASIN format
 * ASINs are exactly 10 characters, alphanumeric (A-Z, 0-9)
 */
export function validateASIN(asin: string): boolean {
  if (!asin || typeof asin !== 'string') {
    return false;
  }
  
  const asinRegex = /^[A-Z0-9]{10}$/;
  return asinRegex.test(asin);
}

/**
 * Extracts ASIN from an Amazon URL
 * 
 * @param url - The Amazon URL to extract ASIN from
 * @returns The extracted ASIN if found and valid, null otherwise
 */
export function extractASIN(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

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

    const asinParam = searchParams.get('asin') || searchParams.get('ASIN');
    if (asinParam && validateASIN(asinParam)) {
      return asinParam;
    }

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

    if (hostname.includes('amzn.to') || hostname.includes('a.co')) {
      const pathSegments = pathname.split('/').filter(seg => seg.length > 0);
      for (const segment of pathSegments) {
        const cleaned = segment.toUpperCase();
        if (validateASIN(cleaned)) {
          return cleaned;
        }
      }
    }

    const potentialASINs = pathname.match(/[A-Z0-9]{10}/gi);
    if (potentialASINs && potentialASINs.length > 0) {
      for (const potential of potentialASINs) {
        const asin = potential.toUpperCase();
        if (validateASIN(asin) && /\d/.test(asin)) {
          return asin;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
