// Shared validation utilities for Lambda functions

export function validateProduct(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.title || typeof data.title !== 'string' || data.title.length > 200) {
    errors.push('Title is required and must be a string with max 200 characters');
  }

  if (
    !data.description ||
    typeof data.description !== 'string' ||
    data.description.length > 2000
  ) {
    errors.push('Description is required and must be a string with max 2000 characters');
  }

  if (!data.category || typeof data.category !== 'string') {
    errors.push('Category is required and must be a string');
  }

  if (!data.imageUrl || typeof data.imageUrl !== 'string') {
    errors.push('Image URL is required and must be a string');
  }

  if (!data.amazonLink || typeof data.amazonLink !== 'string') {
    errors.push('Amazon link is required and must be a string');
  }

  if (data.price !== undefined && typeof data.price !== 'string') {
    errors.push('Price must be a string');
  }

  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    errors.push('Tags must be an array');
  }

  if (typeof data.published !== 'boolean') {
    errors.push('Published must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateImageUpload(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.fileName || typeof data.fileName !== 'string') {
    errors.push('File name is required and must be a string');
  }

  if (!data.fileType || typeof data.fileType !== 'string') {
    errors.push('File type is required and must be a string');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (data.fileType && typeof data.fileType === 'string' && !allowedTypes.includes(data.fileType)) {
    errors.push('File type must be one of: image/jpeg, image/png, image/webp');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
