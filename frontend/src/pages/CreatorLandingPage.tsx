import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';
import { Creator, Product } from '@/types';
import { ProductGrid } from '@/components/public';
import { ProductGridSkeleton } from '@/components/common';
import { LazyImage } from '@/components/public';
import { updateSEOMetadata, getCreatorSEO, updateStructuredData, generateCreatorStructuredData, removeStructuredData } from '@/utils/seo';
import toast from 'react-hot-toast';

function CreatorLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [creator, setCreator] = useState<Creator | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');

  useEffect(() => {
    if (!slug) {
      navigate('/404');
      return;
    }

    const fetchCreatorData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch creator profile
        const creatorResponse = await api.getCreatorBySlug(slug);
        setCreator(creatorResponse.creator);

        // Apply theme to page
        if (creatorResponse.creator.theme) {
          const theme = creatorResponse.creator.theme;
          document.documentElement.style.setProperty('--creator-primary', theme.primaryColor);
          document.documentElement.style.setProperty('--creator-accent', theme.accentColor);
          if (theme.font) {
            document.documentElement.style.setProperty('--creator-font', theme.font);
          }
        }

        // Update SEO metadata
        updateSEOMetadata(getCreatorSEO(creatorResponse.creator));
        
        // Add structured data
        const structuredData = generateCreatorStructuredData(creatorResponse.creator);
        updateStructuredData(structuredData);

        // Fetch featured products
        const featuredResponse = await api.getCreatorFeaturedProducts(slug);
        setFeaturedProducts(featuredResponse.products);

        // Fetch all products
        const productsResponse = await api.getCreatorProducts(slug);
        setAllProducts(productsResponse.products);
        setProducts(productsResponse.products);

        // Extract categories and counts
        const categoryMap = new Map<string, number>();
        productsResponse.products.forEach(product => {
          const count = categoryMap.get(product.category) || 0;
          categoryMap.set(product.category, count + 1);
        });
        const categoriesArray = Array.from(categoryMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCategories(categoriesArray);

      } catch (err: any) {
        console.error('Error fetching creator data:', err);
        if (err.response?.status === 404) {
          navigate('/404');
        } else {
          setError('Failed to load creator page. Please try again.');
          toast.error('Failed to load creator page');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorData();

    // Cleanup: Remove theme and structured data when component unmounts
    return () => {
      document.documentElement.style.removeProperty('--creator-primary');
      document.documentElement.style.removeProperty('--creator-accent');
      document.documentElement.style.removeProperty('--creator-font');
      removeStructuredData();
    };
  }, [slug, navigate]);

  // Filter and sort products when filters change
  useEffect(() => {
    let filtered = [...allProducts];

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'price-low') {
      filtered.sort((a, b) => {
        const priceA = a.price ? parseFloat(a.price.replace(/[^0-9.]/g, '')) : Infinity;
        const priceB = b.price ? parseFloat(b.price.replace(/[^0-9.]/g, '')) : Infinity;
        return priceA - priceB;
      });
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => {
        const priceA = a.price ? parseFloat(a.price.replace(/[^0-9.]/g, '')) : -Infinity;
        const priceB = b.price ? parseFloat(b.price.replace(/[^0-9.]/g, '')) : -Infinity;
        return priceB - priceA;
      });
    }

    setProducts(filtered);
  }, [selectedCategory, searchQuery, sortBy, allProducts]);

  const handleCategoryClick = (category: string | null) => {
    setSelectedCategory(category);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Hero Skeleton */}
        <div className="relative h-64 md:h-80 bg-gray-200 animate-pulse" />
        
        <div className="container mx-auto px-4 -mt-16 relative z-10">
          {/* Profile Image Skeleton */}
          <div className="w-32 h-32 rounded-full bg-gray-300 animate-pulse border-4 border-white" />
          
          {/* Info Skeleton */}
          <div className="mt-4 space-y-3">
            <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
            <div className="h-4 w-96 bg-gray-200 animate-pulse rounded" />
          </div>
        </div>

        {/* Products Skeleton */}
        <div className="container mx-auto px-4 py-12">
          <ProductGridSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-4">{error || 'Creator not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: creator.theme.font || 'inherit' }}
    >
      {/* Hero Section with Cover Image */}
      <div 
        className="relative h-64 md:h-80 overflow-hidden"
        style={{
          background: creator.coverImage 
            ? 'transparent' 
            : `linear-gradient(to right, ${creator.theme.primaryColor}, ${creator.theme.accentColor})`
        }}
      >
        {creator.coverImage && (
          <LazyImage
            src={creator.coverImage}
            alt={`${creator.displayName} cover`}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Creator Profile Section */}
      <div className="container mx-auto px-4 -mt-16 relative z-10">
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                {creator.profileImage ? (
                  <LazyImage
                    src={creator.profileImage}
                    alt={creator.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold">
                    {creator.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Creator Info */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                {creator.displayName}
              </h1>
              <p className="text-gray-600 text-lg mb-4 whitespace-pre-wrap">
                {creator.bio}
              </p>

              {/* Social Links */}
              {(creator.socialLinks.instagram || creator.socialLinks.pinterest || creator.socialLinks.tiktok) && (
                <div className="flex gap-4">
                  {creator.socialLinks.instagram && (
                    <a
                      href={creator.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:opacity-80"
                      style={{ color: creator.theme.primaryColor }}
                      aria-label="Instagram"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </a>
                  )}
                  {creator.socialLinks.pinterest && (
                    <a
                      href={creator.socialLinks.pinterest}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:opacity-80"
                      style={{ color: creator.theme.primaryColor }}
                      aria-label="Pinterest"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                      </svg>
                    </a>
                  )}
                  {creator.socialLinks.tiktok && (
                    <a
                      href={creator.socialLinks.tiktok}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:opacity-80"
                      style={{ color: creator.theme.primaryColor }}
                      aria-label="TikTok"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="container mx-auto px-4 py-12">
        {/* Featured Products */}
        {featuredProducts.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              ⭐ Featured Products
            </h2>
            <ProductGrid products={featuredProducts} />
          </section>
        )}

        {/* Search and Sort Controls */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Products
              </label>
              <div className="relative">
                <input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or description..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="md:w-64">
              <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'price-low' | 'price-high')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        {categories.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter by Category</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCategoryClick(null)}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  selectedCategory === null
                    ? 'text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
                style={selectedCategory === null ? {
                  backgroundColor: creator.theme.primaryColor
                } : {}}
                onMouseEnter={(e) => {
                  if (selectedCategory !== null) {
                    e.currentTarget.style.borderColor = creator.theme.primaryColor;
                    e.currentTarget.style.color = creator.theme.primaryColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== null) {
                    e.currentTarget.style.borderColor = '';
                    e.currentTarget.style.color = '';
                  }
                }}
              >
                All ({allProducts.length})
              </button>
              {categories.map(category => (
                <button
                  key={category.name}
                  onClick={() => handleCategoryClick(category.name)}
                  className={`px-4 py-2 rounded-full font-medium transition-all ${
                    selectedCategory === category.name
                      ? 'text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300'
                  }`}
                  style={selectedCategory === category.name ? {
                    backgroundColor: creator.theme.primaryColor
                  } : {}}
                  onMouseEnter={(e) => {
                    if (selectedCategory !== category.name) {
                      e.currentTarget.style.borderColor = creator.theme.primaryColor;
                      e.currentTarget.style.color = creator.theme.primaryColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCategory !== category.name) {
                      e.currentTarget.style.borderColor = '';
                      e.currentTarget.style.color = '';
                    }
                  }}
                >
                  {category.name} ({category.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Products */}
        <section>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
            {selectedCategory ? `${selectedCategory} Products` : 'All Products'}
          </h2>
          {products.length > 0 ? (
            <ProductGrid products={products} />
          ) : selectedCategory ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No products in this category.</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No products yet. Check back soon!</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default CreatorLandingPage;
