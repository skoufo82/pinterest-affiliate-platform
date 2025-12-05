import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateSEOMetadata, getHomeSEO } from '@/utils/seo';
import { api } from '@/utils/api';
import { CreatorCard } from '@/components/public';
import type { Creator } from '@/types';

function PlatformHome() {
  const navigate = useNavigate();
  const [featuredCreators, setFeaturedCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    updateSEOMetadata(getHomeSEO());
    
    // Fetch featured creators (top 6-8 creators)
    const fetchFeaturedCreators = async () => {
      try {
        const response = await api.getAllCreators({ limit: 8 });
        setFeaturedCreators(response.creators);
      } catch (error) {
        console.error('Error fetching featured creators:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedCreators();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 text-white py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Your Products, Your Brand,
              <br />
              <span className="text-pink-100">Your Storefront</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl mb-8 text-pink-50 max-w-2xl mx-auto">
              Create a beautiful, customizable storefront to showcase your favorite products.
              Track performance, engage your audience, and grow your brand.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/signup')}
                className="bg-white text-pink-600 font-bold py-4 px-8 rounded-full hover:bg-pink-50 transition-all duration-200 shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white text-lg"
              >
                Become a Creator →
              </button>
              <button
                onClick={() => navigate('/creators')}
                className="bg-transparent border-2 border-white text-white font-semibold py-4 px-8 rounded-full hover:bg-white hover:text-pink-600 transition-all duration-200 shadow-xl focus:outline-none focus:ring-4 focus:ring-white text-lg"
              >
                Browse Creators
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Benefits Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12 max-w-2xl mx-auto">
            Build your brand with powerful tools designed for creators
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Benefit 1 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Easy Product Management</h3>
              <p className="text-gray-600">
                Add, edit, and organize your products with our intuitive interface. 
                Upload images, set categories, and feature your best items.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Powerful Analytics</h3>
              <p className="text-gray-600">
                Track page views, clicks, and engagement. Understand what resonates 
                with your audience and optimize your storefront.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Custom Storefront</h3>
              <p className="text-gray-600">
                Personalize your page with custom colors, fonts, and branding. 
                Create a unique experience that reflects your style.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12 max-w-2xl mx-auto">
            Get started in three simple steps
          </p>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-pink-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                    1
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Sign Up</h3>
                  <p className="text-gray-600">
                    Create your account and choose a unique username for your storefront URL
                  </p>
                </div>
                {/* Connector line for desktop */}
                <div className="hidden md:block absolute top-6 left-1/2 w-full h-0.5 bg-pink-200 -z-10"></div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-pink-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                    2
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Customize</h3>
                  <p className="text-gray-600">
                    Add your products, upload images, and personalize your storefront with custom themes
                  </p>
                </div>
                {/* Connector line for desktop */}
                <div className="hidden md:block absolute top-6 left-1/2 w-full h-0.5 bg-pink-200 -z-10"></div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-pink-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                    3
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Share & Grow</h3>
                  <p className="text-gray-600">
                    Share your storefront link with your audience and track your performance
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Creators Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Featured Creators
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12">
            Discover amazing storefronts from our community
          </p>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
            </div>
          ) : featuredCreators.length > 0 ? (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {featuredCreators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Featured creators coming soon!</p>
            </div>
          )}

          <div className="text-center mt-8">
            <button
              onClick={() => navigate('/creators')}
              className="text-pink-600 font-semibold hover:text-pink-700 transition-colors"
            >
              Browse All Creators →
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-pink-50 to-purple-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            Success Stories
          </h2>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Testimonial 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  S
                </div>
                <div className="ml-4">
                  <h4 className="font-bold text-gray-900">Sarah Johnson</h4>
                  <p className="text-gray-600 text-sm">Home Decor Creator</p>
                </div>
              </div>
              <p className="text-gray-700 italic">
                "This platform made it so easy to showcase my favorite home decor finds. 
                The analytics help me understand what my audience loves, and the custom 
                storefront perfectly matches my brand aesthetic."
              </p>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  M
                </div>
                <div className="ml-4">
                  <h4 className="font-bold text-gray-900">Mike Chen</h4>
                  <p className="text-gray-600 text-sm">Tech Enthusiast</p>
                </div>
              </div>
              <p className="text-gray-700 italic">
                "I love how simple it is to manage my product recommendations. 
                The platform handles everything from hosting to analytics, so I can 
                focus on finding great products for my followers."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-pink-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Start Your Creator Journey?
          </h2>
          <p className="text-lg md:text-xl mb-8 text-pink-50 max-w-2xl mx-auto">
            Join thousands of creators building their brand and sharing their favorite products
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-white text-pink-600 font-bold py-4 px-10 rounded-full hover:bg-pink-50 transition-all duration-200 shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white text-lg"
          >
            Get Started Free →
          </button>
        </div>
      </section>
    </div>
  );
}

export default PlatformHome;
