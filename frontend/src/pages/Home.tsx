import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '@/stores/productStore';
import { ProductGrid } from '@/components/public';
import { ProductGridSkeleton } from '@/components/common';
import { updateSEOMetadata, getHomeSEO } from '@/utils/seo';
import { SidebarAd } from '@/components/ads/SidebarAd';
import { BannerAd } from '@/components/ads/BannerAd';

function Home() {
  const navigate = useNavigate();
  const { products, loading, error, fetchProducts } = useProductStore();

  // Filter for featured products only
  const featuredProducts = products.filter(p => p.featured);

  // Fetch featured products on mount with force refresh to bypass cache
  useEffect(() => {
    fetchProducts(undefined, true); // Force refresh to get latest data
  }, [fetchProducts]);

  // Update SEO metadata
  useEffect(() => {
    updateSEOMetadata(getHomeSEO());
  }, []);

  const handleCategoriesClick = () => {
    navigate('/categories');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Hero Section */}
      <section className="relative bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white py-8 md:py-12" aria-label="Hero section">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
            Discover Amazing Products
          </h1>
          <p className="text-sm sm:text-base md:text-lg mb-4 text-pink-50 max-w-xl mx-auto">
            Curated collections of trending products you&apos;ll love
          </p>
          <button
            onClick={handleCategoriesClick}
            className="bg-white text-pink-600 font-semibold py-2 px-6 rounded-full hover:bg-pink-50 transition-all duration-200 shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white text-sm md:text-base"
            aria-label="Browse product categories"
          >
            Browse Categories →
          </button>
        </div>
      </section>

      {/* Banner Ad */}
      <BannerAd />

      {/* Featured Products Section with Sidebar */}
      <section className="container mx-auto px-3 sm:px-4 py-8 sm:py-12" aria-labelledby="featured-products-heading">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="flex-1">
            <h2 id="featured-products-heading" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-6 sm:mb-8 text-center lg:text-left">
              ✨ Featured Products
            </h2>

            {/* Loading State with Skeleton */}
            {loading && <ProductGridSkeleton count={6} />}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center" role="alert">
                <p className="font-semibold">Error loading products</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Products Grid */}
            {!loading && !error && featuredProducts.length > 0 && (
              <ProductGrid products={featuredProducts} />
            )}

            {/* Empty State */}
            {!loading && !error && featuredProducts.length === 0 && (
              <div className="text-center py-12" role="status">
                <p className="text-gray-600 text-lg">No featured products yet. Check back soon!</p>
              </div>
            )}
          </div>

          {/* Sidebar with Ad */}
          <aside className="lg:w-80 hidden lg:block">
            <SidebarAd />
          </aside>
        </div>
      </section>
    </div>
  );
}

export default Home;
