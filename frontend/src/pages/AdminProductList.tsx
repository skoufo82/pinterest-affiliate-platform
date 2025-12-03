import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminStore } from '@/stores/adminStore';
import { ProductTable } from '@/components/admin/ProductTable';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { TableSkeleton } from '@/components/common';

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'home-kitchen', label: 'Home & Kitchen' },
  { value: 'fashion-beauty', label: 'Fashion & Beauty' },
  { value: 'tech-electronics', label: 'Tech & Electronics' },
  { value: 'health-wellness', label: 'Health & Wellness' },
  { value: 'books-stationery', label: 'Books & Stationery' },
];

function AdminProductList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { products, loading, error, successMessage, fetchAllProducts, deleteProduct, clearMessages } = useAdminStore();
  
  const [selectedCategory, setSelectedCategory] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchAllProducts();
  }, [fetchAllProducts]);

  // Force refresh when navigating back from edit page
  useEffect(() => {
    if (location.state?.refresh) {
      fetchAllProducts();
      // Clear the state to prevent refetching on subsequent renders
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, fetchAllProducts]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        clearMessages();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error, clearMessages]);

  // Filter products by category
  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category === selectedCategory)
    : products;

  const handleEdit = (id: string) => {
    navigate(`/kbportal/products/${id}/edit`);
  };

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete);
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setProductToDelete(null);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Product List</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage all products</p>
        </div>
        <button
          onClick={() => navigate('/kbportal/products/new')}
          className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base whitespace-nowrap"
        >
          Add New Product
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm sm:text-base">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm sm:text-base">
          {error}
        </div>
      )}

      {/* Category Filter */}
      <div className="mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-lg shadow">
        <label htmlFor="category-filter" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
          Filter by Category
        </label>
        <select
          id="category-filter"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        {selectedCategory && (
          <p className="mt-2 text-xs sm:text-sm text-gray-600">
            Showing {filteredProducts.length} of {products.length} products
          </p>
        )}
      </div>

      {/* Product Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <TableSkeleton rows={5} columns={5} />
        </div>
      ) : (
        <ProductTable
          products={filteredProducts}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

export default AdminProductList;
