// Shared types for backend Lambda functions

export interface Product {
  id: string;
  creatorId: string; // NEW: Creator ownership
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  amazonLink: string;
  price?: string;
  tags?: string[];
  published: string; // 'true' or 'false' as string for DynamoDB GSI compatibility
  featured: string; // 'true' or 'false' as string for DynamoDB GSI compatibility (NEW: required for creator pages)
  status: 'pending' | 'approved' | 'rejected'; // NEW: Moderation status
  rejectionReason?: string; // NEW: If rejected
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
  notificationPreferences?: {
    productApproval: boolean;
    productRejection: boolean;
    accountStatusChange: boolean;
    milestones: boolean;
  };
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsEvent {
  id: string;
  creatorId: string;
  eventType: 'page_view' | 'product_view' | 'affiliate_click';
  productId?: string;
  metadata: {
    userAgent?: string;
    referrer?: string;
    location?: string;
  };
  timestamp: string;
  ttl: number; // TTL for 90 days
}

export interface AnalyticsSummary {
  creatorId: string;
  date: string; // YYYY-MM-DD
  pageViews: number;
  productViews: number;
  affiliateClicks: number;
  topProducts: Array<{
    productId: string;
    views: number;
    clicks: number;
  }>;
}
