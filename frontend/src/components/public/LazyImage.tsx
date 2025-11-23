import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: string | number;
  height?: string | number;
  sizes?: string;
}

export const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  width, 
  height,
  sizes 
}: LazyImageProps) => {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Set fallback image on error
    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="18" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
  };

  // Generate srcset for responsive images with multiple sizes
  const generateSrcSet = (url: string) => {
    // Generate responsive image URLs for different viewport sizes
    // In production, these would be different sized versions from S3/CloudFront
    const widths = [400, 800, 1200, 1600];
    return widths.map(w => `${url} ${w}w`).join(', ');
  };

  // Generate WebP source URL
  const getWebPUrl = (url: string) => {
    // If the URL already has WebP extension, return as is
    if (url.endsWith('.webp')) {
      return url;
    }
    // Otherwise, try to get WebP version (assumes CDN/S3 can serve WebP)
    // In production, you might have a separate WebP version or use query params
    return url.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  };

  // Default sizes based on typical layouts
  const defaultSizes = sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

  const webpUrl = getWebPUrl(src);
  const hasWebP = webpUrl !== src;

  return (
    <picture>
      {/* WebP source with fallback */}
      {hasWebP && (
        <source
          type="image/webp"
          srcSet={generateSrcSet(webpUrl)}
          sizes={defaultSizes}
        />
      )}
      
      {/* Original format fallback */}
      <LazyLoadImage
        src={src}
        srcSet={generateSrcSet(src)}
        sizes={defaultSizes}
        alt={alt}
        className={className}
        width={width}
        height={height}
        effect="blur"
        placeholder={
          <div 
            className={`bg-gray-200 animate-pulse ${className}`}
            style={{ width, height }}
          />
        }
        onError={handleError}
      />
    </picture>
  );
};
