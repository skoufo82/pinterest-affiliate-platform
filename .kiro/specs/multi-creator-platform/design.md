# Design Document

## Overview

The Multi-Creator Platform transforms the existing Pinterest Affiliate Platform into a marketplace where multiple creators can manage their own branded storefronts. Each creator gets a unique landing page (e.g., `/creator/sarah-home-decor`) showcasing their curated products with customizable themes, featured items, and category organization. The design maintains backward compatibility with the existing single-storefront model while adding creator-specific features including product ownership, analytics, and profile management.

The architecture leverages the existing AWS infrastructure (Cognito, API Gateway, Lambda, DynamoDB, S3) and extends it with new data models, API endpoints, and access control mechanisms. The system supports both web and mobile interfaces for creators while maintaining a seamless public browsing experience for visitors.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Public Web Interface                     │
│  - Homepage (all creators)                                   │
│  - Creator Landing Pages (/creator/{slug})                   │
│  - Product Detail Pages                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway + Lambda                      │
│  - Public APIs (read-only)                                   │
│  - Creator APIs (CRUD with ownership checks)                 │
│  - Admin APIs (full access)                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Cognito                             │
│  - User authentication                                       │
│  - Role-based groups (admin, creator, viewer)                │
│  - JWT token generation                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        DynamoDB                              │
│  - Creators Table (profiles, themes, settings)              │
│  - Products Table (with creatorId for ownership)             │
│  - Analytics Table (page views, clicks by creator)           │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Path-Based Routing**: Use `/creator/{slug}` pattern for creator landing pages to avoid DNS complexity
2. **Product Ownership Model**: Add `creatorId` field to products for data isolation and access control
3. **Backward Compatibility**: Maintain existing homepage showing all products from all creators
4. **Stateless API Design**: All creator context derived from JWT tokens, no server-side sessions
5. **Optimistic UI Updates**: Mobile and web apps update UI immediately, sync with backend asynchronously


## Components and Interfaces

### Frontend Components

#### 1. Creator Landing Page Component
- **Purpose**: Display a creator's branded storefront with their products
- **Props**: `creatorSlug: string`
- **State**: Creator profile, products, theme settings, loading states
- **Key Features**:
  - Hero section with cover image and profile
  - Featured products carousel
  - Category filters
  - Product grid with search/sort
  - Social media links

#### 2. Creator Profile Editor Component
- **Purpose**: Allow creators to edit their profile information
- **Props**: `creatorId: string`
- **State**: Profile form data, image uploads, validation errors
- **Key Features**:
  - Display name and bio editing
  - Profile and cover image upload with preview
  - Social media link management
  - Theme color picker
  - Real-time preview of changes

#### 3. Creator Product Manager Component
- **Purpose**: CRUD interface for creator's products
- **Props**: `creatorId: string`
- **State**: Product list, filters, selected product
- **Key Features**:
  - Product list with ownership filtering
  - Create/Edit/Delete operations
  - Featured product toggle
  - Approval status indicators
  - Bulk operations (future)

#### 4. Creator Analytics Dashboard Component
- **Purpose**: Display performance metrics for creator's storefront
- **Props**: `creatorId: string`
- **State**: Analytics data, date range, chart configurations
- **Key Features**:
  - Page view trends
  - Click-through rates
  - Top products by performance
  - Traffic sources
  - Date range selector

### Backend Components

#### 1. Creator Service
- **Responsibilities**: Creator profile CRUD operations
- **Key Methods**:
  - `createCreator(profile: CreatorProfile): Promise<Creator>`
  - `getCreatorBySlug(slug: string): Promise<Creator>`
  - `updateCreator(id: string, updates: Partial<Creator>): Promise<Creator>`
  - `validateSlugUniqueness(slug: string): Promise<boolean>`

#### 2. Product Service (Enhanced)
- **Responsibilities**: Product CRUD with ownership validation
- **Key Methods**:
  - `createProduct(product: Product, creatorId: string): Promise<Product>`
  - `getProductsByCreator(creatorId: string): Promise<Product[]>`
  - `updateProduct(id: string, updates: Partial<Product>, creatorId: string): Promise<Product>`
  - `deleteProduct(id: string, creatorId: string): Promise<void>`
  - `verifyOwnership(productId: string, creatorId: string): Promise<boolean>`

