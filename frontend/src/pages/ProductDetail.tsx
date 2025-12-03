import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProductStore } from '@/stores/productStore';
import { LazyImage, ShareButton } from '@/components/public';
import {
  updateSEOMetadata,
  getProductSEO,
  generateProductStructuredData,
  updateStructuredData,
  removeStructuredData,
} from '@/utils/seo';
import {
  getPriceDisplayText,
  formatPriceUpdateTime,
  shouldShowStaleWarning,
} from '@/utils/priceDisplay';

function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedProduct, loading, error, fetchProduct } = useProductStore();

  // Fetch product on mount
  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id, fetchProduct]);

  // Update SEO metadata and structured data when product loads
  useEffect(() => {
    if (selectedProduct) {
      updateSEOMetadata(getProductSEO(selectedProduct));
      const structuredData = generateProductStructuredData(selectedProduct);
      updateStructuredData(structuredData);
    }

    // Cleanup structured data on unmount
    return () => {
      removeStructuredData();
    };
  }, [selectedProduct]);

  const handleShopNow = () => {
    if (selectedProduct) {
      window.open(selectedProduct.amazonLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        {/* Back Button */}
        <button
          onClick={handleBackClick}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center max-w-2xl mx-auto">
            <p className="font-semibold">Error loading product</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Product Details */}
        {!loading && !error && selectedProduct && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="grid md:grid-cols-2 gap-8 p-6 md:p-8">
              {/* Large Product Image */}
              <div className="flex items-start justify-center">
                <LazyImage
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.title}
                  className="w-full h-auto rounded-lg shadow-md"
                />
              </div>

              {/* Product Details */}
              <div className="flex flex-col">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {selectedProduct.title}
                </h1>

                {/* Price Display */}
                <div className="mb-4">
                  <div
                    className={`text-2xl md:text-3xl font-bold mb-1 ${
                      selectedProduct.price ? 'text-pink-600' : 'text-gray-500'
                    }`}
                  >
                    {getPriceDisplayText(selectedProduct.price)}
                  </div>

                  {/* Price Update Info */}
                  {selectedProduct.priceLastUpdated && (
                    <div className="text-sm text-gray-500">
                      Price last updated {formatPriceUpdateTime(selectedProduct.priceLastUpdated)}
                    </div>
                  )}

                  {/* Stale Price Warning */}
                  {shouldShowStaleWarning(
                    selectedProduct.price,
                    selectedProduct.priceLastUpdated
                  ) && (
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

                {/* Full Description */}
                <div className="text-gray-700 mb-6 leading-relaxed">
                  {selectedProduct.description}
                </div>

                {/* Tags */}
                {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {selectedProduct.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
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
                    className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    Shop Now on Amazon
                  </button>

                  {/* Pinterest Share Button */}
                  <ShareButton
                    product={selectedProduct}
                    className="flex-1 justify-center"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Not Found State */}
        {!loading && !error && !selectedProduct && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-4">Product not found.</p>
            <button
              onClick={handleBackClick}
              className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
            >
              Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductDetail;
