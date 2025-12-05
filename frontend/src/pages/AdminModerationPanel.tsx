import { useEffect, useState } from 'react';
import { adminApi } from '@/utils/api';
import { Product } from '@/types';
import { TableSkeleton } from '@/components/common';
import toast from 'react-hot-toast';

function AdminModerationPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingProducts();
  }, []);

  const fetchPendingProducts = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getPendingProducts();
      setProducts(response.products);
    } catch (error) {
      console.error('Failed to fetch pending products:', error);
      toast.error('Failed to load pending products');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (productId: string) => {
    try {
      setActionLoading(true);
      await adminApi.approveProduct(productId);
      toast.success('Product approved successfully');
      // Remove from list
      setProducts(products.filter(p => p.id !== productId));
    } catch (error) {
      console.error('Failed to approve product:', error);
      toast.error('Failed to approve product');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClick = (product: Product) => {
    setSelectedProduct(product);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedProduct || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      await adminApi.rejectProduct(selectedProduct.id, rejectionReason);
      toast.success('Product rejected');
      // Remove from list
      setProducts(products.filter(p => p.id !== selectedProduct.id));
      setShowRejectModal(false);
      setSelectedProduct(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Failed to reject product:', error);
      toast.error('Failed to reject product');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6">Product Moderation</h1>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <TableSkeleton rows={5} columns={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Product Moderation</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Review and approve pending products ({products.length} pending)
        </p>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 text-lg">No pending products to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full lg:w-48 h-48 object-cover rounded-lg"
                    />
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {product.title}
                      </h2>
                      <p className="text-gray-600 mb-3">{product.description}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Category:</span>{' '}
                          <span className="text-gray-600">{product.category}</span>
                        </div>
                        {product.price && (
                          <div>
                            <span className="font-medium text-gray-700">Price:</span>{' '}
                            <span className="text-gray-600">{product.price}</span>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-700">Featured:</span>{' '}
                          <span className="text-gray-600">{product.featured ? 'Yes' : 'No'}</span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <a
                          href={product.amazonLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Amazon Link →
                        </a>
                      </div>
                    </div>

                    {/* Creator Info */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Creator Information</h3>
                      <div className="text-sm text-gray-600">
                        <div>Creator ID: {product.creatorId || 'N/A'}</div>
                        <div>Submitted: {new Date(product.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleApprove(product.id)}
                        disabled={actionLoading}
                        className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectClick(product)}
                        disabled={actionLoading}
                        className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Reject Product</h2>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting "{selectedProduct.title}"
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              rows={4}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedProduct(null);
                  setRejectionReason('');
                }}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminModerationPanel;
