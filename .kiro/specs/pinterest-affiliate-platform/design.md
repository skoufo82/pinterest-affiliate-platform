# Design Document

## Overview

The Pinterest Affiliate Product Landing Platform is a serverless, cloud-native web application built on AWS infrastructure. The architecture follows a decoupled frontend-backend pattern with a React-based single-page application hosted on AWS Amplify and a serverless backend powered by AWS Lambda, API Gateway, and DynamoDB.

The system is designed for high scalability, minimal operational overhead, and cost efficiency. It handles traffic spikes gracefully through AWS's auto-scaling capabilities while maintaining sub-second response times. The platform uses AWS CDK for infrastructure as code, enabling reproducible deployments and version-controlled infrastructure changes.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Amplify Hosting                           │
│                    (CloudFront + S3)                             │
│                    React SPA (Vite)                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AWS API Gateway                              │
│                     (REST API)                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AWS Lambda Functions                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ getProducts  │  │ createProduct│  │ uploadImage  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────┬───────────────────┬────────────────────┘
                         │                   │
                         ▼                   ▼
              ┌──────────────────┐  ┌──────────────────┐
              │   DynamoDB       │  │   S3 Bucket      │
              │ ProductsTable    │  │ product-images   │
              └──────────────────┘  └──────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 with Vite for fast builds
- TailwindCSS for utility-first styling
- React Router v6 for client-side routing
- Zustand for lightweight state management
- Axios for HTTP requests
- react-masonry-css for Pinterest-style layouts
- react-lazy-load-image-component for image optimization

**Backend:**
- Node.js 18.x runtime for Lambda functions
- AWS API Gateway for REST endpoints
- DynamoDB for NoSQL data storage
- S3 for image storage with presigned URLs
- CloudWatch for logging and monitoring

**Infrastructure:**
- AWS CDK (TypeScript) for infrastructure provisioning
- AWS Amplify for frontend hosting and CI/CD
- CloudFront CDN for global content delivery
- IAM for security and access control

**Development Tools:**
- TypeScript for type safety
- ESLint and Prettier for code quality
- Jest for unit testing
- React Testing Library for component testing
- fast-check for property-based testing

## Components and Interfaces

### Frontend Components

#### Public Site Components

**Header Component**
- Renders site logo and navigation
- Responsive hamburger menu for mobile
- Links to home, categories, and social media
- Props: `{ logo: string, navItems: NavItem[] }`

**Footer Component**
- Displays affiliate disclosure
- Social media links
- Copyright information
- Props: `{ disclosure: string, socialLinks: SocialLink[] }`

**ProductCard Component**
- Displays product thumbnail, title, description
- "Shop Now" button with affiliate link
- Hover effects and animations
- Props: `{ product: Product, onClick?: () => void }`

**ProductGrid Component**
- Masonry layout container for product cards
- Responsive column configuration (1/2/3 columns)
- Lazy loading integration
- Props: `{ products: Product[], columns: number }`

**CategoryCard Component**
- Displays category image and name
- Click handler for navigation
- Props: `{ category: Category, onClick: () => void }`

**LazyImage Component**
- Wrapper for lazy-loaded images
- Placeholder while loading
- Error fallback
- Props: `{ src: string, alt: string, className?: string }`

**ShareButton Component**
- Pinterest share functionality
- Opens Pinterest pin creator with product details
- Props: `{ product: Product }`

**ProductModal Component**
- Full product details overlay
- Large image display
- Close button and backdrop
- Props: `{ product: Product, isOpen: boolean, onClose: () => void }`

#### Admin Components

**AdminSidebar Component**
- Navigation menu for admin sections
- Active route highlighting
- Props: `{ currentRoute: string }`

**ProductTable Component**
- Tabular display of all products
- Sortable columns
- Action buttons (edit, delete)
- Props: `{ products: Product[], onEdit: (id) => void, onDelete: (id) => void }`

**ProductForm Component**
- Form for creating/editing products
- Field validation
- Image upload integration
- Props: `{ product?: Product, onSubmit: (data) => void, onCancel: () => void }`

