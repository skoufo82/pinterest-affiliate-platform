import imageCompression from 'browser-image-compression';

/**
 * Options for image optimization
 */
export interface ImageOptimizationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
}

/**
 * Optimized image result with multiple formats
 */
export interface OptimizedImage {
  original: File;
  compressed: File;
  webp?: File;
  sizes: {
    small: File;
    medium: File;
    large: File;
  };
}

/**
 * Compress an image file
 */
export async function compressImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<File> {
  const defaultOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.8,
    ...options,
  };

  try {
    const compressedFile = await imageCompression(file, defaultOptions);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to compress image');
  }
}

/**
 * Convert image to WebP format
 */
export async function convertToWebP(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const webpFile = new File(
                [blob],
                file.name.replace(/\.[^.]+$/, '.webp'),
                { type: 'image/webp' }
              );
              resolve(webpFile);
            } else {
              resolve(null);
            }
          },
          'image/webp',
          0.8
        );
      };
      
      img.onerror = () => resolve(null);
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Generate multiple sizes of an image for responsive loading
 */
export async function generateResponsiveSizes(
  file: File
): Promise<{ small: File; medium: File; large: File }> {
  const [small, medium, large] = await Promise.all([
    compressImage(file, { maxWidthOrHeight: 640, maxSizeMB: 0.3 }),
    compressImage(file, { maxWidthOrHeight: 1024, maxSizeMB: 0.6 }),
    compressImage(file, { maxWidthOrHeight: 1920, maxSizeMB: 1 }),
  ]);

  return { small, medium, large };
}

/**
 * Optimize image with compression and WebP conversion
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<{ compressed: File; webp: File | null }> {
  // Compress the image
  const compressed = await compressImage(file, options);
  
  // Try to convert to WebP
  const webp = await convertToWebP(compressed);
  
  return { compressed, webp };
}

/**
 * Get image dimensions from file
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Check if browser supports WebP
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webpData = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
    const img = new Image();
    
    img.onload = () => resolve(img.width === 1);
    img.onerror = () => resolve(false);
    img.src = webpData;
  });
}
