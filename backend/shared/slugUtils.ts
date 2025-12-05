// Utility functions for generating and validating URL-safe slugs

/**
 * Converts a username to a URL-safe slug
 * - Converts to lowercase
 * - Replaces spaces and underscores with hyphens
 * - Removes all characters except lowercase letters, numbers, and hyphens
 * - Removes leading/trailing hyphens
 * - Collapses multiple consecutive hyphens into one
 */
export function generateSlug(username: string): string {
  return username
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove all non-alphanumeric characters except hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/-+/g, '-'); // Collapse multiple hyphens
}

/**
 * Validates that a slug contains only URL-safe characters
 * - Must contain only lowercase letters, numbers, and hyphens
 * - Cannot start or end with a hyphen
 * - Cannot be empty
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0) {
    return false;
  }
  
  // Check for valid characters only (lowercase letters, numbers, hyphens)
  const validCharsRegex = /^[a-z0-9-]+$/;
  if (!validCharsRegex.test(slug)) {
    return false;
  }
  
  // Check that it doesn't start or end with a hyphen
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return false;
  }
  
  return true;
}
