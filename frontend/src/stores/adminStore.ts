import { create } from 'zustand';
import toast from 'react-hot-toast';
import { adminApi } from '@/utils/api';
import type { Product, ProductInput } from '@/types';

interface AdminStore {
  // State
  products: Product[];
  selectedProduct: Product | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  
  // Actions
  fetchAllProducts: () => Promise<void>;
  createProduct: (data: ProductInput) => Promise<Product | null>;
  updateProduct: (id: string, data: Partial<ProductInput>) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
  uploadImage: (file: File) => Promise<string | null>;
  setSelectedProduct: (product: Product | null) => void;
  setError: (error: string | null) => void;
  setSuccessMessage: (message: string | null) => void;
  clearMessages: () => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  // Initial state
  products: [],
  selectedProduct: null,
  loading: false,
  error: null,
  successMessage: null,
  
  // Fetch all products (including unpublished)
  fetchAllProducts: async () => {
    set({ loading: true, error: null });
    
    try {
      const response = await adminApi.getAllProducts();
      set({
        products: response.products,
        loading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch products';
      set({ loading: false, error: errorMessage });
      toast.error(errorMessage);
      console.error('Error fetching all products:', error);
    }
  },
  
  // Create new product
  createProduct: async (data: ProductInput) => {
    set({ loading: true, error: null, successMessage: null });
    
    try {
      const response = await adminApi.createProduct(data);
      const newProduct = response.product;
      
      // Add to products list
      set((state) => ({
        products: [...state.products, newProduct],
        loading: false,
        error: null,
        successMessage: 'Product created successfully',
      }));
      
      toast.success('Product created successfully');
      return newProduct;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create product';
      set({ loading: false, error: errorMessage });
      toast.error(errorMessage);
      console.error('Error creating product:', error);
      return null;
    }
  },
  
  // Update existing product
  updateProduct: async (id: string, data: Partial<ProductInput>) => {
    set({ loading: true, error: null, successMessage: null });
    
    try {
      const response = await adminApi.updateProduct(id, data);
      const updatedProduct = response.product;
      
      // Update in products list
      set((state) => ({
        products: state.products.map((p) => (p.id === id ? updatedProduct : p)),
        selectedProduct: state.selectedProduct?.id === id ? updatedProduct : state.selectedProduct,
        loading: false,
        error: null,
        successMessage: 'Product updated successfully',
      }));
      
      toast.success('Product updated successfully');
      return updatedProduct;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update product';
      set({ loading: false, error: errorMessage });
      toast.error(errorMessage);
      console.error('Error updating product:', error);
      return null;
    }
  },
  
  // Delete product
  deleteProduct: async (id: string) => {
    set({ loading: true, error: null, successMessage: null });
    
    try {
      await adminApi.deleteProduct(id);
      
      // Remove from products list
      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
        selectedProduct: state.selectedProduct?.id === id ? null : state.selectedProduct,
        loading: false,
        error: null,
        successMessage: 'Product deleted successfully',
      }));
      
      toast.success('Product deleted successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete product';
      set({ loading: false, error: errorMessage });
      toast.error(errorMessage);
      console.error('Error deleting product:', error);
      return false;
    }
  },
  
  // Upload image to S3
  uploadImage: async (file: File) => {
    set({ loading: true, error: null });
    
    try {
      // Get presigned URL
      const response = await adminApi.uploadImage(file.name, file.type);
      
      // Upload file to S3
      await adminApi.uploadToS3(response.uploadUrl, file);
      
      set({ loading: false, error: null });
      toast.success('Image uploaded successfully');
      return response.imageUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
      set({ loading: false, error: errorMessage });
      toast.error(errorMessage);
      console.error('Error uploading image:', error);
      return null;
    }
  },
  
  // Set selected product
  setSelectedProduct: (product: Product | null) => {
    set({ selectedProduct: product });
  },
  
  // Set error message
  setError: (error: string | null) => {
    set({ error });
  },
  
  // Set success message
  setSuccessMessage: (message: string | null) => {
    set({ successMessage: message });
  },
  
  // Clear all messages
  clearMessages: () => {
    set({ error: null, successMessage: null });
  },
}));
