import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ProductForm } from '@/components/admin/ProductForm';
import { adminApi, creatorApi } from '@/utils/api';
import type { ProductInput } from '@/types';

export const CreatorProductNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: ProductInput) => {
    try {
      setLoading(true);
      await creatorApi.createProduct(data);
      toast.success('Product created successfully! It will be reviewed by an admin.');
      navigate('/creator/products');
    } catch (error) {
      console.error('Failed to create product:', error);
      toast.error('Failed to create product');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    try {
      const response = await adminApi.uploadImage(file.name, file.type);
      await adminApi.uploadToS3(response.uploadUrl, file);
      return response.imageUrl;
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error('Failed to upload image');
      return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
        <p className="mt-2 text-gray-600">
          Create a new product listing. It will be submitted for admin review before appearing on your storefront.
        </p>
      </div>

      <ProductForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/creator/products')}
        onUploadImage={handleImageUpload}
        loading={loading}
      />
    </div>
  );
};

export default CreatorProductNew;
