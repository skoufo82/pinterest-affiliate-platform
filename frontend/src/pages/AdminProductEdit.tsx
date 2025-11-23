import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminStore } from '@/stores/adminStore';
import { ProductForm } from '@/components/admin/ProductForm';
import type { Product, ProductInput } from '@/types';
import { adminApi } from '@/utils/api';

function AdminProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loading, updateProduct, uploadImage } = useAdminStore();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setFetchError('Product ID is missing');
        setFetchLoading(false);
        return;
      }

      try {
        setFetchLoading(true);
        setFetchError(null);
        
        // Fetch product by ID
        const response = await adminApi.getAllProducts();
        const foundProduct = response.products.find((p) => p.id === id);
        
        if (foundProduct) {
          setProduct(foundProduct);
        } else {
          setFetchError('Product not found');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch product';
        setFetchError(errorMessage);
        console.error('Error fetching product:', error);
      } finally {
        setFetchLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleSubmit = async (data: ProductInput) => {
    if (!id) return;
    
    const updatedProduct = await updateProduct(id, data);
    
    if (updatedProduct) {
      // Redirect to dashboard on success
      navigate('/admin', { replace: true });
    }
  };

  const handleCancel = () => {
    navigate('/admin/products');
  };

  if (fetchLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow text-center">
          <p className="text-sm sm:text-base text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !product) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
        <div className="bg-red-50 border border-red-200 p-4 sm:p-6 rounded-lg">
          <h2 className="text-lg sm:text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-sm sm:text-base text-red-700">{fetchError || 'Product not found'}</p>
          <button
            onClick={() => navigate('/admin/products')}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm sm:text-base"
          >
            Back to Product List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Edit Product</h1>
        <p className="text-sm sm:text-base text-gray-600">Update product information</p>
      </div>

      <ProductForm
        product={product}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onUploadImage={uploadImage}
        loading={loading}
      />
    </div>
  );
}

export default AdminProductEdit;
