import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { creatorApi } from '@/utils/api';
import type { Product } from '@/types';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export const CreatorProductManager = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await creatorApi.getProducts();
      setProducts(response.products);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      setDeleting(true);
      await creatorApi.deleteProduct(productToDelete.id);
      toast.success('Product deleted successfully');
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const filteredProducts = products.filter((product) => {
    if (statusFilter === 'all') return true;
    return product.status === statusFilter;
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Unknown
          </span>
        );
    }
  };

  const getStatusCount = (status: StatusFilter) => {
    if (status === 'all') return products.length;
    return products.filter((p) => p.status === status).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Products</h1>
            <p className="mt-2 text-gray-600">
              Manage your product listings and track approval status
            </p>
          </div>
          <button
            onClick={() => navigate('/creator/products/new')}
            className="bg-pink-600 text-white px-6 py-3 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 font-medium"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setStatusFilter('all')}
            className={`${
              statusFilter === 'all'
                ? 'border-pink-500 text-pink-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            All Products
            <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100 text-gray-900">
              {getStatusCount('all')}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`${
              statusFilter === 'pending'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Pending
            <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-yellow-100 text-yellow-800">
              {getStatusCount('pending')}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`${
              statusFilter === 'approved'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Approved
            <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-green-100 text-green-800">
              {getStatusCount('approved')}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`${
              statusFilter === 'rejected'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Rejected
            <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-red-100 text-red-800">
              {getStatusCount('rejected')}
            </span>
          </button>
        </nav>
      </div>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
          <p className="mt-1 text-sm text-gray-500">
            {statusFilter === 'all'
              ? 'Get started by creating your first product.'
              : `No ${statusFilter} products found.`}
          </p>
          {statusFilter === 'all' && (
            <div className="mt-6">
              <button
                onClick={() => navigate('/creator/products/new')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
              >
                + Add Product
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredProducts.map((product) => (
              <li key={product.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="h-20 w-20 rounded-md object-cover"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="ml-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {product.title}
                          </h3>
                          {product.featured && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              ⭐ Featured
                            </span>
                          )}
                          {getStatusBadge(product.status)}
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {product.description}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                          <span className="capitalize">{product.category}</span>
                          {product.price && <span>{product.price}</span>}
                          <span>Created {new Date(product.createdAt).toLocaleDateString()}</span>
                        </div>

                        {/* Rejection Reason */}
                        {product.status === 'rejected' && product.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-800">
                              <span className="font-medium">Rejection reason:</span>{' '}
                              {product.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="ml-4 flex-shrink-0 flex gap-2">
                      <button
                        onClick={() => navigate(`/creator/products/${product.id}/edit`)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteDialog(product)}
                        className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${productToDelete?.title}"? This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        variant="danger"
      />
    </div>
  );
};

export default CreatorProductManager;