#### 3. Analytics Service
- **Responsibilities**: Track and aggregate creator metrics
- **Key Methods**:
  - `trackPageView(creatorId: string, metadata: object): Promise<void>`
  - `trackAffiliateClick(productId: string, creatorId: string): Promise<void>`
  - `getCreatorAnalytics(creatorId: string, dateRange: DateRange): Promise<Analytics>`
  - `getTopProducts(creatorId: string, limit: number): Promise<Product[]>`

#### 4. Authorization Service
- **Responsibilities**: Role-based access control and ownership validation
- **Key Methods**:
  - `verifyCreatorRole(userId: string): Promise<boolean>`
  - `verifyAdminRole(userId: string): Promise<boolean>`
  - `verifyProductOwnership(userId: string, productId: string): Promise<boolean>`
  - `extractCreatorIdFromToken(token: string): string`

### API Endpoints

#### Public Endpoints (No Auth Required)

```
GET /api/creators/{slug}
  - Returns creator profile and theme
  - Response: { creator: Creator, theme: Theme }

GET /api/creators/{slug}/products
  - Returns all approved products for a creator
  - Query params: category, search, sort, limit, offset
  - Response: { products: Product[], total: number }

GET /api/creators/{slug}/featured
  - Returns featured products for a creator
  - Response: { products: Product[] }
```

#### Creator Endpoints (Creator Auth Required)

```
GET /api/creator/profile
  - Returns authenticated creator's profile
  - Response: { creator: Creator }

PUT /api/creator/profile
  - Updates authenticated creator's profile
  - Body: { displayName?, bio?, profileImage?, coverImage?, socialLinks?, theme? }
  - Response: { creator: Creator }

GET /api/creator/products
  - Returns authenticated creator's products (all statuses)
  - Response: { products: Product[] }

POST /api/creator/products
  - Creates a new product owned by authenticated creator
  - Body: { title, description, price, imageUrl, amazonLink, category, featured? }
  - Response: { product: Product }

PUT /api/creator/products/{id}
  - Updates a product (ownership verified)
  - Body: Partial<Product>
  - Response: { product: Product }

DELETE /api/creator/products/{id}
  - Deletes a product (ownership verified)
  - Response: { success: boolean }

GET /api/creator/analytics
  - Returns analytics for authenticated creator
  - Query params: startDate, endDate
  - Response: { analytics: Analytics }
```

#### Admin Endpoints (Admin Auth Required)

```
GET /api/admin/creators
  - Returns all creators
  - Response: { creators: Creator[] }

PUT /api/admin/creators/{id}/status
  - Enable/disable creator account
  - Body: { status: 'active' | 'disabled' }
  - Response: { creator: Creator }

GET /api/admin/products/pending
  - Returns all products pending approval
  - Response: { products: Product[] }

PUT /api/admin/products/{id}/approve
  - Approves a product
  - Response: { product: Product }

PUT /api/admin/products/{id}/reject
  - Rejects a product
  - Body: { reason: string }
  - Response: { product: Product }
```


## Data Models

### Creator Model

