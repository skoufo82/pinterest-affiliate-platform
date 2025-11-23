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
  published: boolean;
  createdAt: string;
  updatedAt: string;
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
