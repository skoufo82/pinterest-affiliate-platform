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

export function validateCreator(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.displayName || typeof data.displayName !== 'string' || data.displayName.length > 100) {
    errors.push('Display name is required and must be a string with max 100 characters');
  }

  if (!data.bio || typeof data.bio !== 'string' || data.bio.length > 500) {
    errors.push('Bio is required and must be a string with max 500 characters');
  }

  if (!data.profileImage || typeof data.profileImage !== 'string') {
    errors.push('Profile image is required and must be a string');
  }

  if (!data.coverImage || typeof data.coverImage !== 'string') {
    errors.push('Cover image is required and must be a string');
  }

  if (data.socialLinks !== undefined) {
    if (typeof data.socialLinks !== 'object' || data.socialLinks === null) {
      errors.push('Social links must be an object');
    } else {
      const socialLinks = data.socialLinks as Record<string, unknown>;
      
      if (socialLinks.instagram !== undefined && typeof socialLinks.instagram !== 'string') {
        errors.push('Instagram link must be a string');
      }
      
      if (socialLinks.pinterest !== undefined && typeof socialLinks.pinterest !== 'string') {
        errors.push('Pinterest link must be a string');
      }
      
      if (socialLinks.tiktok !== undefined && typeof socialLinks.tiktok !== 'string') {
        errors.push('TikTok link must be a string');
      }
    }
  }

  if (data.theme !== undefined) {
    if (typeof data.theme !== 'object' || data.theme === null) {
      errors.push('Theme must be an object');
    } else {
      const theme = data.theme as Record<string, unknown>;
      
      if (!theme.primaryColor || typeof theme.primaryColor !== 'string') {
        errors.push('Theme primary color is required and must be a string');
      } else if (!/^#[0-9A-Fa-f]{6}$/.test(theme.primaryColor)) {
        errors.push('Theme primary color must be a valid hex color (e.g., #FF5733)');
      }
      
      if (!theme.accentColor || typeof theme.accentColor !== 'string') {
        errors.push('Theme accent color is required and must be a string');
      } else if (!/^#[0-9A-Fa-f]{6}$/.test(theme.accentColor)) {
        errors.push('Theme accent color must be a valid hex color (e.g., #FF5733)');
      }
      
      if (!theme.font || typeof theme.font !== 'string') {
        errors.push('Theme font is required and must be a string');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCreatorUpdate(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.displayName !== undefined) {
    if (typeof data.displayName !== 'string' || data.displayName.length > 100) {
      errors.push('Display name must be a string with max 100 characters');
    }
  }

  if (data.bio !== undefined) {
    if (typeof data.bio !== 'string' || data.bio.length > 500) {
      errors.push('Bio must be a string with max 500 characters');
    }
  }

  if (data.profileImage !== undefined && typeof data.profileImage !== 'string') {
    errors.push('Profile image must be a string');
  }

  if (data.coverImage !== undefined && typeof data.coverImage !== 'string') {
    errors.push('Cover image must be a string');
  }

  if (data.socialLinks !== undefined) {
    if (typeof data.socialLinks !== 'object' || data.socialLinks === null) {
      errors.push('Social links must be an object');
    } else {
      const socialLinks = data.socialLinks as Record<string, unknown>;
      
      if (socialLinks.instagram !== undefined && typeof socialLinks.instagram !== 'string') {
        errors.push('Instagram link must be a string');
      }
      
      if (socialLinks.pinterest !== undefined && typeof socialLinks.pinterest !== 'string') {
        errors.push('Pinterest link must be a string');
      }
      
      if (socialLinks.tiktok !== undefined && typeof socialLinks.tiktok !== 'string') {
        errors.push('TikTok link must be a string');
      }
    }
  }

  if (data.theme !== undefined) {
    if (typeof data.theme !== 'object' || data.theme === null) {
      errors.push('Theme must be an object');
    } else {
      const theme = data.theme as Record<string, unknown>;
      
      if (theme.primaryColor !== undefined) {
        if (typeof theme.primaryColor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(theme.primaryColor)) {
          errors.push('Theme primary color must be a valid hex color (e.g., #FF5733)');
        }
      }
      
      if (theme.accentColor !== undefined) {
        if (typeof theme.accentColor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(theme.accentColor)) {
          errors.push('Theme accent color must be a valid hex color (e.g., #FF5733)');
        }
      }
      
      if (theme.font !== undefined && typeof theme.font !== 'string') {
        errors.push('Theme font must be a string');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