```typescript
interface Creator {
  id: string;                    // UUID
  userId: string;                // Cognito user ID
  slug: string;                  // URL-safe unique identifier
  displayName: string;           // Public display name
  bio: string;                   // Creator bio (max 500 chars)
  profileImage: string;          // S3 URL
  coverImage: string;            // S3 URL
  socialLinks: {
    instagram?: string;
    pinterest?: string;
    tiktok?: string;
  };
  theme: {
    primaryColor: string;        // Hex color
    accentColor: string;         // Hex color
    font: string;                // Font family name
  };
  status: 'active' | 'disabled'; // Account status
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

**DynamoDB Schema:**
- **Table Name**: `Creators`
- **Partition Key**: `id` (String)
- **GSI 1**: `slug-index` - Partition Key: `slug` (String)
- **GSI 2**: `userId-index` - Partition Key: `userId` (String)

### Product Model (Enhanced)

```typescript
interface Product {
  id: string;                    // UUID
  creatorId: string;             // NEW: Creator ownership
  title: string;
  description: string;
  price: number;
  imageUrl: string;              // S3 URL
  amazonLink: string;
  category: string;
  featured: boolean;             // NEW: Featured on creator page
  status: 'pending' | 'approved' | 'rejected'; // NEW: Moderation status
  rejectionReason?: string;      // NEW: If rejected
  priceLastUpdated?: string;     // ISO 8601 timestamp
  createdAt: string;
  updatedAt: string;
}
```

**DynamoDB Schema:**
- **Table Name**: `Products`
- **Partition Key**: `id` (String)
- **GSI 1**: `creatorId-index` - Partition Key: `creatorId` (String), Sort Key: `createdAt` (String)
- **GSI 2**: `category-index` - Partition Key: `category` (String), Sort Key: `createdAt` (String)
- **GSI 3**: `status-index` - Partition Key: `status` (String), Sort Key: `createdAt` (String)

### Analytics Model

```typescript
interface AnalyticsEvent {
  id: string;                    // UUID
  creatorId: string;             // Creator being tracked
  eventType: 'page_view' | 'product_view' | 'affiliate_click';
  productId?: string;            // If product-specific event
  metadata: {
    userAgent?: string;
    referrer?: string;
    location?: string;
  };
  timestamp: string;             // ISO 8601 timestamp
}

