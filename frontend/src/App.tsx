import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense } from 'react';

// Components
import { Header, Footer } from '@/components/public';

// Public pages (eagerly loaded for better initial performance)
import Home from '@/pages/Home';
import Categories from '@/pages/Categories';
import CategoryProducts from '@/pages/CategoryProducts';
import ProductDetail from '@/pages/ProductDetail';

// Admin pages (lazy loaded - code splitting)
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminProductList = lazy(() => import('@/pages/AdminProductList'));
const AdminProductNew = lazy(() => import('@/pages/AdminProductNew'));
const AdminProductEdit = lazy(() => import('@/pages/AdminProductEdit'));

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

function App() {
  return (
    <BrowserRouter>
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

            {/* Admin routes - wrapped in Suspense for code splitting */}
            <Route
              path="/admin"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminDashboard />
                </Suspense>
              }
            />
            <Route
              path="/admin/products"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminProductList />
                </Suspense>
              }
            />
            <Route
              path="/admin/products/new"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminProductNew />
                </Suspense>
              }
            />
            <Route
              path="/admin/products/:id/edit"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminProductEdit />
                </Suspense>
              }
            />

            {/* 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
