# Implementation Plan

- [x] 1. Set up project structure and infrastructure foundation
- [x] 1.1 Initialize monorepo structure with frontend, backend, and infrastructure directories
  - Create root package.json with workspace configuration
  - Set up TypeScript configurations for each workspace
  - Configure ESLint and Prettier for code quality
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 1.2 Create AWS CDK infrastructure stack for DynamoDB and S3
  - Define ProductsTable with partition key and GSIs
  - Create S3 bucket for product images with public read access
  - Configure IAM roles for Lambda access to DynamoDB and S3
  - _Requirements: 13.1, 13.2, 13.5_

- [x] 1.3 Create AWS CDK stack for Lambda functions and API Gateway
  - Define Lambda functions for all CRUD operations
  - Create API Gateway REST API with route mappings
  - Configure CORS for frontend domain
  - Set up CloudWatch logging
  - _Requirements: 13.3, 13.4, 13.5_

- [ ]* 1.4 Write CDK deployment tests
  - Test stack synthesis
  - Verify resource creation
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 2. Implement backend Lambda functions and data layer
- [x] 2.1 Create shared types and validation utilities
  - Define Product and Category TypeScript interfaces
  - Implement input validation schemas
  - Create error response utilities
  - _Requirements: 7.4, 8.2_

- [x] 2.2 Implement getProducts Lambda function
  - Query DynamoDB with category filtering
  - Implement pagination logic
  - Filter for published products only
  - Return formatted response
  - _Requirements: 3.1, 6.4_

- [ ]* 2.3 Write property test for product filtering
  - **Property 6: Published product filtering**
  - **Validates: Requirements 3.1**

- [x] 2.4 Implement getProduct Lambda function
  - Query DynamoDB by product ID
  - Return 404 for unpublished or missing products
  - _Requirements: 4.1_

- [x] 2.5 Implement createProduct Lambda function
  - Validate input data
  - Generate UUID and timestamps
  - Write to DynamoDB
  - Return created product
  - _Requirements: 7.4_

- [ ]* 2.6 Write property test for product creation
  - **Property 18: Product creation persistence**
  - **Validates: Requirements 7.4**

- [x] 2.7 Implement updateProduct Lambda function
  - Validate product exists
  - Validate input data
  - Update DynamoDB record with new updatedAt timestamp
  - Return updated product
  - _Requirements: 8.2_

- [ ]* 2.8 Write property test for product updates
  - **Property 21: Product update persistence**
  - **Validates: Requirements 8.2**

- [x] 2.9 Implement deleteProduct Lambda function
  - Validate product exists
  - Delete from DynamoDB
  - Return success response
  - _Requirements: 9.2_

- [ ]* 2.10 Write property test for product deletion
  - **Property 24: Product deletion persistence**
  - **Validates: Requirements 9.2**

- [x] 2.11 Implement uploadImage Lambda function
  - Validate file type and size
  - Generate presigned S3 URL with 5-minute expiration
  - Return upload URL and final image URL
  - _Requirements: 7.3_

- [ ]* 2.12 Write property test for image upload
  - **Property 17: Image upload round-trip**
  - **Validates: Requirements 7.3**

- [ ]* 2.13 Write unit tests for Lambda error handling
  - Test invalid input handling
  - Test DynamoDB error scenarios
  - Test S3 error scenarios
  - _Requirements: 7.4, 8.2, 9.2_

- [x] 3. Initialize frontend React application with routing
- [x] 3.1 Create Vite + React + TypeScript project
  - Initialize Vite project in frontend directory
  - Install React Router, TailwindCSS, Zustand, Axios
  - Configure Tailwind with custom theme
  - Set up path aliases in vite.config.ts
  - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1_

- [x] 3.2 Define TypeScript types and API client
  - Create Product and Category interfaces matching backend
  - Implement Axios API client with base URL configuration
  - Create API methods for all endpoints
  - _Requirements: 3.1, 4.1, 6.1, 7.4, 8.2, 9.2_

- [x] 3.3 Set up React Router with all routes
  - Configure routes for home, categories, category products, product detail
  - Configure admin routes for dashboard, product list, new, edit
  - Implement 404 page
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 6.1_

- [x] 3.4 Create Zustand stores for state management
  - Implement productStore with fetch methods and caching
  - Implement adminStore with CRUD methods
  - Add loading and error state handling
  - _Requirements: 3.1, 6.1, 7.4, 8.2, 9.2_

