import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  path: string;
  label: string;
  icon?: string;
}

const navItems: NavItem[] = [
  { path: '/kbportal', label: 'Dashboard' },
  { path: '/kbportal/products', label: 'Products' },
  { path: '/kbportal/products/new', label: 'Add Product' },
  { path: '/kbportal/sync-history', label: 'Sync History' },
  { path: '/kbportal/users', label: 'Users' },
];

export const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, isAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => {
    // Only show Users menu to Admins
    if (item.path === '/kbportal/users') {
      return isAdmin;
    }
    return true;
  });

  const isActive = (path: string) => {
    if (path === '/kbportal') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-20 left-4 z-50 p-2 bg-white rounded-lg shadow-md hover:bg-gray-100 transition-colors"
        aria-label="Toggle admin menu"
        aria-expanded={isMobileMenuOpen}
      >
        <svg
          className="w-6 h-6 text-gray-700"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isMobileMenuOpen ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Sidebar - Desktop: always visible, Mobile: toggleable */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-white shadow-md min-h-screen
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-4 sm:p-6 flex flex-col h-full">
          <div className="flex-grow">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">
              Admin Panel
            </h2>
            <nav>
              <ul className="space-y-2">
                {filteredNavItems.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={handleLinkClick}
                      className={`block px-3 sm:px-4 py-2 rounded-lg transition-colors ${
                        isActive(item.path)
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* User info and logout */}
          <div className="mt-auto pt-4 border-t border-gray-200">
            <div className="mb-3 px-3">
              <p className="text-xs text-gray-500">Logged in as</p>
              <p className="text-sm font-medium text-gray-800 truncate">
                {user?.getUsername()}
              </p>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                  isAdmin 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {isAdmin ? 'Admin' : 'Editor'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-3 sm:px-4 py-2 text-left text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
};
