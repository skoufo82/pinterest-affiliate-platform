// Frontend TypeScript types matching backend models

export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  amazonLink: string;
  price?: string;
  tags?: string[];
  published: boolean;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
  asin?: string; // Amazon Standard Identification Number
  priceLastUpdated?: string; // ISO timestamp of last price sync
  priceSyncStatus?: 'success' | 'failed' | 'pending';
  priceSyncError?: string; // Last error message if sync failed
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  description?: string;
  order: number;
}

export interface ImageUpload {
  fileName: string;
  fileType: string;
  uploadUrl: string;
  imageUrl: string;
  expiresAt: number;
}

// API Response types
export interface ProductsResponse {
  products: Product[];
  total: number;
  hasMore: boolean;
}

export interface ProductResponse {
  product: Product;
}

export interface CategoriesResponse {
  categories: Category[];
}

export interface ImageUploadResponse {
  uploadUrl: string;
  imageUrl: string;
}

export interface DeleteResponse {
  success: boolean;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
  };
}

// Form input types
export interface ProductInput {
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  amazonLink: string;
  price?: string;
  tags?: string[];
  published: boolean;
  featured?: boolean;
}
