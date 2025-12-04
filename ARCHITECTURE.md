# Pinterest Affiliate Platform - System Architecture

## Overview

The Pinterest Affiliate Platform is a modern, serverless web application built entirely on AWS services. It provides a Pinterest-inspired product showcase with automated Amazon price synchronization, admin management, and monetization through affiliate links and AdSense.

## Architecture Diagram

![Architecture Diagram](./architecture-diagram.png)

*To edit this diagram, open `architecture-diagram.drawio` in [Draw.io](https://app.diagrams.net/)*

## System Components

### Frontend Layer (AWS Amplify)

**React Single Page Application**
- **Technology**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Hosting**: AWS Amplify with automatic CI/CD
- **Domain**: koufobunch.com
- **CDN**: CloudFront distribution for global performance

**Key Features**:
- Public product catalog with Pinterest-style masonry layout
- Category filtering and product search
- Secure admin portal at `/kbportal`
- Responsive design with lazy-loaded images
- SEO optimization with meta tags

### API Layer (AWS API Gateway)

**REST API Gateway**
- **Type**: Regional REST API
- **Stage**: Production (`prod`)
- **Authentication**: AWS Cognito for admin endpoints
- **CORS**: Enabled for cross-origin requests
- **Caching**: Enabled for public endpoints (24-hour TTL)
- **Logging**: CloudWatch integration with full request/response logging

**Endpoints**:
- Public: `/api/products`, `/api/products/{id}`, `/api/categories`
- Admin: `/api/admin/products`, `/api/admin/users`, `/api/admin/sync-prices`

### Compute Layer (AWS Lambda)

**Product Management Functions**
- `getProducts` - Fetch all published products with optional category filter
- `getProduct` - Retrieve single product by ID
- `createProduct` - Create new product (admin only)
- `updateProduct` - Update existing product (admin only)
- `deleteProduct` - Delete product (admin only)
- `adminGetProducts` - Fetch all products including unpublished (admin only)
- `getCategories` - Get all product categories
- `uploadImage` - Generate S3 presigned URLs for image uploads

**User Management Functions**
- `createUser` - Create new admin user with email invitation
- `listUsers` - List all users in Cognito User Pool
- `deleteUser` - Remove user from system
- `resetPassword` - Send password reset email

**Price Sync Functions**
- `syncAmazonPrices` - Automated daily price sync with Amazon PA-API
- `triggerPriceSync` - Manual sync trigger for administrators
- `getSyncHistory` - Retrieve sync execution logs from CloudWatch

**Configuration**:
- Runtime: Node.js 18
- Memory: 512 MB (standard), 1024 MB (price sync)
- Timeout: 30 seconds (standard), 10 minutes (price sync)
- Logging: CloudWatch Logs with 1-week retention

### Data Layer

**DynamoDB - ProductsTable**
- **Partition Key**: `id` (String)
- **Billing**: On-demand (pay-per-request)
- **Encryption**: AWS managed keys
- **Backup**: Point-in-time recovery enabled
- **Global Secondary Indexes**:
  - `category-createdAt-index` - Query products by category
  - `published-createdAt-index` - Query published products

**S3 - Product Images Bucket**
- **Name**: `pinterest-affiliate-images-{account-id}`
- **Access**: Public read for product images
- **Versioning**: Enabled
- **Encryption**: S3 managed keys
- **Lifecycle**: Delete old versions after 30 days
- **CORS**: Configured for PUT/POST from frontend

**CloudFront - Image CDN**
- **Origin**: S3 images bucket
- **Cache Policy**: 24-hour default TTL, 1-year max TTL
- **Compression**: Gzip and Brotli enabled
- **Price Class**: North America and Europe only
- **HTTPS**: Required (redirect HTTP to HTTPS)

**AWS Cognito - User Pool**
- **Name**: PinterestAffiliateAdmins
- **Sign-in**: Email and username
- **Self-signup**: Disabled (admin-only creation)
- **Password Policy**: 8+ chars, uppercase, lowercase, digits
- **Groups**: Admins group with elevated permissions
- **Recovery**: Email-only account recovery

**AWS Systems Manager - Parameter Store**
- `/amazon-affiliate/pa-api/access-key` - PA-API access key
- `/amazon-affiliate/pa-api/secret-key` - PA-API secret key
- `/amazon-affiliate/pa-api/partner-tag` - Amazon Associates tag
- `/amazon-affiliate/pa-api/marketplace` - Amazon marketplace (default: US)

### External Integrations

**Amazon Product Advertising API (PA-API)**
- **Purpose**: Real-time price synchronization
- **Version**: PA-API 5.0
- **Marketplace**: Amazon.com (US)
- **Rate Limits**: 1 request/second, 8640 requests/day
- **Operations**: GetItems (batch product lookup)

**Amazon Associates Program**
- **Purpose**: Affiliate link tracking and commission
- **Tag**: Embedded in all product links
- **Tracking**: Click-through and conversion tracking

**Google AdSense**
- **Purpose**: Display advertising monetization
- **Placement**: Strategic ad units throughout site
- **Format**: Responsive display ads

**AWS SES (Simple Email Service)**
- **Purpose**: Transactional email delivery
- **Use Cases**: User invitations, password resets, alerts
- **Status**: Sandbox mode (production access requested)
- **Verified Emails**: Admin email addresses

### Monitoring & Operations

**CloudWatch Logs**
- Lambda function execution logs
- API Gateway access logs
- Price sync detailed execution logs
- Retention: 1 week for price sync, indefinite for others

**CloudWatch Metrics**
- Custom metrics for price sync operations:
  - `SuccessCount` - Successful price updates
  - `FailureCount` - Failed price updates
  - `SuccessRate` - Percentage of successful updates
  - `Duration` - Execution time in milliseconds
  - `TotalProducts` - Total products processed
  - `ProcessedCount` - Products with valid ASINs
  - `SkippedCount` - Products without ASINs

**CloudWatch Dashboard**
- **Name**: PinterestAffiliate-PriceSync
- **Widgets**:
  - Success vs Failure counts (line graph)
  - Success rate percentage (gauge)
  - Execution duration (average and max)
  - Products processed breakdown

**CloudWatch Alarms**
- **High Failure Rate**: Alert when >50% of updates fail
- **Authentication Errors**: Alert on PA-API auth failures
- **Long Execution**: Alert when sync exceeds 5 minutes
- **Action**: SNS notification to alert topic

**Amazon SNS - Alert Topic**
- **Name**: pinterest-affiliate-price-sync-alerts
- **Purpose**: Deliver alarm notifications
- **Subscribers**: Admin email addresses

**Amazon EventBridge**
- **Rule**: pinterest-affiliate-price-sync-daily
- **Schedule**: Daily at 2:00 AM UTC (cron: 0 2 * * ? *)
- **Target**: syncAmazonPrices Lambda function
- **Retry**: 2 attempts with exponential backoff

### Deployment & CI/CD

**GitHub Repository**
- Source code version control
- Branch protection on `main`
- Automatic deployment triggers

**AWS CDK (Infrastructure as Code)**
- **Language**: TypeScript
- **Stacks**:
  - `StorageStack` - DynamoDB, S3, CloudFront, Cognito
  - `BackendStack` - Lambda, API Gateway, EventBridge, CloudWatch
- **Deployment**: `cdk deploy --all`

**AWS Amplify**
- **Build**: Automatic on push to `main`
- **Build Spec**: `amplify.yml` in repository root
- **Environment Variables**: Configured in Amplify Console
- **Domain**: Custom domain with SSL certificate
- **Previews**: Branch-based preview deployments

## Data Flow

### User Product Browsing Flow

1. User visits koufobunch.com
2. CloudFront serves cached React application
3. React app loads and requests products from API Gateway
4. API Gateway routes to `getProducts` Lambda
5. Lambda queries DynamoDB `published-createdAt-index`
6. Products returned with CloudFront CDN image URLs
7. User clicks product → navigates to Amazon via affiliate link
8. Amazon Associates tracks click and potential purchase

### Admin Product Management Flow

1. Admin logs in via Cognito authentication
2. JWT token stored in browser session
3. Admin navigates to `/kbportal` admin portal
4. Admin creates/updates product via API Gateway
5. API Gateway validates JWT with Cognito
6. Lambda function updates DynamoDB
7. For images: Lambda generates S3 presigned URL
8. Frontend uploads image directly to S3
9. CloudFront CDN automatically serves new image

### Automated Price Sync Flow

1. EventBridge triggers at 2:00 AM UTC daily
2. `syncAmazonPrices` Lambda function invoked
3. Lambda queries all products from DynamoDB
4. For each product with ASIN:
   - Extract ASIN from Amazon URL
   - Call PA-API GetItems operation
   - Parse price from response
   - Update DynamoDB with new price
5. Lambda publishes custom metrics to CloudWatch
6. If failures exceed threshold, CloudWatch alarm triggers
7. SNS sends alert email to administrators
8. Execution logs stored in CloudWatch Logs

### Manual Price Sync Flow

1. Admin clicks "Sync Prices" in admin portal
2. Frontend calls `/api/admin/sync-prices` endpoint
3. API Gateway validates admin JWT token
4. `triggerPriceSync` Lambda invokes `syncAmazonPrices`
5. Sync executes asynchronously
6. Admin can view real-time progress in sync history
7. `getSyncHistory` Lambda queries CloudWatch Logs
8. Execution results displayed in admin dashboard

## Security Architecture

### Authentication & Authorization

**Public Endpoints**
- No authentication required
- Rate limiting via API Gateway throttling
- CORS restrictions to prevent unauthorized origins

**Admin Endpoints**
- AWS Cognito JWT token required
- Token validated by API Gateway authorizer
- Tokens expire after 1 hour
- Refresh tokens valid for 30 days

**User Management**
- Self-signup disabled
- Admin-only user creation
- Email verification required
- Strong password policy enforced

### Data Protection

**Encryption at Rest**
- DynamoDB: AWS managed encryption
- S3: Server-side encryption (SSE-S3)
- Parameter Store: Standard encryption

**Encryption in Transit**
- HTTPS enforced on all endpoints
- TLS 1.2+ required
- CloudFront HTTPS redirect enabled

**Access Control**
- IAM roles with least-privilege permissions
- Lambda execution role with specific resource access
- S3 bucket policies for public read, admin write
- Cognito groups for role-based access

### Secrets Management

- PA-API credentials in Parameter Store
- No hardcoded secrets in code
- Environment variables for configuration
- Cognito handles password hashing

### Monitoring & Compliance

- All API calls logged to CloudWatch
- Failed authentication attempts tracked
- Alarm notifications for security events
- Regular security updates via Amplify CI/CD

## Scalability & Performance

### Frontend Optimization

**Code Splitting**
- Lazy-loaded admin components
- Route-based code splitting
- Dynamic imports for heavy libraries

**Image Optimization**
- Responsive images with srcset
- Lazy loading with Intersection Observer
- WebP format support
- CloudFront CDN caching

**Bundle Optimization**
- Vite production build with tree-shaking
- Minified JavaScript and CSS
- Gzip compression enabled

### Backend Scalability

**Serverless Auto-Scaling**
- Lambda: Automatic concurrent execution scaling
- DynamoDB: On-demand capacity mode
- API Gateway: Built-in throttling and scaling

**Caching Strategy**
- API Gateway caching for public endpoints (24 hours)
- CloudFront CDN for images (24 hours default, 1 year max)
- Browser caching with Cache-Control headers

**Database Optimization**
- Global Secondary Indexes for efficient queries
- Projection type ALL for read performance
- Point-in-time recovery for data protection

### Performance Metrics

**Target Metrics**
- Page load time: < 2 seconds
- API response time: < 500ms
- Image load time: < 1 second (via CDN)
- Lambda cold start: < 1 second

**Monitoring**
- CloudWatch metrics for all services
- Custom metrics for business KPIs
- Real-time dashboards for operations

## Cost Optimization

### Serverless Benefits

- **Pay-per-use**: No idle server costs
- **Auto-scaling**: Resources scale with demand
- **Managed services**: Reduced operational overhead

### Cost Breakdown (Estimated Monthly)

**Free Tier Eligible**:
- Lambda: 1M requests/month free
- DynamoDB: 25 GB storage free
- CloudFront: 1 TB transfer free (first year)
- Cognito: 50,000 MAUs free

**Estimated Costs** (beyond free tier):
- Lambda: $0.20 per 1M requests
- DynamoDB: $1.25 per million writes
- S3: $0.023 per GB storage
- API Gateway: $3.50 per million requests
- Amplify: $0.01 per build minute

**Optimization Strategies**:
- DynamoDB on-demand for variable traffic
- S3 lifecycle policies for old versions
- CloudFront caching to reduce origin requests
- Lambda memory optimization for cost/performance

## Disaster Recovery

### Backup Strategy

**DynamoDB**
- Point-in-time recovery enabled
- Continuous backups for 35 days
- Manual snapshots for long-term retention

**S3**
- Versioning enabled for all objects
- Cross-region replication (optional)
- Lifecycle policies for version management

**Infrastructure**
- CDK code in version control
- Infrastructure as code for rapid rebuild
- Automated deployment pipelines

### Recovery Procedures

**Data Loss**
1. Restore DynamoDB from point-in-time backup
2. Restore S3 objects from versions
3. Redeploy infrastructure via CDK

**Service Outage**
1. Check AWS Service Health Dashboard
2. Review CloudWatch alarms and logs
3. Failover to backup region (if configured)
4. Communicate status to users

**RTO/RPO Targets**
- Recovery Time Objective (RTO): 4 hours
- Recovery Point Objective (RPO): 1 hour

## Future Enhancements

### Planned Features

**Phase 1: Enhanced Security**
- Multi-factor authentication (MFA)
- API rate limiting per user
- Advanced threat detection
- Security audit logging

**Phase 2: Advanced Analytics**
- User behavior tracking
- Conversion funnel analysis
- A/B testing framework
- Personalized recommendations

**Phase 3: Mobile Experience**
- Progressive Web App (PWA)
- React Native mobile app
- Push notifications
- Offline support

**Phase 4: Global Expansion**
- Multi-region deployment
- International Amazon marketplaces
- Multi-currency support
- Localization (i18n)

### Scalability Roadmap

**Database Sharding**
- Partition products by category
- Separate tables for high-traffic data
- Read replicas for analytics

**Microservices Architecture**
- Separate services for products, users, sync
- Event-driven communication
- Service mesh for observability

**Machine Learning**
- Product recommendation engine
- Price prediction models
- Automated categorization
- Image recognition for product matching

## Technical Specifications

### Frontend Stack

- **Framework**: React 18.2.0
- **Build Tool**: Vite 4.3.9
- **Language**: TypeScript 5.0.2
- **Styling**: Tailwind CSS 3.3.2
- **State**: Zustand 4.3.8
- **Routing**: React Router 6.11.2
- **HTTP**: Axios 1.4.0
- **Testing**: Vitest + React Testing Library

### Backend Stack

- **Runtime**: Node.js 18.x
- **Language**: TypeScript 5.0.2
- **AWS SDK**: AWS SDK v3
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Build**: TypeScript compiler (tsc)

### Infrastructure Stack

- **IaC**: AWS CDK 2.x
- **Language**: TypeScript
- **Deployment**: CloudFormation
- **Version Control**: Git + GitHub
- **CI/CD**: AWS Amplify

### AWS Services

- **Compute**: Lambda (Node.js 18)
- **API**: API Gateway (REST)
- **Database**: DynamoDB
- **Storage**: S3 + CloudFront
- **Auth**: Cognito User Pools
- **Monitoring**: CloudWatch
- **Notifications**: SNS
- **Scheduling**: EventBridge
- **Secrets**: Systems Manager Parameter Store
- **Email**: SES
- **Hosting**: Amplify

## Quick Reference

### Production URLs

- **Website**: https://koufobunch.com
- **Admin Portal**: https://koufobunch.com/kbportal
- **API Base**: https://u0xet1m9p1.execute-api.us-east-1.amazonaws.com/prod/

### AWS Resource IDs

- **Amplify App**: d2zsamo7mttch3
- **API Gateway**: u0xet1m9p1
- **DynamoDB Table**: ProductsTable
- **S3 Bucket**: pinterest-affiliate-images-788222620487
- **Cognito User Pool**: us-east-1_dgrSfYa3L
- **CloudWatch Dashboard**: PinterestAffiliate-PriceSync

### Key Commands

```bash
# Deploy infrastructure
cd infrastructure && cdk deploy --all

# Build backend
cd backend && npm run build

# Run frontend locally
cd frontend && npm run dev

# Seed database
cd backend && npm run seed

# View logs
aws logs tail /aws/lambda/pinterest-affiliate-syncAmazonPrices --follow

# Trigger manual sync
aws lambda invoke --function-name pinterest-affiliate-syncAmazonPrices response.json
```

### Monitoring Dashboards

- **CloudWatch**: [PinterestAffiliate-PriceSync Dashboard](https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=PinterestAffiliate-PriceSync)
- **Amplify Console**: [App Dashboard](https://console.aws.amazon.com/amplify/home?region=us-east-1#/d2zsamo7mttch3)
- **API Gateway**: [API Metrics](https://console.aws.amazon.com/apigateway/home?region=us-east-1#/apis/u0xet1m9p1/dashboard)
- **AdSense**: [Google AdSense Dashboard](https://www.google.com/adsense/)
- **Associates**: [Amazon Associates Dashboard](https://affiliate-program.amazon.com/)

---

*Last Updated: December 2024*
