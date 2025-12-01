import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminStore } from '@/stores/adminStore';

function AdminDashboard() {
  const { products, loading, fetchAllProducts } = useAdminStore();

  useEffect(() => {
    fetchAllProducts();
  }, [fetchAllProducts]);

  // Calculate quick stats
  const totalProducts = products.length;
  const publishedProducts = products.filter((p) => p.published).length;
  const draftProducts = totalProducts - publishedProducts;

  // Get recent products (last 5)
  const recentProducts = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <h1 className="text-3xl sm:text-4xl font-bold mb-2">Admin Dashboard</h1>
      <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">Welcome to the admin panel</p>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Products</h3>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totalProducts}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Published</h3>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{publishedProducts}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow sm:col-span-2 lg:col-span-1">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Drafts</h3>
          <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{draftProducts}</p>
        </div>
      </div>

      {/* Recent Products */}
      <div className="bg-white rounded-lg shadow mb-6 sm:mb-8">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold">Recent Products</h2>
        </div>
        <div className="p-4 sm:p-6">
          {loading ? (
            <p className="text-sm sm:text-base text-gray-500">Loading products...</p>
          ) : recentProducts.length === 0 ? (
            <p className="text-sm sm:text-base text-gray-500">No products yet. Create your first product!</p>
          ) : (
            <div className="space-y-3">
              {recentProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm sm:text-base text-gray-900 truncate">{product.title}</h3>
                      <p className="text-xs sm:text-sm text-gray-500">{product.category}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full self-start sm:self-auto ${
                      product.published
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {product.published ? 'Published' : 'Draft'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Link
          to="/admin/products"
          className="block p-4 sm:p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg sm:text-xl font-semibold mb-2">Manage Products</h2>
          <p className="text-sm sm:text-base text-gray-600">View, edit, and delete all products</p>
        </Link>
        <Link
          to="/admin/products/new"
          className="block p-4 sm:p-6 bg-blue-50 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-blue-200"
        >
          <h2 className="text-lg sm:text-xl font-semibold mb-2 text-blue-900">Add New Product</h2>
          <p className="text-sm sm:text-base text-blue-700">Create a new product listing</p>
        </Link>
        <Link
          to="/admin/users"
          className="block p-4 sm:p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg sm:text-xl font-semibold mb-2">Manage Users</h2>
          <p className="text-sm sm:text-base text-gray-600">Create and manage admin users</p>
        </Link>
      </div>
    </div>
  );
}

export default AdminDashboard;
