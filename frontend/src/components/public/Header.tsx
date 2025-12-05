import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { creatorApi } from '@/utils/api';
import { Creator } from '@/types';

export const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, isAdmin, userGroups, logout } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loadingCreator, setLoadingCreator] = useState(false);

  const isCreator = userGroups.includes('Creators');

  useEffect(() => {
    // Fetch creator profile if user is a creator
    if (isAuthenticated && isCreator && !creator && !loadingCreator) {
      setLoadingCreator(true);
      creatorApi.getProfile()
        .then(response => {
          setCreator(response.creator);
        })
        .catch(err => {
          console.error('Failed to fetch creator profile:', err);
        })
        .finally(() => {
          setLoadingCreator(false);
        });
    }
  }, [isAuthenticated, isCreator, creator, loadingCreator]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = () => {
    logout();
    setCreator(null);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50" role="banner">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2" aria-label="KoufoBunch home">
            <div className="text-2xl font-bold text-pink-600">
              KoufoBunch
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6" aria-label="Main navigation">
            <Link
              to="/"
              className="text-gray-700 hover:text-pink-600 transition-colors font-medium"
            >
              Home
            </Link>
            <Link
              to="/creators"
              className="text-gray-700 hover:text-pink-600 transition-colors font-medium"
            >
              Browse Creators
            </Link>
            
            {/* Creator Navigation */}
            {isAuthenticated && isCreator && creator && (
              <>
                <Link
                  to={`/creator/${creator.slug}`}
                  className="text-gray-700 hover:text-pink-600 transition-colors font-medium"
                >
                  My Storefront
                </Link>
                <Link
                  to="/creator/products"
                  className="text-gray-700 hover:text-pink-600 transition-colors font-medium"
                >
                  My Products
                </Link>
                <Link
                  to="/creator/analytics"
                  className="text-gray-700 hover:text-pink-600 transition-colors font-medium"
                >
                  Analytics
                </Link>
                <Link
                  to="/creator/profile/edit"
                  className="text-gray-700 hover:text-pink-600 transition-colors font-medium"
                >
                  Profile Settings
                </Link>
              </>
            )}

            {/* Admin Navigation */}
            {isAuthenticated && isAdmin && (
              <Link
                to="/kbportal"
                className="text-gray-700 hover:text-pink-600 transition-colors font-medium"
              >
                Admin Portal
              </Link>
            )}

            {/* Auth Actions */}
            {!isAuthenticated ? (
              <>
                <Link
                  to="/signup"
                  className="bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors font-medium"
                >
                  Become a Creator
                </Link>
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-pink-600 transition-colors font-medium"
                >
                  Login
                </Link>
              </>
            ) : (
              <button
                onClick={handleLogout}
                className="text-gray-700 hover:text-pink-600 transition-colors font-medium"
              >
                Logout
              </button>
            )}
          </nav>

          {/* Mobile Hamburger Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {isMobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <nav 
            id="mobile-menu"
            className="md:hidden mt-4 pb-4 border-t border-gray-200 pt-4"
            aria-label="Mobile navigation"
          >
            <ul className="flex flex-col space-y-3">
              <li>
                <Link
                  to="/"
                  className="text-gray-700 hover:text-pink-600 transition-colors font-medium py-2 block"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/creators"
                  className="text-gray-700 hover:text-pink-600 transition-colors font-medium py-2 block"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Browse Creators
                </Link>
              </li>

              {/* Creator Navigation - Mobile */}
              {isAuthenticated && isCreator && creator && (
                <>
                  <li className="border-t border-gray-200 pt-3 mt-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                      Creator Menu
                    </div>
                  </li>
                  <li>
                    <Link
                      to={`/creator/${creator.slug}`}
                      className="text-gray-700 hover:text-pink-600 transition-colors font-medium py-2 block"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      My Storefront
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/creator/products"
                      className="text-gray-700 hover:text-pink-600 transition-colors font-medium py-2 block"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      My Products
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/creator/analytics"
                      className="text-gray-700 hover:text-pink-600 transition-colors font-medium py-2 block"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Analytics
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/creator/profile/edit"
                      className="text-gray-700 hover:text-pink-600 transition-colors font-medium py-2 block"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Profile Settings
                    </Link>
                  </li>
                </>
              )}

              {/* Admin Navigation - Mobile */}
              {isAuthenticated && isAdmin && (
                <>
                  <li className="border-t border-gray-200 pt-3 mt-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                      Admin Menu
                    </div>
                  </li>
                  <li>
                    <Link
                      to="/kbportal"
                      className="text-gray-700 hover:text-pink-600 transition-colors font-medium py-2 block"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Admin Portal
                    </Link>
                  </li>
                </>
              )}

              {/* Auth Actions - Mobile */}
              <li className="border-t border-gray-200 pt-3 mt-3">
                {!isAuthenticated ? (
                  <>
                    <Link
                      to="/signup"
                      className="bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors font-medium block text-center mb-3"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Become a Creator
                    </Link>
                    <Link
                      to="/login"
                      className="text-gray-700 hover:text-pink-600 transition-colors font-medium py-2 block"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                  </>
                ) : (
                  <button
                    onClick={handleLogout}
                    className="text-gray-700 hover:text-pink-600 transition-colors font-medium py-2 block w-full text-left"
                  >
                    Logout
                  </button>
                )}
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
};
