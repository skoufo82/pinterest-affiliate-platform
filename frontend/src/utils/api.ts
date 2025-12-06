import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import toast from 'react-hot-toast';
import type {
  ProductsResponse,
  ProductResponse,
  CategoriesResponse,
  ProductInput,
  ImageUploadResponse,
  DeleteResponse,
} from '@/types';

// API base URL from environment variable or default
const API_BASE_URL = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create Axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Configure retry logic with exponential backoff
axiosRetry(apiClient, {
  retries: 3, // Maximum 3 retry attempts
  retryDelay: (retryCount) => {
    // Exponential backoff: 1s, 2s, 4s
    return Math.pow(2, retryCount - 1) * 1000;
  },
  retryCondition: (error: AxiosError) => {
    // Retry on network errors or 5xx server errors
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response?.status !== undefined && error.response.status >= 500)
    );
  },
  onRetry: (retryCount, _error, requestConfig) => {
    // Show toast notification during retries
    const retryMessage = `Retrying request (${retryCount}/3)...`;
    toast.loading(retryMessage, {
      id: 'retry-toast',
      duration: 2000,
    });
    console.log(`Retry attempt ${retryCount} for ${requestConfig.url}`);
  },
});

// Function to set auth token (will be called from AuthContext)
let getAuthToken: (() => Promise<string | null>) | null = null;

export const setAuthTokenGetter = (getter: () => Promise<string | null>) => {
  getAuthToken = getter;
};

