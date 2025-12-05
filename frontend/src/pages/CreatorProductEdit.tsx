import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ProductForm } from '@/components/admin/ProductForm';
import { adminApi, creatorApi } from '@/utils/api';
import type { Product, ProductInput } from '@/types';

export const CreatorProductEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (id) {
      loadProduct(id);
    }
  }, [id]);

  const loadProduct = async (productId: string) => {
    try {
      setLoading(true);
      // Get products from creator API and find the one we need
      const response = await creatorApi.getProducts();
      const foundProduct = response.products.find((p) => p.id === productId);
      
      if (!foundProduct) {
        toast.error('Product not found or you do not have permission to edit it');
        navigate('/creator/products');
        return;
      }
      
      setProduct(foundProduct);
    } catch (error) {
      console.error('Failed to load product:', error);
      toast.error('Failed to load product');
      navigate('/creator/products');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: ProductInput) => {
    if (!id) return;

    try {
      setSaving(true);
      await creatorApi.updateProduct(id, data);
      toast.success('Product updated successfully!');
      navigate('/creator/products');
    } catch (error) {
      console.error('Failed to update product:', error);
      toast.error('Failed to update product');
      throw error;
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
        <p className="mt-2 text-gray-600">
          Update your product details. Changes may require admin review.
        </p>
      </div>

      <ProductForm
        product={product}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/creator/products')}
        onUploadImage={handleImageUpload}
        loading={saving}
      />
    </div>
  );
};

export default CreatorProductEdit;
