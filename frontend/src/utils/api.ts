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
    // Add JWT token to admin requests
    if (config.url?.includes('/admin') && getAuthToken) {
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
};

export default apiClient;