**ImageUploader Component**
- Drag-and-drop file upload
- Preview before upload
- Progress indicator
- Props: `{ onUpload: (file: File) => Promise<string> }`

**Modal Component**
- Reusable modal wrapper
- Backdrop click to close
- Props: `{ isOpen: boolean, onClose: () => void, children: ReactNode }`

**ConfirmDialog Component**
- Confirmation prompt for destructive actions
- Props: `{ message: string, onConfirm: () => void, onCancel: () => void }`

### Backend API Interfaces

#### Public Endpoints

**GET /api/products**
- Query parameters: `category?: string, limit?: number, offset?: number`
- Response: `{ products: Product[], total: number, hasMore: boolean }`
- Returns published products only

**GET /api/products/:id**
- Path parameter: `id` (UUID)
- Response: `{ product: Product }`
- Returns 404 if not found or not published

**GET /api/categories**
- Response: `{ categories: Category[] }`
- Returns all categories with product counts

#### Admin Endpoints

**POST /api/admin/products**
- Request body: `{ title, description, category, imageUrl, amazonLink, price?, tags?, published }`
- Response: `{ product: Product }`
- Creates new product with generated UUID and timestamps

**PUT /api/admin/products/:id**
- Path parameter: `id` (UUID)
- Request body: Partial product fields
- Response: `{ product: Product }`
- Updates existing product and updatedAt timestamp

**DELETE /api/admin/products/:id**
- Path parameter: `id` (UUID)
- Response: `{ success: boolean }`
- Soft delete or hard delete based on configuration

**POST /api/admin/upload-image**
- Request body: `{ fileName: string, fileType: string }`
- Response: `{ uploadUrl: string, imageUrl: string }`
- Returns presigned S3 URL for direct upload

### State Management

**Product Store (Zustand)**
```typescript
interface ProductStore {
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  fetchProducts: (category?: string) => Promise<void>;
  fetchProduct: (id: string) => Promise<Product>;
  fetchCategories: () => Promise<void>;
}
```

**Admin Store (Zustand)**
```typescript
interface AdminStore {
  products: Product[];
  selectedProduct: Product | null;
  loading: boolean;
  error: string | null;
  fetchAllProducts: () => Promise<void>;
  createProduct: (data: ProductInput) => Promise<Product>;
  updateProduct: (id: string, data: Partial<ProductInput>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
}
```

## Data Models

### Product Model