- [ ]* 3.5 Write property test for API caching
  - **Property 30: API response caching**
  - **Validates: Requirements 15.2**

- [x] 4. Build public site core components
- [x] 4.1 Create Header component
  - Implement responsive navigation with logo
  - Add mobile hamburger menu
  - Include links to home and categories
  - _Requirements: 1.1, 1.3_

- [x] 4.2 Create Footer component with affiliate disclosure
  - Display required Amazon affiliate disclosure text
  - Add social media links
  - Ensure mobile responsiveness
  - _Requirements: 5.1, 5.2_

- [ ]* 4.3 Write property test for footer presence
  - **Property 13: Footer presence**
  - **Validates: Requirements 5.1, 5.2**

- [x] 4.4 Create LazyImage component
  - Implement lazy loading with react-lazy-load-image-component
  - Add placeholder while loading
  - Include error fallback image
  - Ensure alt text is always present
  - _Requirements: 1.4, 12.3, 15.3_

- [ ]* 4.5 Write property test for image lazy loading
  - **Property 2: Image lazy loading**
  - **Validates: Requirements 1.4, 15.3**

- [ ]* 4.6 Write property test for alt text presence
  - **Property 27: Image alt text presence**
  - **Validates: Requirements 12.3**

- [x] 4.7 Create ProductCard component
  - Display product image using LazyImage
  - Show title, description, and optional price
  - Add "Shop Now" button with affiliate link
  - Implement hover effects
  - _Requirements: 3.2, 3.3, 3.4_

- [ ]* 4.8 Write property test for product card completeness
  - **Property 7: Product card field completeness**
  - **Validates: Requirements 3.2**

- [ ]* 4.9 Write property test for conditional price display
  - **Property 8: Conditional price display**
  - **Validates: Requirements 3.3**

- [ ]* 4.10 Write property test for affiliate link correctness
  - **Property 9: Affiliate link correctness**
  - **Validates: Requirements 3.4**

- [x] 4.11 Create ProductGrid component with masonry layout
  - Integrate react-masonry-css
  - Configure responsive columns (3/2/1 for desktop/tablet/mobile)
  - Map products to ProductCard components
  - _Requirements: 3.1, 10.1, 10.2, 10.3_

- [x] 4.12 Create CategoryCard component
  - Display category image and name
  - Implement click handler for navigation
  - Add hover effects
  - _Requirements: 2.2, 2.3_

- [ ]* 4.13 Write property test for category card completeness
  - **Property 4: Category card completeness**
  - **Validates: Requirements 2.2**

- [x] 5. Implement public site pages
- [x] 5.1 Create Home page
  - Implement hero section with branding
  - Display featured products grid
  - Add navigation to categories
  - Fetch products from API on mount
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]* 5.2 Write property test for category navigation completeness
  - **Property 1: Category navigation completeness**
  - **Validates: Requirements 1.3**

- [x] 5.3 Create Categories page
  - Fetch all categories from API
  - Display categories using CategoryCard
  - Handle loading and error states
  - _Requirements: 2.1, 2.2, 2.4_

- [ ]* 5.4 Write property test for category display completeness
  - **Property 3: Category display completeness**
  - **Validates: Requirements 2.1**

- [ ]* 5.5 Write property test for category navigation
  - **Property 5: Category navigation correctness**
  - **Validates: Requirements 2.3**

- [x] 5.6 Create CategoryProducts page
  - Extract category slug from URL params
  - Fetch products filtered by category
  - Display products in ProductGrid
  - Implement pagination or infinite scroll for >20 products
  - _Requirements: 3.1, 3.2, 3.5_

- [x] 5.7 Create ProductModal component for product details
  - Display large product image
  - Show full description
  - Add Amazon affiliate button
  - Include Pinterest share button
  - Implement close on backdrop click
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 5.8 Write property test for product detail completeness
  - **Property 10: Product detail view completeness**
  - **Validates: Requirements 4.2, 4.3**

- [x] 5.9 Create ShareButton component for Pinterest
  - Generate Pinterest share URL with product data
  - Open Pinterest in new window
  - Include product image and description
  - _Requirements: 4.5_

- [ ]* 5.10 Write property test for Pinterest share data
  - **Property 12: Pinterest share data correctness**
  - **Validates: Requirements 4.5**

