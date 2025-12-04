# Pinterest Affiliate Platform - Architecture Diagram

## System Architecture (Mermaid)

```mermaid
graph TB
    subgraph "Users"
        U1[Public Users]
        U2[Admin Users]
    end

    subgraph "Frontend Layer - AWS Amplify"
        FE[React SPA<br/>TypeScript + Vite<br/>Tailwind CSS]
        CF1[CloudFront CDN]
        DOM[koufobunch.com]
    end

    subgraph "API Layer"
        APIG[API Gateway<br/>REST API]
        AUTH[Cognito Authorizer<br/>JWT Validation]
    end

    subgraph "Compute Layer - AWS Lambda"
        L1[Product Functions<br/>getProducts, getProduct<br/>createProduct, updateProduct<br/>deleteProduct]
        L2[User Functions<br/>createUser, listUsers<br/>deleteUser, resetPassword]
        L3[Price Sync<br/>syncAmazonPrices<br/>triggerPriceSync<br/>getSyncHistory]
        L4[Utility Functions<br/>uploadImage<br/>getCategories]
    end

    subgraph "Data Layer"
        DDB[(DynamoDB<br/>ProductsTable)]
        S3[S3 Bucket<br/>Product Images]
        CF2[CloudFront CDN<br/>Image Delivery]
        COG[Cognito User Pool<br/>Admin Users]
        SSM[Parameter Store<br/>PA-API Credentials]
    end

    subgraph "External Services"
        PAAPI[Amazon PA-API<br/>Price Data]
        ASSOC[Amazon Associates<br/>Affiliate Tracking]
        ADSENSE[Google AdSense<br/>Monetization]
        SES[AWS SES<br/>Email Delivery]
    end

    subgraph "Monitoring & Operations"
        CW[CloudWatch<br/>Logs & Metrics]
        DASH[CloudWatch Dashboard<br/>Price Sync Monitor]
        SNS[SNS Topic<br/>Alert Notifications]
        EB[EventBridge<br/>Daily 2AM UTC Trigger]
        ALARM[CloudWatch Alarms<br/>Failure Rate, Auth Errors]
    end

    subgraph "Deployment & CI/CD"
        GH[GitHub Repository<br/>Source Control]
        CDK[AWS CDK<br/>Infrastructure as Code]
        AMP[Amplify CI/CD<br/>Auto Deploy]
    end

    %% User Flows
    U1 -->|Browse Products| DOM
    U2 -->|Admin Portal /kbportal| DOM
    DOM --> CF1
    CF1 --> FE
    
    %% API Flows
    FE -->|API Requests| APIG
    APIG -->|Public Endpoints| L1
    APIG -->|Validate Token| AUTH
    AUTH -->|Admin Endpoints| L2
    AUTH -->|Admin Endpoints| L3
    AUTH -->|Admin Endpoints| L4
    
    %% Data Access
    L1 <-->|Read/Write| DDB
    L2 <-->|User Management| COG
    L3 <-->|Price Updates| DDB
    L4 -->|Generate Presigned URL| S3
    FE -->|Upload Images| S3
    S3 --> CF2
    CF2 -->|Serve Images| FE
    
    %% External Integrations
    L3 -->|Fetch Prices| PAAPI
    L3 -->|Read Credentials| SSM
    FE -->|Affiliate Links| ASSOC
    FE -->|Display Ads| ADSENSE
    L2 -->|Send Invites| SES
    
    %% Monitoring
    L1 & L2 & L3 & L4 -->|Logs| CW
    L3 -->|Custom Metrics| CW
    CW -->|Visualize| DASH
    CW -->|Trigger| ALARM
    ALARM -->|Notify| SNS
    EB -->|Daily Schedule| L3
    
    %% Deployment
    GH -->|Push to main| AMP
    AMP -->|Build & Deploy| FE
    GH -->|Infrastructure Code| CDK
    CDK -->|Deploy Stacks| APIG
    CDK -->|Deploy Stacks| L1
    CDK -->|Deploy Stacks| DDB

    %% Styling
    classDef frontend fill:#d5e8d4,stroke:#82b366,stroke-width:2px
    classDef api fill:#ffe6cc,stroke:#d79b00,stroke-width:2px
    classDef compute fill:#f8cecc,stroke:#b85450,stroke-width:2px
    classDef data fill:#dae8fc,stroke:#6c8ebf,stroke-width:2px
    classDef external fill:#e1d5e7,stroke:#9673a6,stroke-width:2px
    classDef monitoring fill:#fff2cc,stroke:#d6b656,stroke-width:2px
    classDef deployment fill:#f5f5f5,stroke:#666666,stroke-width:2px

    class FE,CF1,DOM frontend
    class APIG,AUTH api
    class L1,L2,L3,L4 compute
    class DDB,S3,CF2,COG,SSM data
    class PAAPI,ASSOC,ADSENSE,SES external
    class CW,DASH,SNS,EB,ALARM monitoring
    class GH,CDK,AMP deployment
```

