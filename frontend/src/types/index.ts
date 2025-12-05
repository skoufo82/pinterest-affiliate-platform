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
  creatorId?: string; // Creator ownership
  status?: 'pending' | 'approved' | 'rejected'; // Moderation status
  rejectionReason?: string; // If rejected
}

export interface Creator {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  bio: string;
  profileImage: string;
  coverImage: string;
  socialLinks: {
    instagram?: string;
    pinterest?: string;
    tiktok?: string;
  };
  theme: {
    primaryColor: string;
    accentColor: string;
    font: string;
  };
  status: 'active' | 'disabled';
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

export interface CreatorResponse {
  creator: Creator;
  theme: Creator['theme'];
}

export interface CreatorProductsResponse {
  products: Product[];
  total: number;
}

export interface CreatorsResponse {
  creators: Creator[];
  total: number;
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

// Analytics types
export interface AnalyticsResponse {
  creatorId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalPageViews: number;
  totalProductViews: number;
  totalAffiliateClicks: number;
  clickThroughRate: number;
  topProducts: Array<{
    productId: string;
    views: number;
    clicks: number;
    clickThroughRate: number;
  }>;
  dailyMetrics: Array<{
    date: string;
    pageViews: number;
    productViews: number;
    affiliateClicks: number;
  }>;
}

// Platform Analytics types
export interface PlatformAnalyticsResponse {
  totalCreators: number;
  activeCreators: number;
  totalProducts: number;
  pendingProducts: number;
  approvedProducts: number;
  rejectedProducts: number;
  totalPageViews: number;
  totalAffiliateClicks: number;
  topCreators: Array<{
    creatorId: string;
    displayName: string;
    slug: string;
    pageViews: number;
    affiliateClicks: number;
    productCount: number;
  }>;
  recentApprovals: Array<{
    productId: string;
    title: string;
    creatorName: string;
    approvedAt: string;
  }>;
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
