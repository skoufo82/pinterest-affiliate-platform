import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '@/stores/adminStore';
import { ProductForm } from '@/components/admin/ProductForm';
import type { ProductInput } from '@/types';

function AdminProductNew() {
  const navigate = useNavigate();
  const { loading, createProduct, uploadImage } = useAdminStore();

  const handleSubmit = async (data: ProductInput) => {
    const product = await createProduct(data);
    
    if (product) {
      // Redirect to dashboard on success
      navigate('/admin', { replace: true });
    }
  };

  const handleCancel = () => {
    navigate('/admin/products');
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Add New Product</h1>
        <p className="text-sm sm:text-base text-gray-600">Create a new product listing</p>
      </div>

      <ProductForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onUploadImage={uploadImage}
        loading={loading}
      />
    </div>
  );
}

export default AdminProductNew;
