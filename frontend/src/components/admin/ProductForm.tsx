import { useState, useEffect, FormEvent } from 'react';
import { ImageUploader } from './ImageUploader';
import type { Product, ProductInput } from '@/types';
import { extractASIN } from '@/utils/asinExtractor';

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: ProductInput) => Promise<void>;
  onCancel: () => void;
  onUploadImage: (file: File) => Promise<string | null>;
  loading?: boolean;
}

const categories = [
  { value: 'home-kitchen', label: 'Home & Kitchen' },
  { value: 'fashion-beauty', label: 'Fashion & Beauty' },
  { value: 'tech-electronics', label: 'Tech & Electronics' },
  { value: 'health-wellness', label: 'Health & Wellness' },
  { value: 'books-stationery', label: 'Books & Stationery' },
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
    featured: false,
  });

  const [tagsInput, setTagsInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [extractedAsin, setExtractedAsin] = useState<string | null>(null);

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
        featured: product.featured || false,
      });
      setTagsInput(product.tags?.join(', ') || '');
      setExtractedAsin(product.asin || null);
    }
  }, [product]);

  // Auto-extract ASIN when Amazon URL changes
  useEffect(() => {
    if (formData.amazonLink) {
      const asin = extractASIN(formData.amazonLink);
      setExtractedAsin(asin);
    } else {
      setExtractedAsin(null);
    }
  }, [formData.amazonLink]);

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

      {/* ASIN Display (Auto-extracted, Read-only) */}
      {formData.amazonLink && (
        <div>
          <label htmlFor="asin" className="block text-sm font-medium text-gray-700 mb-1">
            ASIN (Auto-extracted)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              id="asin"
              value={extractedAsin || 'Not found'}
              readOnly
              className={`flex-1 px-3 py-2 border rounded-md bg-gray-50 ${
                extractedAsin ? 'text-gray-900 border-gray-300' : 'text-red-600 border-red-300'
              }`}
            />
            {extractedAsin ? (
              <span className="text-green-600 text-sm font-medium">✓ Valid</span>
            ) : (
              <span className="text-red-600 text-sm font-medium">✗ Invalid URL</span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Amazon Standard Identification Number extracted from the URL
          </p>
        </div>
      )}

      {/* Price Sync Status (Only shown when editing existing product) */}
      {product && (
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Price Sync Status</h3>
          
          {/* Sync Status Indicator */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Status
            </label>
            <div className="flex items-center gap-2">
              {product.priceSyncStatus === 'success' && (
                <>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✓ Success
                  </span>
                  <span className="text-xs text-gray-500">Price synced successfully</span>
                </>
              )}
              {product.priceSyncStatus === 'failed' && (
                <>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    ✗ Failed
                  </span>
                  <span className="text-xs text-gray-500">Price sync failed</span>
                </>
              )}
              {product.priceSyncStatus === 'pending' && (
                <>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    ⏳ Pending
                  </span>
                  <span className="text-xs text-gray-500">Waiting for sync</span>
                </>
              )}
              {!product.priceSyncStatus && (
                <>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    — Not synced
                  </span>
                  <span className="text-xs text-gray-500">No sync attempted yet</span>
                </>
              )}
            </div>
          </div>

          {/* Last Updated Timestamp */}
          {product.priceLastUpdated && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Last Updated
              </label>
              <p className="text-sm text-gray-900">
                {new Date(product.priceLastUpdated).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
          )}

          {/* Sync Error Message */}
          {product.priceSyncError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <label className="block text-xs font-medium text-red-800 mb-1">
                Error Details
              </label>
              <p className="text-sm text-red-700 font-mono break-words">
                {product.priceSyncError}
              </p>
            </div>
          )}
        </div>
      )}

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

      {/* Featured Status */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="featured"
          checked={formData.featured || false}
          onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          disabled={loading}
        />
        <label htmlFor="featured" className="ml-2 block text-sm text-gray-700">
          Feature product (show on homepage)
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
