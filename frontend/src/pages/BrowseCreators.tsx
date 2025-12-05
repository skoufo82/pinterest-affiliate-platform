import { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import { CreatorCard } from '@/components/public';
import { updateSEOMetadata } from '@/utils/seo';
import type { Creator } from '@/types';

function BrowseCreators() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCreators, setFilteredCreators] = useState<Creator[]>([]);

  useEffect(() => {
    // Update SEO metadata
    updateSEOMetadata({
      title: 'Browse Creators | Discover Amazing Storefronts',
      description: 'Explore our community of creators and discover curated product collections from talented individuals.',
      type: 'website',
    });

    // Fetch all creators
    const fetchCreators = async () => {
      try {
        const response = await api.getAllCreators();
        setCreators(response.creators);
        setFilteredCreators(response.creators);
      } catch (error) {
        console.error('Error fetching creators:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCreators();
  }, []);

  // Filter creators based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCreators(creators);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = creators.filter(
      (creator) =>
        creator.displayName.toLowerCase().includes(query) ||
        creator.slug.toLowerCase().includes(query) ||
        creator.bio.toLowerCase().includes(query)
    );
    setFilteredCreators(filtered);
  }, [searchQuery, creators]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <section className="bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Browse Creators
            </h1>
            <p className="text-lg md:text-xl text-pink-50 mb-6">
              Discover curated product collections from our community of creators
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search creators by name or interests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-6 py-4 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-white shadow-xl"
                />
                <svg
                  className="absolute right-6 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
          </div>
        </div>
      </section>

      {/* Creators Grid Section */}
      <section className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
            <p className="mt-4 text-gray-600">Loading creators...</p>
          </div>
        ) : filteredCreators.length > 0 ? (
          <>
            {/* Results Count */}
            <div className="mb-6">
              <p className="text-gray-600">
                {searchQuery ? (
                  <>
                    Found <span className="font-semibold text-gray-900">{filteredCreators.length}</span>{' '}
                    {filteredCreators.length === 1 ? 'creator' : 'creators'} matching "{searchQuery}"
                  </>
                ) : (
                  <>
                    Showing <span className="font-semibold text-gray-900">{filteredCreators.length}</span>{' '}
                    {filteredCreators.length === 1 ? 'creator' : 'creators'}
                  </>
                )}
              </p>
            </div>

            {/* Creators Grid */}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredCreators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">No creators found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? `We couldn't find any creators matching "${searchQuery}". Try a different search term.`
                  : 'No creators available at the moment. Check back soon!'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-pink-600 font-semibold hover:text-pink-700 transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* CTA Section */}
      {!loading && creators.length > 0 && (
        <section className="bg-gradient-to-r from-pink-100 to-purple-100 py-12 md:py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Want to become a creator?
            </h2>
            <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
              Join our community and start building your own branded storefront today
            </p>
            <button
              onClick={() => (window.location.href = '/signup')}
              className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-3 px-8 rounded-full hover:from-pink-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-pink-300"
            >
              Get Started Free →
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default BrowseCreators;
