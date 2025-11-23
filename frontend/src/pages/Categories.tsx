import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '@/stores/productStore';
import { CategoryCard } from '@/components/public';
import { CategoryCardSkeleton } from '@/components/common';
import { updateSEOMetadata, getCategoriesSEO } from '@/utils/seo';

function Categories() {
  const navigate = useNavigate();
  const { categories, loading, error, fetchCategories } = useProductStore();

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Update SEO metadata
  useEffect(() => {
    updateSEOMetadata(getCategoriesSEO());
  }, []);

  const handleCategoryClick = (categorySlug: string) => {
    navigate(`/categories/${categorySlug}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        {/* Page Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Browse Categories
          </h1>
          <p className="text-xl text-gray-600">
            Explore our curated collections
          </p>
        </header>

        {/* Loading State with Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <CategoryCardSkeleton key={index} />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center max-w-2xl mx-auto" role="alert">
            <p className="font-semibold">Error loading categories</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Categories Grid */}
        {!loading && !error && categories.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onClick={() => handleCategoryClick(category.slug)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && categories.length === 0 && (
          <div className="text-center py-12" role="status">
            <p className="text-gray-600 text-lg">No categories available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Categories;