interface AnalyticsSummary {
  creatorId: string;
  date: string;                  // YYYY-MM-DD
  pageViews: number;
  productViews: number;
  affiliateClicks: number;
  topProducts: Array<{
    productId: string;
    views: number;
    clicks: number;
  }>;
}
```

**DynamoDB Schema:**
- **Table Name**: `AnalyticsEvents`
- **Partition Key**: `creatorId` (String)
- **Sort Key**: `timestamp` (String)
- **TTL**: 90 days (for raw events)

- **Table Name**: `AnalyticsSummaries`
- **Partition Key**: `creatorId` (String)
- **Sort Key**: `date` (String)

### User Model (Enhanced)

```typescript
interface User {
  id: string;                    // Cognito user ID
  email: string;
  role: 'admin' | 'creator' | 'viewer';
  creatorId?: string;            // NEW: Link to Creator if role is creator
  createdAt: string;
  updatedAt: string;
}
```

**Note**: User data primarily stored in Cognito. DynamoDB table used for additional metadata and creator linkage.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Creator Slug Uniqueness
*For any* two creators in the system, their slugs must be different.
**Validates: Requirements 1.3**

### Property 2: Product Ownership Assignment
*For any* product created by a creator, the product's creatorId must equal the creator's ID.
**Validates: Requirements 3.1**

### Property 3: Creator Product Isolation
*For any* creator requesting their product list, the returned products must all have creatorId matching the requesting creator's ID.
**Validates: Requirements 3.2**

### Property 4: Ownership Verification for Updates
*For any* product update request, if the requesting creator's ID does not match the product's creatorId, the system must reject the request.
**Validates: Requirements 3.3**

### Property 5: Ownership Verification for Deletes
*For any* product delete request, if the requesting creator's ID does not match the product's creatorId, the system must reject the request.
**Validates: Requirements 3.4**

### Property 6: Cross-Creator Access Denial
*For any* creator attempting to access another creator's product, the system must return an authorization error.
**Validates: Requirements 3.5**

### Property 7: Profile Update Round-Trip
*For any* creator profile update, retrieving the profile immediately after should return the updated values.
**Validates: Requirements 2.1**

### Property 8: URL-Safe Slug Validation
*For any* username containing characters outside [a-z0-9-], the system must reject the slug creation.
**Validates: Requirements 1.4**

### Property 9: Featured Product Display Order
*For any* creator landing page with featured products, featured products must appear before non-featured products in the display.
**Validates: Requirements 5.3**

### Property 10: Category Filter Accuracy
*For any* category filter selection on a creator's page, all returned products must belong to that category and that creator.
**Validates: Requirements 6.3**

### Property 11: Pending Product Visibility
*For any* product with status 'pending', the product must not appear on the public creator landing page.
**Validates: Requirements 13.2**

### Property 12: Admin Override Authority
*For any* product deletion by an admin, the deletion must succeed regardless of the product's creatorId.
**Validates: Requirements 9.4**

### Property 13: Theme Application Consistency
*For any* creator with custom theme settings, their landing page must render using those exact theme colors.
**Validates: Requirements 8.4**

### Property 14: Analytics Event Recording
*For any* page view on a creator's landing page, an analytics event must be created with the correct creatorId and timestamp.
**Validates: Requirements 7.1**

### Property 15: Search Filter Combination
*For any* combination of search query and category filter, the results must match both the search terms AND the category.
**Validates: Requirements 12.4**

## Error Handling

### Authentication Errors

**Scenario**: User attempts to access creator endpoints without valid authentication
- **Response**: 401 Unauthorized
- **Message**: "Authentication required. Please log in."
- **Action**: Redirect to login page

**Scenario**: User with 'viewer' role attempts to access creator endpoints
- **Response**: 403 Forbidden
- **Message**: "Insufficient permissions. Creator role required."
- **Action**: Display error message, log attempt

### Authorization Errors

**Scenario**: Creator attempts to edit another creator's product
- **Response**: 403 Forbidden
- **Message**: "You do not have permission to modify this product."
- **Action**: Log security event, display error to user

**Scenario**: Creator attempts to access admin endpoints
- **Response**: 403 Forbidden
- **Message**: "Admin access required."
- **Action**: Log attempt, display error

### Validation Errors

**Scenario**: Creator attempts to create slug with invalid characters
- **Response**: 400 Bad Request
- **Message**: "Slug must contain only lowercase letters, numbers, and hyphens."
- **Action**: Display validation error, highlight invalid field

**Scenario**: Creator uploads image exceeding size limit
- **Response**: 413 Payload Too Large
- **Message**: "Image size must be less than 5MB."
- **Action**: Display error, suggest image compression

**Scenario**: Creator attempts to create duplicate slug
- **Response**: 409 Conflict
- **Message**: "This username is already taken. Please choose another."
- **Action**: Display error, suggest alternatives

### Not Found Errors

**Scenario**: Visitor navigates to non-existent creator slug
- **Response**: 404 Not Found
- **Message**: "Creator not found. This page may have been removed or the URL is incorrect."
- **Action**: Display friendly 404 page with search functionality

**Scenario**: Creator attempts to edit non-existent product
- **Response**: 404 Not Found
- **Message**: "Product not found."
- **Action**: Refresh product list, display error

### Rate Limiting

**Scenario**: User exceeds API rate limits
- **Response**: 429 Too Many Requests
- **Message**: "Too many requests. Please try again in {seconds} seconds."
- **Action**: Implement exponential backoff, display retry timer

### Database Errors

**Scenario**: DynamoDB operation fails
- **Response**: 500 Internal Server Error
- **Message**: "An error occurred. Please try again."
- **Action**: Log error with context, retry with exponential backoff, alert monitoring

**Scenario**: DynamoDB conditional check fails (optimistic locking)
- **Response**: 409 Conflict
- **Message**: "This item was modified by another request. Please refresh and try again."
- **Action**: Refresh data, allow user to retry


## Testing Strategy

### Dual Testing Approach

This feature requires both unit testing and property-based testing to ensure comprehensive coverage:

- **Unit tests** verify specific examples, edge cases, and error conditions
- **Property tests** verify universal properties that should hold across all inputs
- Together they provide complete coverage: unit tests catch concrete bugs, property tests verify general correctness

### Unit Testing

Unit tests will cover:

**Creator Service Tests:**
- Creating a creator with valid data returns a creator object
- Creating a creator with duplicate slug throws conflict error
- Updating creator profile persists changes
- Getting creator by invalid slug returns null

**Product Service Tests:**
- Creating product assigns correct creatorId
- Updating product with wrong creatorId throws authorization error
- Deleting product with wrong creatorId throws authorization error
- Admin can delete any product regardless of ownership

**Authorization Service Tests:**
- Valid JWT token extracts correct creatorId
- Expired JWT token throws authentication error
- Token without creator role throws authorization error

**API Integration Tests:**
- GET /api/creators/{slug} returns correct creator data
- POST /api/creator/products creates product with ownership
- PUT /api/creator/products/{id} rejects cross-creator updates
- GET /api/creator/analytics returns correct metrics

### Property-Based Testing

Property-based tests will use **fast-check** (JavaScript/TypeScript property testing library) with a minimum of 100 iterations per test.

Each property test must be tagged with a comment referencing the design document:

```typescript
// Feature: multi-creator-platform, Property 1: Creator Slug Uniqueness
```

**Property Test 1: Creator Slug Uniqueness**
- Generate random sets of creators
- Verify no two creators have the same slug
- **Validates: Property 1**

**Property Test 2: Product Ownership Assignment**
- Generate random creator and product data
- Create products for various creators
- Verify each product's creatorId matches its creator
- **Validates: Property 2**

**Property Test 3: Creator Product Isolation**
- Generate multiple creators with products
- For each creator, request their product list
- Verify all returned products belong to that creator
- **Validates: Property 3**

**Property Test 4: Ownership Verification for Updates**
- Generate products owned by different creators
- Attempt updates with mismatched creatorIds
- Verify all unauthorized attempts are rejected
- **Validates: Property 4**

**Property Test 5: Ownership Verification for Deletes**
- Generate products owned by different creators
- Attempt deletes with mismatched creatorIds
- Verify all unauthorized attempts are rejected
- **Validates: Property 5**

**Property Test 6: Profile Update Round-Trip**
- Generate random profile updates
- Update profile, then immediately retrieve
- Verify retrieved data matches updated data
- **Validates: Property 7**

**Property Test 7: URL-Safe Slug Validation**
- Generate random strings with various characters
- Attempt to create slugs with invalid characters
- Verify all invalid slugs are rejected
- **Validates: Property 8**

**Property Test 8: Featured Product Display Order**
- Generate random product sets with mixed featured status
- Retrieve creator landing page
- Verify featured products appear before non-featured
- **Validates: Property 9**

**Property Test 9: Category Filter Accuracy**
- Generate products across multiple categories and creators
- Apply category filters for each creator
- Verify results match both category and creator
- **Validates: Property 10**

**Property Test 10: Theme Application Consistency**
- Generate random theme configurations
- Apply themes to creators
- Verify landing pages render with correct themes
- **Validates: Property 13**

### Test Configuration

```json
{
  "testFramework": "vitest",
  "propertyTestingLibrary": "fast-check",
  "propertyTestIterations": 100,
  "coverage": {
    "statements": 80,
    "branches": 75,
    "functions": 80,
    "lines": 80
  }
}
```

### Testing Priorities

1. **Critical Path**: Creator registration, product CRUD, ownership validation
2. **Security**: Authorization checks, cross-creator access prevention
3. **Data Integrity**: Slug uniqueness, profile updates, analytics tracking
4. **User Experience**: Landing page rendering, theme application, search/filter

### Mock Strategy

- **AWS Services**: Mock Cognito, DynamoDB, S3 using AWS SDK mocks
- **External APIs**: No external APIs in this feature
- **Time-Dependent**: Mock Date.now() for consistent timestamp testing
- **Random Data**: Use fast-check generators for property tests

## Migration Strategy

### Phase 1: Database Schema Updates

1. **Add Creators Table**
   - Create DynamoDB table with GSIs
   - Set up IAM permissions

2. **Update Products Table**
   - Add `creatorId` field (nullable initially)
   - Add `featured` boolean field (default false)
   - Add `status` field (default 'approved' for existing)
   - Create new GSIs for creatorId and status

3. **Create Analytics Tables**
   - AnalyticsEvents table with TTL
   - AnalyticsSummaries table

### Phase 2: Data Migration

1. **Create Default Platform Creator**
   - Create a "platform" creator account
   - Assign all existing products to this creator
   - Set slug to "platform" or "featured"

2. **Backfill Product Fields**
   - Set `creatorId` for all existing products
   - Set `featured` to false
   - Set `status` to 'approved'

3. **Verify Data Integrity**
   - Run validation scripts
   - Ensure all products have valid creatorId
   - Verify no orphaned products

### Phase 3: API Updates

1. **Deploy New Endpoints**
   - Creator profile endpoints
   - Enhanced product endpoints with ownership
   - Analytics endpoints

2. **Update Existing Endpoints**
   - Add optional creatorId filtering
   - Maintain backward compatibility
   - Add deprecation warnings for old endpoints

3. **Update Frontend**
   - Add creator landing page routes
   - Update product management UI
   - Add creator profile editor

### Phase 4: Testing and Rollout

1. **Integration Testing**
   - Test all new endpoints
   - Verify ownership validation
   - Test creator workflows end-to-end

2. **Gradual Rollout**
   - Enable for beta creators first
   - Monitor errors and performance
   - Collect feedback

3. **Full Launch**
   - Open creator registration
   - Announce new features
   - Monitor analytics and usage

### Rollback Plan

- Keep old API endpoints active for 30 days
- Maintain ability to disable creator features via feature flag
- Database changes are additive (no data loss)
- Can revert frontend to previous version independently

## Performance Considerations

### Caching Strategy

- **Creator Profiles**: Cache for 5 minutes (CloudFront)
- **Product Lists**: Cache for 1 minute (API Gateway)
- **Analytics Summaries**: Cache for 1 hour
- **Static Assets**: Cache for 1 year (S3 + CloudFront)

### Database Optimization

- Use GSIs for efficient creator-based queries
- Implement pagination for large product lists
- Batch analytics writes to reduce write costs
- Use DynamoDB Streams for real-time analytics aggregation

### API Rate Limiting

- Public endpoints: 100 requests/minute per IP
- Creator endpoints: 1000 requests/minute per user
- Admin endpoints: 10000 requests/minute per user

### Monitoring and Alerts

- Track API latency (p50, p95, p99)
- Monitor DynamoDB throttling
- Alert on authentication failures
- Track creator registration rate
- Monitor storage costs (S3, DynamoDB)

## Security Considerations

### Authentication

- Use AWS Cognito for user management
- Implement JWT token validation on all protected endpoints
- Token expiration: 1 hour (refresh tokens: 30 days)
- Enforce HTTPS for all API calls

### Authorization

- Verify creator role from Cognito groups
- Validate product ownership on all mutations
- Implement admin role checks for privileged operations
- Log all authorization failures

### Data Protection

- Encrypt data at rest (DynamoDB encryption)
- Encrypt data in transit (TLS 1.2+)
- Sanitize user inputs to prevent XSS
- Validate and sanitize URLs (social links, Amazon links)
- Implement CORS policies

### Content Moderation

- All new products start in 'pending' status
- Admin approval required before public display
- Implement reporting mechanism for inappropriate content
- Store rejection reasons for audit trail

### Rate Limiting and DDoS Protection

- Implement API Gateway throttling
- Use AWS WAF for DDoS protection
- Monitor for suspicious patterns
- Implement CAPTCHA for registration

## Future Enhancements

### Phase 2 Features

- Custom domains for creators (e.g., shop.sarahfinds.com)
- Advanced theme customization (CSS editor)
- Bulk product import/export
- Product collections/bundles
- Collaborative products (multiple creators)

### Phase 3 Features

- Native iOS app for creators
- Native Android app for creators
- Push notifications
- In-app messaging between creators and visitors
- Creator verification badges

### Phase 4 Features

- Revenue sharing and payouts
- Premium creator tiers
- Advanced analytics (conversion funnels, A/B testing)
- Creator marketplace (hire creators)
- White-label solutions for enterprises
