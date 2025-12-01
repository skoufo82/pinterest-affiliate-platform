import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense, useEffect } from 'react';

// Components
import { Header, Footer } from '@/components/public';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';

// Context
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { setAuthTokenGetter } from '@/utils/api';

// Public pages (eagerly loaded for better initial performance)
import Home from '@/pages/Home';
import Categories from '@/pages/Categories';
import CategoryProducts from '@/pages/CategoryProducts';
import ProductDetail from '@/pages/ProductDetail';
import { Login } from '@/pages/Login';

// Admin pages (lazy loaded - code splitting)
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminProductList = lazy(() => import('@/pages/AdminProductList'));
const AdminProductNew = lazy(() => import('@/pages/AdminProductNew'));
const AdminProductEdit = lazy(() => import('@/pages/AdminProductEdit'));
const AdminUserManagement = lazy(() => import('@/pages/AdminUserManagement'));

// 404 page
import NotFound from '@/pages/NotFound';

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);

// Component to set up auth token getter
const AuthSetup = () => {
  const { getToken } = useAuth();
  
  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);
  
  return null;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthSetup />
        <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Skip to main content link for keyboard navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-pink-600 focus:text-white focus:rounded-md focus:shadow-lg"
        >
          Skip to main content
        </a>
        
        <Header />
        <main id="main-content" className="flex-grow" role="main">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/categories/:category" element={<CategoryProducts />} />
            <Route path="/products/:id" element={<ProductDetail />} />

            {/* Login route */}
            <Route path="/login" element={<Login />} />

            {/* Admin routes - protected and lazy loaded */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Suspense fallback={<PageLoader />}>
                      <AdminDashboard />
                    </Suspense>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Suspense fallback={<PageLoader />}>
                      <AdminProductList />
                    </Suspense>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products/new"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Suspense fallback={<PageLoader />}>
                      <AdminProductNew />
                    </Suspense>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products/:id/edit"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Suspense fallback={<PageLoader />}>
                      <AdminProductEdit />
                    </Suspense>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Suspense fallback={<PageLoader />}>
                      <AdminUserManagement />
                    </Suspense>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
