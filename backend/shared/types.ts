// Shared types for backend Lambda functions

export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  amazonLink: string;
  price?: string;
  tags?: string[];
  published: string; // 'true' or 'false' as string for DynamoDB GSI compatibility
  featured?: string; // 'true' or 'false' as string for DynamoDB GSI compatibility
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