- [x] 5.11 Implement SEO metadata for all pages
  - Create SEO utility for generating meta tags
  - Add unique title and description per page
  - Include OpenGraph tags for product pages
  - Generate JSON-LD structured data for products
  - _Requirements: 12.1, 12.2, 12.5_

- [ ]* 5.12 Write property test for SEO metadata
  - **Property 11: SEO metadata completeness**
  - **Validates: Requirements 4.4, 12.1, 12.2**

- [ ]* 5.13 Write property test for structured data
  - **Property 29: Structured data presence**
  - **Validates: Requirements 12.5**

- [x] 5.14 Create slug generation utility
  - Convert product titles to URL-friendly slugs
  - Handle special characters and spaces
  - Ensure lowercase output
  - _Requirements: 12.4_

- [ ]* 5.15 Write property test for slug generation
  - **Property 28: URL slug generation**
  - **Validates: Requirements 12.4**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Build admin dashboard components
- [x] 7.1 Create AdminSidebar component
  - Display navigation menu for admin sections
  - Highlight active route
  - Include links to dashboard and product management
  - _Requirements: 6.1_

- [x] 7.2 Create ProductTable component
  - Display products in tabular format
  - Show title, category, published status
  - Add edit and delete action buttons
  - Implement sortable columns
  - _Requirements: 6.1, 6.2, 6.5_

- [ ]* 7.3 Write property test for admin table completeness
  - **Property 15: Admin table column completeness**
  - **Validates: Requirements 6.2, 6.5**

- [x] 7.4 Create ImageUploader component
  - Implement drag-and-drop file upload
  - Show image preview before upload
  - Display upload progress
  - Call uploadImage API and return URL
  - _Requirements: 7.2, 7.3_

- [x] 7.5 Create ProductForm component
  - Include fields for all product properties
  - Integrate ImageUploader for image field
  - Implement client-side validation
  - Handle form submission
  - Support both create and edit modes
  - _Requirements: 7.2, 8.1_

- [ ]* 7.6 Write property test for edit form pre-population
  - **Property 20: Edit form pre-population**
  - **Validates: Requirements 8.1**

- [x] 7.7 Create ConfirmDialog component
  - Display confirmation message
  - Provide confirm and cancel buttons
  - Handle backdrop click to cancel
  - _Requirements: 9.1_

- [ ]* 7.8 Write property test for delete confirmation
  - **Property 23: Delete confirmation requirement**
  - **Validates: Requirements 9.1**

- [x] 7.9 Create Modal component
  - Reusable modal wrapper with backdrop
  - Handle ESC key to close
  - Prevent body scroll when open
  - _Requirements: 4.1, 9.1_

- [x] 8. Implement admin dashboard pages
- [x] 8.1 Create AdminDashboard page
  - Display welcome message and quick stats
  - Show recent products
  - Add navigation to product management
  - _Requirements: 6.1_

- [x] 8.2 Create AdminProductList page
  - Fetch all products from admin API
  - Display products in ProductTable
  - Implement category filter dropdown
  - Handle edit and delete button clicks
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 8.3 Write property test for admin product list completeness
  - **Property 14: Admin product list completeness**
  - **Validates: Requirements 6.1**

- [ ]* 8.4 Write property test for category filtering
  - **Property 16: Admin category filter correctness**
  - **Validates: Requirements 6.4**

- [x] 8.5 Create AdminProductNew page
  - Render ProductForm in create mode
  - Handle form submission to create product
  - Redirect to dashboard on success with message
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 8.6 Write property test for product creation flow
  - **Property 19: Product creation success flow**
  - **Validates: Requirements 7.5**

- [x] 8.7 Create AdminProductEdit page
  - Fetch product by ID from URL params
  - Render ProductForm in edit mode with pre-filled data
  - Handle form submission to update product
  - Support image replacement
  - Redirect to dashboard on success with message
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ]* 8.8 Write property test for image replacement
  - **Property 22: Image replacement correctness**
  - **Validates: Requirements 8.4**

- [x] 8.9 Implement delete product functionality
  - Show ConfirmDialog when delete button clicked
  - Call deleteProduct API on confirmation
  - Refresh product list on success
  - Handle cancellation without data changes
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ]* 8.10 Write property test for delete cancellation
  - **Property 25: Delete cancellation invariant**
  - **Validates: Requirements 9.4**

