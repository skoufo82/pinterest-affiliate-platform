import { useState, useEffect, FormEvent } from 'react';
import { ImageUploader } from './ImageUploader';
import type { Product, ProductInput } from '@/types';

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: ProductInput) => Promise<void>;
  onCancel: () => void;
  onUploadImage: (file: File) => Promise<string | null>;
  loading?: boolean;
}

const categories = [
  { value: 'home', label: 'Home & Kitchen' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'tech', label: 'Tech' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'outdoor', label: 'Outdoor' },
];

export const ProductForm = ({
  product,
  onSubmit,
  onCancel,
  onUploadImage,
  loading = false,
}: ProductFormProps) => {
  const [formData, setFormData] = useState<ProductInput>({
    title: '',
    description: '',
    category: 'home',
    imageUrl: '',
    amazonLink: '',
    price: '',
    tags: [],
    published: false,
  });

  const [tagsInput, setTagsInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-populate form when editing
  useEffect(() => {
    if (product) {
      setFormData({
        title: product.title,
        description: product.description,
        category: product.category,
        imageUrl: product.imageUrl,
        amazonLink: product.amazonLink,
        price: product.price || '',
        tags: product.tags || [],
        published: product.published,
      });
      setTagsInput(product.tags?.join(', ') || '');
    }
  }, [product]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 2000) {
      newErrors.description = 'Description must be less than 2000 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.imageUrl) {
      newErrors.imageUrl = 'Image is required';
    }

    if (!formData.amazonLink.trim()) {
      newErrors.amazonLink = 'Amazon link is required';
    } else if (!formData.amazonLink.startsWith('https://')) {
      newErrors.amazonLink = 'Amazon link must be a valid HTTPS URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Parse tags from comma-separated string
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const submitData: ProductInput = {
      ...formData,
      tags: tags.length > 0 ? tags : undefined,
      price: formData.price || undefined,
    };

    await onSubmit(submitData);
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    const imageUrl = await onUploadImage(file);
    if (imageUrl) {
      setFormData((prev) => ({ ...prev, imageUrl }));
      setErrors((prev) => ({ ...prev, imageUrl: '' }));
    }
    return imageUrl;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title *
        </label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.title ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
          maxLength={200}
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
        <p className="mt-1 text-xs text-gray-500">{formData.title.length}/200 characters</p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description *
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={5}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.description ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
          maxLength={2000}
        />
        {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
        <p className="mt-1 text-xs text-gray-500">{formData.description.length}/2000 characters</p>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          Category *
        </label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.category ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Product Image *
        </label>
        <ImageUploader
          onUpload={handleImageUpload}
          currentImageUrl={formData.imageUrl}
          disabled={loading}
        />
        {errors.imageUrl && <p className="mt-1 text-sm text-red-600">{errors.imageUrl}</p>}
      </div>

      {/* Amazon Link */}
      <div>
        <label htmlFor="amazonLink" className="block text-sm font-medium text-gray-700 mb-1">
          Amazon Affiliate Link *
        </label>
        <input
          type="url"
          id="amazonLink"
          value={formData.amazonLink}
          onChange={(e) => setFormData({ ...formData, amazonLink: e.target.value })}
          placeholder="https://amazon.com/dp/..."
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.amazonLink ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.amazonLink && <p className="mt-1 text-sm text-red-600">{errors.amazonLink}</p>}
      </div>

      {/* Price (Optional) */}
      <div>
        <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
          Price (Optional)
        </label>
        <input
          type="text"
          id="price"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          placeholder="$29.99"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500">Display price (e.g., $29.99)</p>
      </div>

      {/* Tags (Optional) */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
          Tags (Optional)
        </label>
        <input
          type="text"
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="wireless, bluetooth, tech"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500">Comma-separated tags</p>
      </div>

      {/* Published Status */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="published"
          checked={formData.published}
          onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          disabled={loading}
        />
        <label htmlFor="published" className="ml-2 block text-sm text-gray-700">
          Publish product (make visible on public site)
        </label>
      </div>

      {/* Form Actions */}
      <div className="flex gap-4 pt-4 border-t">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
