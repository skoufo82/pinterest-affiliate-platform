/**
 * Utility functions for displaying price information with sync status
 */

/**
 * Calculate if a price is stale (older than 7 days)
 */
export function isPriceStale(priceLastUpdated?: string): boolean {
  if (!priceLastUpdated) return false;
  
  const lastUpdated = new Date(priceLastUpdated);
  const now = new Date();
  const daysDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  
  return daysDiff > 7;
}

/**
 * Format the price last updated timestamp for display
 */
export function formatPriceUpdateTime(priceLastUpdated?: string): string {
  if (!priceLastUpdated) return '';
  
  const date = new Date(priceLastUpdated);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Get the appropriate price display text
 */
export function getPriceDisplayText(price?: string): string {
  return price || 'Price not available';
}

/**
 * Check if price should show a staleness warning
 */
export function shouldShowStaleWarning(
  price?: string,
  priceLastUpdated?: string
): boolean {
  return !!price && isPriceStale(priceLastUpdated);
}