- [x] 9. Implement responsive design and accessibility
- [x] 9.1 Configure Tailwind breakpoints and responsive utilities
  - Set up mobile-first responsive classes
  - Configure custom breakpoints if needed
  - Test layouts at all breakpoints
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 9.2 Implement responsive image sizing
  - Add srcset and sizes attributes to images
  - Configure responsive image loading
  - Test image performance across devices
  - _Requirements: 10.4_

- [ ]* 9.3 Write property test for responsive image attributes
  - **Property 26: Responsive image attributes**
  - **Validates: Requirements 10.4**

- [x] 9.4 Add ARIA labels and semantic HTML
  - Ensure all interactive elements have labels
  - Use semantic HTML5 elements
  - Add skip navigation links
  - Test keyboard navigation
  - _Requirements: 15.5_

- [ ]* 9.5 Run accessibility audit with axe-core
  - Test all pages for WCAG AA compliance
  - Fix any accessibility violations
  - _Requirements: 15.5_

- [x] 10. Configure AWS Amplify hosting and CI/CD
- [x] 10.1 Create amplify.yml build configuration
  - Define build commands for Vite
  - Set output directory to dist/
  - Configure environment variable injection
  - _Requirements: 14.3, 14.5_

- [x] 10.2 Connect GitHub repository to Amplify
  - Set up Amplify app in AWS Console
  - Connect to GitHub repository
  - Configure branch deployments (main → production)
  - Enable preview deployments for feature branches
  - _Requirements: 14.1, 14.2_

- [x] 10.3 Configure Amplify environment variables
  - Set VITE_API_BASE_URL to API Gateway endpoint
  - Add optional VITE_ADMIN_PASSWORD
  - Configure Pinterest and analytics IDs
  - _Requirements: 14.5_

- [x] 10.4 Test Amplify build and deployment
  - Push code to trigger build
  - Verify build succeeds
  - Test deployed application
  - Verify environment variables are injected
  - _Requirements: 14.1, 14.3, 14.4_

- [x] 11. Implement error handling and logging
- [x] 11.1 Add error boundaries to React app
  - Create ErrorBoundary component
  - Wrap app and major sections
  - Display user-friendly error messages
  - Log errors to console in development

- [x] 11.2 Implement toast notifications for user feedback
  - Install toast library (react-hot-toast)
  - Add toast notifications for success/error states
  - Show toasts for CRUD operations
  - Display network error messages

- [x] 11.3 Add structured logging to Lambda functions
  - Implement consistent log format
  - Log all errors with stack traces
  - Log request/response for debugging
  - Configure CloudWatch log retention

- [x] 11.4 Implement retry logic for API calls
  - Add exponential backoff for failed requests
  - Retry transient errors (network, 5xx)
  - Limit retry attempts to 3
  - Show user feedback during retries

- [x] 12. Performance optimization
- [x] 12.1 Optimize images for web
  - Compress images before upload
  - Generate multiple sizes for responsive images
  - Use WebP format with fallbacks
  - _Requirements: 11.5, 15.1_

- [x] 12.2 Implement code splitting
  - Split admin routes into separate bundle
  - Lazy load ProductModal component
  - Analyze bundle size with vite-bundle-visualizer
  - _Requirements: 15.1_

- [x] 12.3 Configure CloudFront caching
  - Set cache TTL for images (24 hours)
  - Configure cache headers in S3
  - Set API Gateway caching for GET endpoints
  - _Requirements: 11.5_

- [x] 12.4 Add loading skeletons
  - Create skeleton components for product cards
  - Show skeletons during data fetching
  - Improve perceived performance

- [ ]* 12.5 Run Lighthouse audit
  - Test performance score (target >90)
  - Test accessibility score
  - Fix any issues identified
  - _Requirements: 15.1_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Create seed data and documentation
- [x] 14.1 Create seed script for sample products
  - Generate sample products for all categories
  - Upload sample images to S3
  - Insert products into DynamoDB
  - Create sample categories

- [x] 14.2 Write README with setup instructions
  - Document prerequisites (Node.js, AWS CLI, AWS account)
  - Provide step-by-step setup guide
  - Include deployment instructions
  - Document environment variables

- [x] 14.3 Create API documentation
  - Document all API endpoints
  - Include request/response examples
  - Document error codes
  - Add authentication details

- [x] 14.4 Write admin user guide
  - Document how to add products
  - Explain image upload process
  - Describe category management
  - Include troubleshooting tips