```typescript
interface Product {
  id: string;                    // UUID v4
  title: string;                 // Max 200 characters
  description: string;           // Max 2000 characters
  category: string;              // Category slug
  imageUrl: string;              // S3 URL
  amazonLink: string;            // Full Amazon affiliate URL
  price?: string;                // Optional display price (e.g., "$29.99")
  tags?: string[];               // Optional tags for filtering
  published: boolean;            // Visibility flag
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

**DynamoDB Schema:**
- Partition Key: `id` (String)
- GSI: `category-createdAt-index` for category queries
- GSI: `published-createdAt-index` for public product listing

### Category Model

```typescript
interface Category {
  id: string;                    // UUID v4
  name: string;                  // Display name (e.g., "Home & Kitchen")
  slug: string;                  // URL-friendly (e.g., "home-kitchen")
  imageUrl?: string;             // Optional category image
  description?: string;          // Optional category description
  order: number;                 // Display order
}
```

**DynamoDB Schema:**
- Partition Key: `id` (String)
- GSI: `order-index` for ordered retrieval

### Image Upload Model

```typescript
interface ImageUpload {
  fileName: string;              // Original file name
  fileType: string;              // MIME type
  uploadUrl: string;             // Presigned S3 URL for PUT
  imageUrl: string;              // Public URL after upload
  expiresAt: number;             // Presigned URL expiration timestamp
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Category navigation completeness
*For any* set of categories in the system, the home page navigation SHALL include links to all categories.
**Validates: Requirements 1.3**

### Property 2: Image lazy loading
*For any* product card or image component rendered, the image SHALL have lazy loading enabled.
**Validates: Requirements 1.4, 15.3**

### Property 3: Category display completeness
*For any* set of categories retrieved from DynamoDB, the categories page SHALL display all categories.
**Validates: Requirements 2.1**

### Property 4: Category card completeness
*For any* category, the rendered category card SHALL contain both the category name and image.
**Validates: Requirements 2.2**

### Property 5: Category navigation correctness
*For any* category, clicking the category card SHALL navigate to the correct category product listing URL.
**Validates: Requirements 2.3**

### Property 6: Published product filtering
*For any* category and set of products, the category page SHALL display only products where published is true and category matches.
**Validates: Requirements 3.1**

### Property 7: Product card field completeness
*For any* product, the rendered product card SHALL contain image, title, description, and affiliate link button.
**Validates: Requirements 3.2, 4.2**

### Property 8: Conditional price display
*For any* product with a price field, the product card SHALL display the price; for products without a price field, no price SHALL be displayed.
**Validates: Requirements 3.3**

### Property 9: Affiliate link correctness
*For any* product, clicking the affiliate button SHALL use the exact amazonLink URL from the product data.
**Validates: Requirements 3.4**

### Property 10: Product detail view completeness
*For any* product in detail view, the rendered output SHALL contain large image, full description, Amazon affiliate button, and Pinterest share button.
**Validates: Requirements 4.2, 4.3**

### Property 11: SEO metadata completeness
*For any* product page, the document head SHALL contain meta title, meta description, and OpenGraph image tags.
**Validates: Requirements 4.4, 12.1, 12.2**

### Property 12: Pinterest share data correctness
*For any* product, the Pinterest share button SHALL generate a URL containing the product's image URL and description.
**Validates: Requirements 4.5**

### Property 13: Footer presence
*For any* public page, the rendered output SHALL contain a footer with affiliate disclosure text and social media links.
**Validates: Requirements 5.1, 5.2**

### Property 14: Admin product list completeness
*For any* set of products in DynamoDB, the admin dashboard SHALL display all products in the table.
**Validates: Requirements 6.1**

### Property 15: Admin table column completeness
*For any* product in the admin table, the row SHALL display title, category, published status, and action buttons.
**Validates: Requirements 6.2, 6.5**

### Property 16: Admin category filter correctness
*For any* category filter selection and product set, the filtered table SHALL display only products matching the selected category.
**Validates: Requirements 6.4**

### Property 17: Image upload round-trip
*For any* valid image file uploaded through the admin interface, the upload SHALL return an S3 URL that is publicly accessible.
**Validates: Requirements 7.3**

### Property 18: Product creation persistence
*For any* valid product data submitted through the creation form, a new product record SHALL exist in DynamoDB with matching field values.
**Validates: Requirements 7.4**

### Property 19: Product creation success flow
*For any* successful product creation, the platform SHALL redirect to the admin dashboard and display a success message.
**Validates: Requirements 7.5**

### Property 20: Edit form pre-population
*For any* product selected for editing, the edit form SHALL be pre-filled with all current field values from that product.
**Validates: Requirements 8.1**

### Property 21: Product update persistence
*For any* product and valid field modifications, submitting the edit form SHALL update the DynamoDB record with the new values and update the updatedAt timestamp.
**Validates: Requirements 8.2**

### Property 22: Image replacement correctness
*For any* product being edited, uploading a new image SHALL replace the imageUrl field with the new S3 URL.
**Validates: Requirements 8.4**

### Property 23: Delete confirmation requirement
*For any* product, clicking the delete button SHALL display a confirmation modal before any data modification occurs.
**Validates: Requirements 9.1**

### Property 24: Product deletion persistence
*For any* product, confirming deletion SHALL remove the product record from DynamoDB.
**Validates: Requirements 9.2**

### Property 25: Delete cancellation invariant
*For any* product, canceling the deletion modal SHALL leave the product data unchanged in DynamoDB.
**Validates: Requirements 9.4**

### Property 26: Responsive image attributes
*For any* image rendered on any page, the image element SHALL include responsive sizing attributes appropriate for the viewport.
**Validates: Requirements 10.4**

### Property 27: Image alt text presence
*For any* image displayed on the platform, the image element SHALL include a descriptive alt attribute.
**Validates: Requirements 12.3**

### Property 28: URL slug generation
*For any* product title, the generated URL slug SHALL be URL-friendly (lowercase, hyphens instead of spaces, no special characters).
**Validates: Requirements 12.4**

### Property 29: Structured data presence
*For any* product page, the document SHALL include valid JSON-LD structured data with product schema markup.
**Validates: Requirements 12.5**

### Property 30: API response caching
*For any* API request, subsequent identical requests within the cache timeout SHALL return cached data without making a new API call.
**Validates: Requirements 15.2**

## Error Handling

### Frontend Error Handling

**Network Errors:**
- All API calls wrapped in try-catch blocks
- Display user-friendly error messages in toast notifications
- Retry logic for transient failures (3 attempts with exponential backoff)
- Fallback to cached data when available

**Image Loading Errors:**
- Placeholder image displayed on load failure
- Alt text always present for accessibility
- Lazy loading errors logged but don't break page rendering

**Form Validation Errors:**
- Client-side validation before submission
- Field-level error messages
- Prevent submission until all required fields are valid
- Server-side validation errors displayed inline

**404 Errors:**
- Custom 404 page for missing products/categories
- Suggestions for similar products
- Link back to home page

**Admin Authentication Errors:**
- Redirect to login on 401/403 responses
- Session timeout warnings
- Automatic token refresh when possible

### Backend Error Handling

**Lambda Function Errors:**
- All functions wrapped in try-catch with structured logging
- Return appropriate HTTP status codes (400, 404, 500)
- Error responses include error code and user-friendly message
- Sensitive error details logged to CloudWatch only

**DynamoDB Errors:**
- Handle ProvisionedThroughputExceededException with retry
- Handle ConditionalCheckFailedException for concurrent updates
- Validate data before write operations
- Log all database errors with request context

**S3 Upload Errors:**
- Validate file type and size before generating presigned URL
- Handle upload failures with clear error messages
- Set appropriate CORS headers
- Implement upload timeout (5 minutes)

**API Gateway Errors:**
- Request validation at API Gateway level
- Rate limiting to prevent abuse (1000 requests per minute per IP)
- CORS configuration for frontend domain
- Request/response logging for debugging

**Input Validation:**
- Validate all input parameters against schema
- Sanitize user input to prevent injection attacks
- Enforce maximum lengths for text fields
- Validate URLs and file types

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // User-friendly error message
    details?: any;          // Optional additional context
    timestamp: string;      // ISO 8601 timestamp
    requestId: string;      // For support/debugging
  }
}
```

### Logging Strategy

**Frontend Logging:**
- Console errors in development
- Structured logging to CloudWatch in production
- User actions logged for analytics
- Performance metrics tracked

**Backend Logging:**
- All Lambda invocations logged with request/response
- Error stack traces in CloudWatch
- DynamoDB operation metrics
- API Gateway access logs

## Testing Strategy

### Unit Testing

**Frontend Unit Tests:**
- Component rendering tests for all UI components
- State management tests for Zustand stores
- Utility function tests (slug generation, URL validation)
- Form validation logic tests
- Mock API responses for isolated testing

**Backend Unit Tests:**
- Lambda handler tests with mocked AWS SDK calls
- Input validation tests
- Business logic tests (filtering, sorting)
- Error handling tests
- DynamoDB query construction tests

**Test Coverage Goals:**
- Minimum 80% code coverage
- 100% coverage for critical paths (product CRUD, image upload)
- All error handling paths tested

### Property-Based Testing

The platform will use **fast-check** (JavaScript/TypeScript property-based testing library) to verify universal properties across all inputs.

**Property Test Configuration:**
- Minimum 100 iterations per property test
- Each property test tagged with format: `**Feature: pinterest-affiliate-platform, Property {number}: {property_text}**`
- Generators for Product, Category, and other domain models
- Edge case generators (empty strings, special characters, large datasets)

**Key Property Tests:**
1. Product filtering always returns subset of input
2. Category navigation generates valid URLs
3. Slug generation always produces URL-safe strings
4. Image upload returns accessible URLs
5. CRUD operations maintain data integrity
6. Form validation rejects invalid inputs
7. Caching returns equivalent data to fresh requests

**Property Test Generators:**
```typescript
// Example generator for Product
const productArbitrary = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  description: fc.string({ minLength: 1, maxLength: 2000 }),
  category: fc.constantFrom('home', 'fashion', 'beauty', 'tech'),
  imageUrl: fc.webUrl(),
  amazonLink: fc.webUrl({ validSchemes: ['https'] }),
  price: fc.option(fc.string()),
  tags: fc.option(fc.array(fc.string())),
  published: fc.boolean(),
  createdAt: fc.date().map(d => d.toISOString()),
  updatedAt: fc.date().map(d => d.toISOString())
});
```

### Integration Testing

**API Integration Tests:**
- End-to-end tests for all API endpoints
- Test with real DynamoDB Local instance
- Test S3 upload flow with LocalStack
- Verify API Gateway routing
- Test authentication/authorization flows

**Frontend Integration Tests:**
- User flow tests (browse → view product → click affiliate link)
- Admin flow tests (login → create product → verify display)
- Form submission tests with API mocking
- Navigation tests across all routes

### End-to-End Testing

**Critical User Journeys:**
1. Visitor browses categories and views product
2. Visitor clicks affiliate link to Amazon
3. Admin creates new product with image upload
4. Admin edits existing product
5. Admin deletes product with confirmation

**E2E Test Tools:**
- Playwright or Cypress for browser automation
- Test against deployed preview environments
- Mobile device emulation for responsive tests
- Lighthouse CI for performance regression testing

### Performance Testing

**Load Testing:**
- Simulate Pinterest traffic spikes (1000+ concurrent users)
- Test Lambda cold start performance
- Verify DynamoDB auto-scaling
- Monitor CloudFront cache hit rates

**Performance Benchmarks:**
- API response time < 100ms (p95)
- Page load time < 1s (p95)
- Image load time < 500ms (p95)
- Lighthouse performance score > 90

### Accessibility Testing

**Automated Accessibility Tests:**
- axe-core integration in component tests
- WCAG AA compliance verification
- Keyboard navigation tests
- Screen reader compatibility tests

**Manual Accessibility Review:**
- Color contrast verification
- Focus indicator visibility
- Alt text quality review
- Form label associations

## Security Considerations

### Authentication & Authorization

**Admin Access:**
- Optional: AWS Amplify Auth for admin users
- Alternative: Simple password protection via environment variable
- Session management with secure cookies
- CSRF protection for admin forms

**API Security:**
- API Gateway request validation
- Rate limiting per IP address
- CORS restricted to frontend domain
- No sensitive data in URLs or logs

### Data Security

**DynamoDB:**
- Encryption at rest enabled
- Encryption in transit (TLS)
- IAM roles with least privilege
- No direct public access

**S3:**
- Public read access for product images only
- Presigned URLs for uploads (5-minute expiration)
- Bucket policies restrict write access to Lambda
- Versioning enabled for image recovery

**Secrets Management:**
- Environment variables for configuration
- AWS Secrets Manager for sensitive credentials
- No hardcoded secrets in code
- Rotate credentials regularly

### Input Validation

**Frontend Validation:**
- Client-side validation for UX
- Sanitize all user input
- Validate file types and sizes before upload
- Prevent XSS through React's built-in escaping

**Backend Validation:**
- Server-side validation for all inputs
- Schema validation with JSON Schema
- Sanitize data before DynamoDB writes
- Validate URLs before storing

### Content Security

**Affiliate Links:**
- Validate Amazon URLs before storing
- Ensure affiliate tags are present
- Prevent link manipulation
- Monitor for broken links

**Image Content:**
- File type validation (JPEG, PNG, WebP only)
- File size limits (5MB max)
- Image dimension validation
- Malware scanning (optional with AWS Macie)

## Deployment Strategy

### Infrastructure Deployment

**CDK Deployment Process:**
1. Synthesize CloudFormation templates from CDK code
2. Deploy to development environment first
3. Run smoke tests against dev environment
4. Deploy to production with approval gate
5. Monitor CloudWatch metrics post-deployment

**CDK Stacks:**
- `BackendStack`: DynamoDB, Lambda, API Gateway, IAM roles
- `StorageStack`: S3 bucket with policies
- `FrontendStack`: Amplify app configuration

**Environment Configuration:**
- Separate AWS accounts for dev/prod (recommended)
- Environment-specific parameter stores
- Tagged resources for cost tracking

### Frontend Deployment

**Amplify Deployment Process:**
1. GitHub webhook triggers build on push
2. Install dependencies (`npm ci`)
3. Run linting and tests
4. Build production bundle (`npm run build`)
5. Deploy to CloudFront
6. Invalidate CDN cache
7. Run post-deployment smoke tests

**Branch Strategy:**
- `main` → production deployment
- `develop` → staging deployment
- Feature branches → preview deployments
- Pull requests trigger preview builds

**Environment Variables:**
- `VITE_API_BASE_URL`: API Gateway endpoint
- `VITE_ADMIN_PASSWORD`: Optional admin password
- `VITE_PINTEREST_APP_ID`: Pinterest API credentials
- `VITE_GA_TRACKING_ID`: Google Analytics ID

### Rollback Strategy

**Frontend Rollback:**
- Amplify maintains deployment history
- One-click rollback to previous version
- Automatic rollback on build failure

**Backend Rollback:**
- CloudFormation stack rollback on failure
- Lambda version aliases for traffic shifting
- DynamoDB point-in-time recovery (35 days)

### Monitoring & Alerting

**CloudWatch Metrics:**
- Lambda invocation count, duration, errors
- API Gateway 4xx/5xx error rates
- DynamoDB read/write capacity utilization
- S3 bucket size and request metrics

**CloudWatch Alarms:**
- Lambda error rate > 1%
- API Gateway 5xx rate > 0.5%
- DynamoDB throttling events
- Amplify build failures

**Logging:**
- Structured JSON logs from Lambda
- API Gateway access logs
- CloudFront access logs
- Frontend error tracking (optional: Sentry)

### Cost Optimization

**Estimated Monthly Costs (1000 visitors/day):**
- Amplify Hosting: $0 (free tier)
- Lambda: ~$5 (1M requests)
- DynamoDB: ~$2 (on-demand pricing)
- S3: ~$1 (10GB storage)
- CloudFront: ~$5 (50GB transfer)
- **Total: ~$13/month**

**Cost Optimization Strategies:**
- Use DynamoDB on-demand for unpredictable traffic
- Enable CloudFront caching (24-hour TTL for images)
- Compress images before upload
- Use Lambda reserved concurrency only if needed
- Monitor and delete unused resources

## Future Enhancements

### Phase 2 Features

**Enhanced Admin:**
- Full authentication with AWS Amplify Auth
- Multi-user support with roles (admin, editor)
- Bulk product import from CSV
- Product analytics dashboard

**Amazon Integration:**
- Amazon Product Advertising API integration
- Automatic price updates
- Product availability checking
- Review score display

**Pinterest Integration:**
- Auto-generate Pinterest-optimized images
- Pinterest API integration for auto-pinning
- Pinterest analytics tracking
- Rich pins support

**User Features:**
- Saved favorites lists (requires user accounts)
- Email notifications for new products
- Product search functionality
- Product recommendations

### Phase 3 Features

**Advanced Marketing:**
- Newsletter signup with AWS SES
- Email campaigns for new products
- A/B testing framework
- Conversion tracking

**Internationalization:**
- Multi-language support
- Currency conversion
- Region-specific Amazon affiliate links
- Localized content

**Performance:**
- Server-side rendering with Next.js
- Progressive Web App (PWA) features
- Offline support
- Push notifications

## Appendix

### Technology Decisions

**Why React + Vite?**
- Fast development experience
- Smaller bundle sizes than Create React App
- Modern build tooling
- Easy migration to Next.js if SSR needed later

**Why DynamoDB?**
- Serverless and fully managed
- Predictable performance at scale
- Cost-effective for read-heavy workloads
- No server maintenance

**Why AWS CDK?**
- Type-safe infrastructure code
- Reusable constructs
- Better than raw CloudFormation
- Good IDE support

**Why Zustand over Redux?**
- Simpler API and less boilerplate
- Smaller bundle size
- Sufficient for this application's complexity
- Easy to test

### API Examples

**Create Product Request:**
```json
POST /api/admin/products
{
  "title": "Wireless Bluetooth Headphones",
  "description": "Premium noise-canceling headphones with 30-hour battery life",
  "category": "tech",
  "imageUrl": "https://product-images.s3.amazonaws.com/headphones.jpg",
  "amazonLink": "https://amazon.com/dp/B08XYZ?tag=affiliate-20",
  "price": "$79.99",
  "tags": ["audio", "wireless", "tech"],
  "published": true
}
```

**Get Products Response:**
```json
GET /api/products?category=tech&limit=20
{
  "products": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Wireless Bluetooth Headphones",
      "description": "Premium noise-canceling headphones...",
      "category": "tech",
      "imageUrl": "https://product-images.s3.amazonaws.com/headphones.jpg",
      "amazonLink": "https://amazon.com/dp/B08XYZ?tag=affiliate-20",
      "price": "$79.99",
      "tags": ["audio", "wireless", "tech"],
      "published": true,
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 45,
  "hasMore": true
}
```

### File Structure

```
pinterest-affiliate-platform/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── public/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   ├── ProductGrid.tsx
│   │   │   │   ├── CategoryCard.tsx
│   │   │   │   ├── LazyImage.tsx
│   │   │   │   ├── ShareButton.tsx
│   │   │   │   └── ProductModal.tsx
│   │   │   ├── admin/
│   │   │   │   ├── AdminSidebar.tsx
│   │   │   │   ├── ProductTable.tsx
│   │   │   │   ├── ProductForm.tsx
│   │   │   │   ├── ImageUploader.tsx
│   │   │   │   └── ConfirmDialog.tsx
│   │   │   └── common/
│   │   │       └── Modal.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Categories.tsx
│   │   │   ├── CategoryProducts.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminProductList.tsx
│   │   │   ├── AdminProductNew.tsx
│   │   │   └── AdminProductEdit.tsx
│   │   ├── stores/
│   │   │   ├── productStore.ts
│   │   │   └── adminStore.ts
│   │   ├── utils/
│   │   │   ├── api.ts
│   │   │   ├── slugify.ts
│   │   │   └── validation.ts
│   │   ├── hooks/
│   │   │   ├── useProducts.ts
│   │   │   └── useCategories.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── package.json
│   └── tsconfig.json
├── backend/
│   ├── functions/
│   │   ├── getProducts/
│   │   │   ├── index.ts
│   │   │   └── package.json
│   │   ├── getProduct/
│   │   │   ├── index.ts
│   │   │   └── package.json
│   │   ├── createProduct/
│   │   │   ├── index.ts
│   │   │   └── package.json
│   │   ├── updateProduct/
│   │   │   ├── index.ts
│   │   │   └── package.json
│   │   ├── deleteProduct/
│   │   │   ├── index.ts
│   │   │   └── package.json
│   │   └── uploadImage/
│   │       ├── index.ts
│   │       └── package.json
│   ├── shared/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   └── responses.ts
│   └── package.json
├── infrastructure/
│   ├── bin/
│   │   └── app.ts
│   ├── lib/
│   │   ├── backend-stack.ts
│   │   ├── storage-stack.ts
│   │   └── frontend-stack.ts
│   ├── cdk.json
│   ├── package.json
│   └── tsconfig.json
├── .github/
│   └── workflows/
│       └── deploy.yml
├── README.md
└── package.json
```
