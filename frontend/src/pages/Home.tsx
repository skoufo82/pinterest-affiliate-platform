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
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-16 md:py-24" aria-label="Hero section">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Discover Amazing Products
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-pink-100">
            Curated collections of products you&apos;ll love
          </p>
          <button
            onClick={handleCategoriesClick}
            className="bg-white text-pink-600 font-semibold py-3 px-8 rounded-lg hover:bg-pink-50 transition-colors duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-pink-600"
            aria-label="Browse product categories"
          >
            Browse Categories
          </button>
        </div>
      </section>

      {/* Banner Ad */}
      <BannerAd />

      {/* Featured Products Section with Sidebar */}
      <section className="container mx-auto px-4 py-12" aria-labelledby="featured-products-heading">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            <h2 id="featured-products-heading" className="text-3xl font-bold text-gray-900 mb-8 text-center lg:text-left">
              Featured Products
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
