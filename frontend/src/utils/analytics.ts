import ReactGA from 'react-ga4';

const GA_MEASUREMENT_ID = (import.meta as { env?: { VITE_GA_TRACKING_ID?: string } }).env?.VITE_GA_TRACKING_ID;

let isInitialized = false;

/**
 * Initialize Google Analytics 4
 * Call this once when the app starts
 */
export const initGA = () => {
  if (GA_MEASUREMENT_ID && !isInitialized) {
    ReactGA.initialize(GA_MEASUREMENT_ID, {
      gaOptions: {
        siteSpeedSampleRate: 100, // Sample 100% of users for site speed
      },
    });
    isInitialized = true;
    console.log('Google Analytics initialized:', GA_MEASUREMENT_ID);
  } else if (!GA_MEASUREMENT_ID) {
    console.warn('Google Analytics tracking ID not found. Analytics will not be tracked.');
  }
};

/**
 * Track a page view
 * @param path - The page path (e.g., '/products/123')
 */
export const trackPageView = (path: string) => {
  if (!isInitialized) return;
  
  ReactGA.send({ hitType: 'pageview', page: path });
};

/**
 * Track a custom event
 * @param category - Event category (e.g., 'Product', 'User', 'Navigation')
 * @param action - Event action (e.g., 'View', 'Click', 'Search')
 * @param label - Optional event label
 * @param value - Optional numeric value
 */
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  if (!isInitialized) return;

  ReactGA.event({
    category,
    action,
    label,
    value,
  });
};

/**
 * Track when a user views a product
 * @param productId - Product ID
 * @param productName - Product name
 * @param category - Product category
 * @param price - Product price
 */
export const trackProductView = (
  productId: string,
  productName: string,
  category?: string,
  price?: string
) => {
  if (!isInitialized) return;

  // Standard event
  trackEvent('Product', 'View', productName);

  // Enhanced ecommerce event
  ReactGA.event('view_item', {
    currency: 'USD',
    value: price ? parseFloat(price.replace(/[^0-9.]/g, '')) : 0,
    items: [
      {
        item_id: productId,
        item_name: productName,
        item_category: category,
        price: price ? parseFloat(price.replace(/[^0-9.]/g, '')) : 0,
      },
    ],
  });
};

/**
 * Track when a user clicks an affiliate link
 * This is the most important conversion event for your platform
 * @param productId - Product ID
 * @param productName - Product name
 * @param amazonLink - Amazon affiliate link
 * @param category - Product category
 * @param price - Product price
 */
export const trackAffiliateClick = (
  productId: string,
  productName: string,
  amazonLink: string,
  category?: string,
  price?: string
) => {
  if (!isInitialized) return;

  // Standard event
  trackEvent('Affiliate', 'Click', productName);

  // Custom conversion event for affiliate clicks
  ReactGA.event('affiliate_click', {
    product_id: productId,
    product_name: productName,
    link: amazonLink,
    category: category,
    value: price ? parseFloat(price.replace(/[^0-9.]/g, '')) : 0,
  });

  // Track as a conversion (select_content is a standard GA4 event)
  ReactGA.event('select_content', {
    content_type: 'affiliate_link',
    item_id: productId,
  });
};

/**
 * Track when a user views a category
 * @param category - Category name
 */
export const trackCategoryView = (category: string) => {
  if (!isInitialized) return;

  trackEvent('Category', 'View', category);
  
  ReactGA.event('view_item_list', {
    item_list_name: category,
  });
};

/**
 * Track search queries
 * @param searchTerm - The search term
 * @param resultsCount - Number of results found
 */
export const trackSearch = (searchTerm: string, resultsCount?: number) => {
  if (!isInitialized) return;

  trackEvent('Search', 'Query', searchTerm, resultsCount);

  ReactGA.event('search', {
    search_term: searchTerm,
  });
};

/**
 * Track when a user shares a product
 * @param productId - Product ID
 * @param productName - Product name
 * @param method - Share method (e.g., 'facebook', 'twitter', 'pinterest')
 */
export const trackShare = (
  productId: string,
  productName: string,
  method: string
) => {
  if (!isInitialized) return;

  trackEvent('Social', 'Share', `${method} - ${productName}`);

  ReactGA.event('share', {
    method: method,
    content_type: 'product',
    item_id: productId,
  });
};

/**
 * Track user engagement time on a product
 * @param productId - Product ID
 * @param timeSpent - Time spent in seconds
 */
export const trackEngagement = (productId: string, timeSpent: number) => {
  if (!isInitialized) return;

  trackEvent('Engagement', 'TimeSpent', productId, timeSpent);
};

/**
 * Track errors for debugging
 * @param errorMessage - Error message
 * @param errorLocation - Where the error occurred
 * @param fatal - Whether the error is fatal
 */
export const trackError = (
  errorMessage: string,
  errorLocation: string,
  fatal: boolean = false
) => {
  if (!isInitialized) return;

  ReactGA.event('exception', {
    description: `${errorLocation}: ${errorMessage}`,
    fatal: fatal,
  });
};

/**
 * Set user properties (for logged-in admins)
 * @param userId - User ID
 * @param properties - Additional user properties
 */
export const setUserProperties = (userId: string, properties?: Record<string, any>) => {
  if (!isInitialized) return;

  ReactGA.set({
    userId: userId,
    ...properties,
  });
};

/**
 * Track timing (e.g., API response times, page load times)
 * @param category - Timing category
 * @param variable - Timing variable name
 * @param value - Time in milliseconds
 * @param label - Optional label
 */
export const trackTiming = (
  category: string,
  variable: string,
  value: number,
  label?: string
) => {
  if (!isInitialized) return;

  ReactGA.event('timing_complete', {
    name: variable,
    value: value,
    event_category: category,
    event_label: label,
  });
};