// Request interceptor for logging and auth
apiClient.interceptors.request.use(
  async (config) => {
    // Add JWT token to admin and creator API requests
    if ((config.url?.includes('/admin') || config.url?.includes('/creator')) && getAuthToken) {
      try {
        const token = await getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Failed to get auth token:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    // Dismiss retry toast on success
    toast.dismiss('retry-toast');
    return response;
  },
  (error: AxiosError) => {
    // Dismiss retry toast
    toast.dismiss('retry-toast');
    
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.message);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Public API methods
export const api = {
  // Get all products with optional filtering
  getProducts: async (params?: {
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<ProductsResponse> => {
    const response = await apiClient.get<ProductsResponse>('/products', { params });
    return response.data;
  },

  // Get single product by ID
  getProduct: async (id: string): Promise<ProductResponse> => {
    const response = await apiClient.get<ProductResponse>(`/products/${id}`);
    return response.data;
  },

  // Get all categories
  getCategories: async (): Promise<CategoriesResponse> => {
    const response = await apiClient.get<CategoriesResponse>('/categories');
    return response.data;
  },

  // Get creator by slug
  getCreatorBySlug: async (slug: string): Promise<import('@/types').CreatorResponse> => {
    const response = await apiClient.get<import('@/types').CreatorResponse>(`/creators/${slug}`);
    return response.data;
  },

  // Get creator's products
  getCreatorProducts: async (slug: string, params?: {
    category?: string;
    search?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<import('@/types').CreatorProductsResponse> => {
    const response = await apiClient.get<import('@/types').CreatorProductsResponse>(`/creators/${slug}/products`, { params });
    return response.data;
  },

  // Get creator's featured products
  getCreatorFeaturedProducts: async (slug: string): Promise<import('@/types').CreatorProductsResponse> => {
    const response = await apiClient.get<import('@/types').CreatorProductsResponse>(`/creators/${slug}/featured`);
    return response.data;
  },

  // Create a new creator account (signup)
  createCreator: async (data: {
    username: string;
    email: string;
    displayName: string;
    password: string;
  }): Promise<import('@/types').CreatorResponse> => {
    const response = await apiClient.post<import('@/types').CreatorResponse>('/creators', data);
    return response.data;
  },

  // Get all active creators (for browse page)
  getAllCreators: async (params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<import('@/types').CreatorsResponse> => {
    const response = await apiClient.get<import('@/types').CreatorsResponse>('/creators', { params });
    return response.data;
  },
};

// Creator API methods (authenticated creator endpoints)
export const creatorApi = {
  // Get authenticated creator's profile
  getProfile: async (): Promise<import('@/types').CreatorResponse> => {
    const response = await apiClient.get<import('@/types').CreatorResponse>('/creator/profile');
    return response.data;
  },

  // Update authenticated creator's profile
  updateProfile: async (data: Partial<import('@/types').Creator>): Promise<import('@/types').CreatorResponse> => {
    const response = await apiClient.put<import('@/types').CreatorResponse>('/creator/profile', data);
    return response.data;
  },

  // Get authenticated creator's products
  getProducts: async (): Promise<import('@/types').CreatorProductsResponse> => {
    const response = await apiClient.get<import('@/types').CreatorProductsResponse>('/creator/products');
    return response.data;
  },

  // Create a new product
  createProduct: async (data: import('@/types').ProductInput): Promise<import('@/types').ProductResponse> => {
    const response = await apiClient.post<import('@/types').ProductResponse>('/creator/products', data);
    return response.data;
  },

  // Update a product
  updateProduct: async (id: string, data: Partial<import('@/types').ProductInput>): Promise<import('@/types').ProductResponse> => {
    const response = await apiClient.put<import('@/types').ProductResponse>(`/creator/products/${id}`, data);
    return response.data;
  },

  // Delete a product
  deleteProduct: async (id: string): Promise<import('@/types').DeleteResponse> => {
    const response = await apiClient.delete<import('@/types').DeleteResponse>(`/creator/products/${id}`);
    return response.data;
  },

  // Get analytics
  getAnalytics: async (params?: { startDate?: string; endDate?: string }): Promise<import('@/types').AnalyticsResponse> => {
    const response = await apiClient.get<import('@/types').AnalyticsResponse>('/creator/analytics', { params });
    return response.data;
  },
};

// Admin API methods
export const adminApi = {
  // Get all products (including unpublished)
  getAllProducts: async (): Promise<ProductsResponse> => {
    // Add timestamp to prevent caching
    const response = await apiClient.get<ProductsResponse>('/admin/products', {
      params: { _t: Date.now() }
    });
    return response.data;
  },

  // Create new product
  createProduct: async (data: ProductInput): Promise<ProductResponse> => {
    const response = await apiClient.post<ProductResponse>('/admin/products', data);
    return response.data;
  },

  // Update existing product
  updateProduct: async (id: string, data: Partial<ProductInput>): Promise<ProductResponse> => {
    const response = await apiClient.put<ProductResponse>(`/admin/products/${id}`, data);
    return response.data;
  },

  // Delete product
  deleteProduct: async (id: string): Promise<DeleteResponse> => {
    const response = await apiClient.delete<DeleteResponse>(`/admin/products/${id}`);
    return response.data;
  },

  // Upload image and get presigned URL
  uploadImage: async (fileName: string, fileType: string): Promise<ImageUploadResponse> => {
    const response = await apiClient.post<ImageUploadResponse>('/admin/upload-image', {
      fileName,
      fileType,
    });
    return response.data;
  },

  // Upload file to S3 using presigned URL
  uploadToS3: async (presignedUrl: string, file: File): Promise<void> => {
    await axios.put(presignedUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
    });
  },

  // User Management
  listUsers: async (): Promise<any> => {
    const response = await apiClient.get('/admin/users');
    return response.data;
  },

  createUser: async (data: {
    email: string;
    username: string;
    givenName?: string;
    familyName?: string;
    password?: string;
    sendEmail?: boolean;
  }): Promise<any> => {
    const response = await apiClient.post('/admin/users', data);
    return response.data;
  },

  deleteUser: async (username: string): Promise<any> => {
    const response = await apiClient.delete(`/admin/users/${username}`);
    return response.data;
  },

  resetPassword: async (username: string, password: string, temporary = false): Promise<any> => {
    const response = await apiClient.post(`/admin/users/${username}/reset-password`, {
      password,
      temporary,
    });
    return response.data;
  },

  // Price Sync Management
  triggerPriceSync: async (): Promise<any> => {
    const response = await apiClient.post('/admin/sync-prices');
    return response.data;
  },

  getSyncHistory: async (params?: {
    startDate?: string;
    endDate?: string;
    status?: 'success' | 'partial' | 'failed';
    limit?: number;
  }): Promise<any> => {
    const response = await apiClient.get('/admin/sync-history', { params });
    return response.data;
  },

  // Creator Management
  getAllCreators: async (): Promise<import('@/types').CreatorsResponse> => {
    const response = await apiClient.get<import('@/types').CreatorsResponse>('/admin/creators');
    return response.data;
  },

  updateCreatorStatus: async (id: string, status: 'active' | 'disabled'): Promise<import('@/types').CreatorResponse> => {
    const response = await apiClient.put<import('@/types').CreatorResponse>(`/admin/creators/${id}/status`, { status });
    return response.data;
  },

  // Product Moderation
  getPendingProducts: async (): Promise<import('@/types').ProductsResponse> => {
    const response = await apiClient.get<import('@/types').ProductsResponse>('/admin/products/pending');
    return response.data;
  },

  approveProduct: async (id: string): Promise<import('@/types').ProductResponse> => {
    const response = await apiClient.put<import('@/types').ProductResponse>(`/admin/products/${id}/approve`);
    return response.data;
  },

  rejectProduct: async (id: string, reason: string): Promise<import('@/types').ProductResponse> => {
    const response = await apiClient.put<import('@/types').ProductResponse>(`/admin/products/${id}/reject`, { reason });
    return response.data;
  },

  // Platform Analytics
  getPlatformAnalytics: async (): Promise<import('@/types').PlatformAnalyticsResponse> => {
    const response = await apiClient.get<import('@/types').PlatformAnalyticsResponse>('/admin/analytics');
    return response.data;
  },
};

export default apiClient;
