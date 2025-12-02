import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProductStore } from '@/stores/productStore';
import { ProductGrid, ProductModal } from '@/components/public';
import { ProductGridSkeleton } from '@/components/common';
import { Product } from '@/types';
import { slugToTitle } from '@/utils/slug';
import { updateSEOMetadata, getCategoryProductsSEO } from '@/utils/seo';
import { SidebarAd } from '@/components/ads/SidebarAd';
import { InFeedAd } from '@/components/ads/InFeedAd';

function CategoryProducts() {
  const { category } = useParams<{ category: string }>();
  const { products, loading, error, fetchProducts } = useProductStore();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const PRODUCTS_PER_PAGE = 20;

  // Fetch products for this category on mount or when category changes
  useEffect(() => {
    if (category) {
      fetchProducts(category);
    }
  }, [category, fetchProducts]);

  // Update SEO metadata
  useEffect(() => {
    if (category) {
      const categoryName = slugToTitle(category);
      updateSEOMetadata(getCategoryProductsSEO(categoryName));
    }
  }, [category]);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  // Calculate displayed products based on pagination
  const displayedProducts = products.slice(0, page * PRODUCTS_PER_PAGE);
  const hasMore = displayedProducts.length < products.length;

  const categoryName = category ? slugToTitle(category) : 'Category';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {categoryName}
          </h1>
          <p className="text-xl text-gray-600">
            Browse our curated {categoryName.toLowerCase()} collection
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Loading State with Skeleton */}
            {loading && <ProductGridSkeleton count={6} />}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center max-w-2xl mx-auto">
                <p className="font-semibold">Error loading products</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Products Grid with In-Feed Ads */}
            {!loading && !error && displayedProducts.length > 0 && (
              <>
                <ProductGrid
                  products={displayedProducts}
                  onProductClick={handleProductClick}
                />

                {/* In-Feed Ad after products */}
                {displayedProducts.length >= 8 && <InFeedAd />}

                {/* Load More Button (for pagination when >20 products) */}
                {hasMore && (
                  <div className="flex justify-center mt-12">
                    <button
                      onClick={handleLoadMore}
                      className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
                    >
                      Load More Products
                    </button>
                  </div>
                )}

                {/* Product Count */}
                <div className="text-center mt-8 text-gray-600">
                  Showing {displayedProducts.length} of {products.length} products
                </div>
              </>
            )}

            {/* Empty State */}
            {!loading && !error && products.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">
                  No products found in this category.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar with Ad */}
          <aside className="lg:w-80 hidden lg:block">
            <SidebarAd />
          </aside>
        </div>
      </div>

      {/* Product Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

export default CategoryProducts;
