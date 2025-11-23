import { Product } from '@/types';

/**
 * SEO utility functions for generating meta tags and structured data
 */

export interface SEOMetadata {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product';
}

/**
 * Update document head with SEO metadata
 */
export function updateSEOMetadata(metadata: SEOMetadata): void {
  // Update title
  document.title = metadata.title;

  // Update or create meta description
  updateMetaTag('name', 'description', metadata.description);

  // OpenGraph tags
  updateMetaTag('property', 'og:title', metadata.title);
  updateMetaTag('property', 'og:description', metadata.description);
  updateMetaTag('property', 'og:type', metadata.type || 'website');

  if (metadata.image) {
    updateMetaTag('property', 'og:image', metadata.image);
    updateMetaTag('name', 'twitter:image', metadata.image);
  }

  if (metadata.url) {
    updateMetaTag('property', 'og:url', metadata.url);
  }

  // Twitter Card tags
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', metadata.title);
  updateMetaTag('name', 'twitter:description', metadata.description);
}

/**
 * Helper function to update or create a meta tag
 */
function updateMetaTag(
  attribute: 'name' | 'property',
  attributeValue: string,
  content: string
): void {
  let element = document.querySelector(
    `meta[${attribute}="${attributeValue}"]`
  ) as HTMLMetaElement;

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, attributeValue);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

/**
 * Generate SEO metadata for home page
 */
export function getHomeSEO(): SEOMetadata {
  return {
    title: 'Pinterest Affiliate Platform - Curated Products You\'ll Love',
    description: 'Discover amazing products curated just for you. Browse our collection of handpicked items across multiple categories.',
    type: 'website',
  };
}

/**
 * Generate SEO metadata for categories page
 */
export function getCategoriesSEO(): SEOMetadata {
  return {
    title: 'Browse Categories - Pinterest Affiliate Platform',
    description: 'Explore our product categories and find exactly what you\'re looking for.',
    type: 'website',
  };
}

/**
 * Generate SEO metadata for category products page
 */
export function getCategoryProductsSEO(categoryName: string): SEOMetadata {
  return {
    title: `${categoryName} Products - Pinterest Affiliate Platform`,
    description: `Browse our curated collection of ${categoryName.toLowerCase()} products. Find the perfect items for your needs.`,
    type: 'website',
  };
}

/**
 * Generate SEO metadata for product detail page
 */
export function getProductSEO(product: Product): SEOMetadata {
  return {
    title: `${product.title} - Pinterest Affiliate Platform`,
    description: product.description.substring(0, 160), // Limit to 160 chars for meta description
    image: product.imageUrl,
    type: 'product',
  };
}

/**
 * Generate JSON-LD structured data for a product
 */
export function generateProductStructuredData(product: Product): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: product.imageUrl,
    url: window.location.href,
    ...(product.price && {
      offers: {
        '@type': 'Offer',
        price: product.price.replace(/[^0-9.]/g, ''), // Extract numeric price
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: product.amazonLink,
      },
    }),
  };

  return JSON.stringify(structuredData);
}

/**
 * Add or update JSON-LD structured data script tag
 */
export function updateStructuredData(jsonLD: string): void {
  // Remove existing structured data script if present
  const existingScript = document.querySelector(
    'script[type="application/ld+json"]'
  );
  if (existingScript) {
    existingScript.remove();
  }

  // Create new script tag
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = jsonLD;
  document.head.appendChild(script);
}

/**
 * Remove structured data script tag
 */
export function removeStructuredData(): void {
  const existingScript = document.querySelector(
    'script[type="application/ld+json"]'
  );
  if (existingScript) {
    existingScript.remove();
  }
}
