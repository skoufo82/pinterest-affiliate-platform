import { create } from 'zustand';
import toast from 'react-hot-toast';
import { api } from '@/utils/api';
import type { Product, Category } from '@/types';

interface ProductStore {
  // State
  products: Product[];
  categories: Category[];
  selectedProduct: Product | null;
  loading: boolean;
  error: string | null;
  
  // Cache management
  productsCache: Map<string, { data: Product[]; timestamp: number }>;
  categoriesCache: { data: Category[]; timestamp: number } | null;
  productCache: Map<string, { data: Product; timestamp: number }>;
  
  // Cache TTL (5 minutes)
  cacheTTL: number;
  
  // Actions
  fetchProducts: (category?: string, forceRefresh?: boolean) => Promise<void>;
  fetchProduct: (id: string, forceRefresh?: boolean) => Promise<Product | null>;
  fetchCategories: (forceRefresh?: boolean) => Promise<void>;
  clearCache: () => void;
  setError: (error: string | null) => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export const useProductStore = create<ProductStore>((set, get) => ({
  // Initial state
  products: [],
  categories: [],
  selectedProduct: null,
  loading: false,
  error: null,
  
  // Cache
  productsCache: new Map(),
  categoriesCache: null,
  productCache: new Map(),
  cacheTTL: CACHE_TTL,
  
  // Fetch products with optional category filter and caching
  fetchProducts: async (category?: string, forceRefresh = false) => {
    const cacheKey = category || 'all';
    const cached = get().productsCache.get(cacheKey);
    const now = Date.now();
    
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cached && now - cached.timestamp < get().cacheTTL) {
      set({ products: cached.data, loading: false, error: null });
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      const response = await api.getProducts({ category });
      const products = response.products;
      
      // Update cache
      const newCache = new Map(get().productsCache);
      newCache.set(cacheKey, { data: products, timestamp: now });
      
      set({
        products,
        productsCache: newCache,
        loading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch products';
      set({ loading: false, error: errorMessage });
      toast.error(errorMessage);
      console.error('Error fetching products:', error);
    }
  },
  
  // Fetch single product by ID with caching
  fetchProduct: async (id: string, forceRefresh = false) => {
    const cached = get().productCache.get(id);
    const now = Date.now();
    
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cached && now - cached.timestamp < get().cacheTTL) {
      set({ selectedProduct: cached.data, loading: false, error: null });
      return cached.data;
    }
    
    set({ loading: true, error: null });
    
    try {
      const response = await api.getProduct(id);
      const product = response.product;
      
      // Update cache
      const newCache = new Map(get().productCache);
      newCache.set(id, { data: product, timestamp: now });
      
      set({
        selectedProduct: product,
        productCache: newCache,
        loading: false,
        error: null,
      });
      
      return product;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch product';
      set({ loading: false, error: errorMessage, selectedProduct: null });
      toast.error(errorMessage);
      console.error('Error fetching product:', error);
      return null;
    }
  },
  
  // Fetch all categories with caching
  fetchCategories: async (forceRefresh = false) => {
    const cached = get().categoriesCache;
    const now = Date.now();
    
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cached && now - cached.timestamp < get().cacheTTL) {
      set({ categories: cached.data, loading: false, error: null });
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      const response = await api.getCategories();
      const categories = response.categories;
      
      set({
        categories,
        categoriesCache: { data: categories, timestamp: now },
        loading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch categories';
      set({ loading: false, error: errorMessage });
      toast.error(errorMessage);
      console.error('Error fetching categories:', error);
    }
  },
  
  // Clear all caches
  clearCache: () => {
    set({
      productsCache: new Map(),
      categoriesCache: null,
      productCache: new Map(),
    });
  },
  
  // Set error message
  setError: (error: string | null) => {
    set({ error });
  },
}));
