import { useEffect } from 'react';
import { Product } from '@/types';
import { LazyImage } from './LazyImage';
import { ShareButton } from './ShareButton';
import {
  getPriceDisplayText,
  formatPriceUpdateTime,
  shouldShowStaleWarning,
} from '@/utils/priceDisplay';

interface ProductModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ProductModal component for displaying full product details
 * Includes large image, full description, Amazon affiliate button, and Pinterest share button
 */
export const ProductModal = ({ product, isOpen, onClose }: ProductModalProps) => {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop itself, not its children
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleShopNow = () => {
    window.open(product.amazonLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <div className="sticky top-0 right-0 flex justify-end p-4 bg-white z-10">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 rounded-md p-1"
            aria-label="Close product details"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 md:px-8 md:pb-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Large Product Image */}
            <div className="flex items-start justify-center">
              <LazyImage
                src={product.imageUrl}
                alt={product.title}
                className="w-full h-auto rounded-lg shadow-md"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

            {/* Product Details */}
            <div className="flex flex-col">
              <h2 id="product-modal-title" className="text-3xl font-bold text-gray-900 mb-4">
                {product.title}
              </h2>

              {/* Price Display - Only show if price exists */}
              {product.price && (
                <div className="mb-4">
                  <div
                    className="text-2xl font-bold mb-1 text-pink-600"
                    aria-label={`Price: ${getPriceDisplayText(product.price)}`}
                  >
                    {getPriceDisplayText(product.price)}
                  </div>

                  {/* Price Update Info */}
                  {product.priceLastUpdated && (
                    <div className="text-sm text-gray-500">
                      Price last updated {formatPriceUpdateTime(product.priceLastUpdated)}
                    </div>
                  )}

                  {/* Stale Price Warning */}
                  {shouldShowStaleWarning(product.price, product.priceLastUpdated) && (
                    <div className="text-sm text-amber-600 mt-2 flex items-center bg-amber-50 px-3 py-2 rounded-md">
                      <svg
                        className="w-4 h-4 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Price may have changed on Amazon
                    </div>
                  )}
                </div>
              )}

              {/* Full Description */}
              <div className="text-gray-700 mb-6 leading-relaxed">
                {product.description}
              </div>

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6" role="list" aria-label="Product tags">
                  {product.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                      role="listitem"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                {/* Amazon Affiliate Button */}
                <button
                  onClick={handleShopNow}
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
                  aria-label={`Shop now for ${product.title} on Amazon`}
                >
                  Shop Now on Amazon
                </button>

                {/* Pinterest Share Button */}
                <ShareButton product={product} className="flex-1 justify-center" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