## Component Details

### Frontend Layer
- **React SPA**: Modern single-page application with TypeScript
- **CloudFront**: Global CDN for fast content delivery
- **Custom Domain**: koufobunch.com with SSL certificate

### API Layer
- **API Gateway**: RESTful API with CORS support
- **Cognito Authorizer**: JWT-based authentication for admin endpoints

### Compute Layer
- **Product Functions**: CRUD operations for product management
- **User Functions**: Admin user management and authentication
- **Price Sync**: Automated and manual Amazon price synchronization
- **Utility Functions**: Image uploads and category management

### Data Layer
- **DynamoDB**: NoSQL database with GSIs for efficient queries
- **S3 + CloudFront**: Image storage with CDN delivery
- **Cognito User Pool**: Admin authentication and authorization
- **Parameter Store**: Secure credential storage for PA-API

### External Services
- **Amazon PA-API**: Real-time product price data
- **Amazon Associates**: Affiliate link tracking
- **Google AdSense**: Display advertising
- **AWS SES**: Transactional email delivery

### Monitoring & Operations
- **CloudWatch**: Centralized logging and metrics
- **Dashboard**: Real-time price sync monitoring
- **Alarms**: Automated alerts for failures
- **EventBridge**: Scheduled daily price sync trigger

### Deployment & CI/CD
- **GitHub**: Source code version control
- **AWS CDK**: Infrastructure as code in TypeScript
- **Amplify**: Automated frontend deployment

## Data Flow Examples

### Public User Flow
1. User visits koufobunch.com
2. CloudFront serves cached React app
3. App fetches products from API Gateway
4. Lambda queries DynamoDB
5. Products displayed with CloudFront CDN images
6. User clicks affiliate link → Amazon Associates

### Admin Management Flow
1. Admin logs in via Cognito
2. JWT token stored in session
3. Admin creates/updates product
4. API Gateway validates token
5. Lambda updates DynamoDB
6. Images uploaded directly to S3
7. CloudFront serves new images

### Automated Price Sync Flow
1. EventBridge triggers at 2 AM UTC
2. Lambda fetches all products from DynamoDB
3. For each product with ASIN:
   - Call Amazon PA-API
   - Update price in DynamoDB
4. Publish metrics to CloudWatch
5. If failures > 50%, trigger alarm
6. SNS sends alert email

## Quick Reference

### Production URLs
- Website: https://koufobunch.com
- Admin: https://koufobunch.com/kbportal
- API: https://u0xet1m9p1.execute-api.us-east-1.amazonaws.com/prod/

### AWS Resources
- Amplify App: d2zsamo7mttch3
- API Gateway: u0xet1m9p1
- DynamoDB: ProductsTable
- S3 Bucket: pinterest-affiliate-images-788222620487
- Cognito Pool: us-east-1_dgrSfYa3L

---

*This diagram is automatically rendered by GitHub. To edit, modify the Mermaid code above.*
