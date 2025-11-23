# Pinterest Affiliate Product Landing Platform

A modern, serverless web application for showcasing curated Amazon affiliate products in a Pinterest-inspired layout.

## Architecture

- **Frontend**: React 18 + Vite + TailwindCSS hosted on AWS Amplify
- **Backend**: AWS Lambda functions with API Gateway
- **Database**: DynamoDB for product data
- **Storage**: S3 for product images
- **Infrastructure**: AWS CDK for infrastructure as code

## Project Structure

```
pinterest-affiliate-platform/
├── frontend/          # React frontend application
├── backend/           # Lambda functions and shared utilities
├── infrastructure/    # AWS CDK infrastructure code
└── package.json       # Root workspace configuration
```

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Getting Started

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd pinterest-affiliate-platform

# Install dependencies for all workspaces
npm install
```

This will install dependencies for all workspaces (frontend, backend, infrastructure).

### 2. Configure AWS Credentials

Ensure your AWS CLI is configured with appropriate credentials:

```bash
aws configure
```

You'll need:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., us-east-1)
- Default output format (json)

Verify your credentials:

```bash
aws sts get-caller-identity
```

### 3. Deploy Infrastructure

```bash
cd infrastructure

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy the stacks
npm run deploy
```

This will deploy:
- DynamoDB ProductsTable with GSIs for category and published status queries
- S3 bucket for product images with public read access
- Lambda functions for all API endpoints (getProducts, getProduct, createProduct, updateProduct, deleteProduct, uploadImage)
- API Gateway REST API with CORS configuration

**Important**: Save the API Gateway URL from the deployment output. You'll need it for frontend configuration.

Example output:
```
Outputs:
BackendStack.ApiEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

### 4. Seed Sample Data (Optional)

Populate your database with sample products and categories:

```bash
cd backend

# Set environment variables
export AWS_REGION=us-east-1
export DYNAMODB_TABLE_NAME=ProductsTable

# Run the seed script
npm run seed
```

This will create:
- 5 product categories (Home & Kitchen, Fashion & Beauty, Tech & Electronics, Health & Wellness, Books & Stationery)
- 15 sample products across all categories

### 5. Configure Frontend

Create a `.env.local` file in the `frontend` directory:

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local` with your API Gateway URL:

```env
VITE_API_BASE_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

### 6. Run Frontend Locally

```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173`.

Open your browser and navigate to:
- Public site: `http://localhost:5173`
- Admin dashboard: `http://localhost:5173/admin`

## Development

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

### Testing

```bash
npm run test
```

## Deployment

### Infrastructure Deployment

Deploy the backend infrastructure first:

```bash
cd infrastructure
npm run deploy
```

This will output your API Gateway URL, which you'll need for the frontend configuration.

### Frontend Deployment (AWS Amplify)

The frontend is deployed automatically via AWS Amplify CI/CD. Follow these guides:

1. **[AMPLIFY_SETUP.md](./AMPLIFY_SETUP.md)** - Complete guide to connect GitHub repository to Amplify
2. **[AMPLIFY_ENV_VARIABLES.md](./AMPLIFY_ENV_VARIABLES.md)** - Configure environment variables in Amplify Console
3. **[AMPLIFY_TESTING.md](./AMPLIFY_TESTING.md)** - Test and verify your deployment

**Quick Start:**
1. Connect your GitHub repository to AWS Amplify (see AMPLIFY_SETUP.md)
2. Configure environment variables in Amplify Console (see AMPLIFY_ENV_VARIABLES.md)
3. Push to `main` branch to trigger automatic deployment
4. Verify deployment using the testing guide (see AMPLIFY_TESTING.md)

The `amplify.yml` file in the root directory contains the build configuration.

## Environment Variables

### Frontend

Create a `frontend/.env.local` file for local development (see `frontend/.env.example`):

- `VITE_API_BASE_URL`: API Gateway endpoint URL (required)
- `VITE_ADMIN_PASSWORD`: Optional admin password
- `VITE_PINTEREST_APP_ID`: Pinterest API credentials (optional)
- `VITE_GA_TRACKING_ID`: Google Analytics tracking ID (optional)

For production deployment, configure these in AWS Amplify Console. See [AMPLIFY_ENV_VARIABLES.md](./AMPLIFY_ENV_VARIABLES.md) for detailed instructions.

### Backend (Lambda)

These are automatically configured by CDK:
- `PRODUCTS_TABLE_NAME`: DynamoDB table name
- `IMAGES_BUCKET_NAME`: S3 bucket name
- `REGION`: AWS region

## Troubleshooting

### CDK Deployment Issues

**Error: "Unable to resolve AWS account to use"**
- Solution: Run `aws configure` and ensure your credentials are set correctly
- Verify with: `aws sts get-caller-identity`

**Error: "Stack already exists"**
- Solution: If you need to redeploy, use `cdk deploy --force`
- Or delete the existing stack: `cdk destroy` then redeploy

**Error: "Insufficient permissions"**
- Solution: Ensure your IAM user/role has permissions for:
  - CloudFormation (create/update stacks)
  - DynamoDB (create tables)
  - S3 (create buckets)
  - Lambda (create functions)
  - API Gateway (create APIs)
  - IAM (create roles)

### Seed Script Issues

**Error: "DYNAMODB_TABLE_NAME environment variable is required"**
- Solution: Export the environment variable before running the seed script:
  ```bash
  export DYNAMODB_TABLE_NAME=ProductsTable
  export AWS_REGION=us-east-1
  ```

**Error: "ResourceNotFoundException: Requested resource not found"**
- Solution: Ensure the infrastructure is deployed first (`cd infrastructure && npm run deploy`)
- Verify the table name matches your CDK stack output

### Frontend Issues

**Error: "Network Error" or "Failed to fetch"**
- Solution: Check that `VITE_API_BASE_URL` in `.env.local` matches your API Gateway URL
- Verify the API Gateway is deployed and accessible
- Check browser console for CORS errors

**CORS Errors**
- Solution: The API Gateway should have CORS configured automatically by CDK
- If issues persist, verify the CORS configuration in `infrastructure/lib/backend-stack.ts`

**Images not loading**
- Solution: Verify S3 bucket has public read access
- Check that image URLs in the database are correct
- Ensure CloudFront distribution is active (if using CDK with CloudFront)

### Lambda Function Issues

**Error: "Internal Server Error" from API**
- Solution: Check CloudWatch Logs for the specific Lambda function
- Navigate to AWS Console → CloudWatch → Log Groups → `/aws/lambda/<function-name>`
- Look for error messages and stack traces

**Timeout Errors**
- Solution: Increase Lambda timeout in `infrastructure/lib/backend-stack.ts`
- Default is 30 seconds, increase if needed for large operations

### Local Development Issues

**Port 5173 already in use**
- Solution: Kill the process using the port or use a different port:
  ```bash
  npm run dev -- --port 3000
  ```

**TypeScript errors**
- Solution: Ensure all dependencies are installed:
  ```bash
  npm install
  cd frontend && npm install
  cd ../backend && npm install
  ```

### Getting Help

If you encounter issues not covered here:
1. Check the AWS CloudWatch logs for Lambda functions
2. Review the CDK deployment output for any warnings
3. Verify all environment variables are set correctly
4. Ensure your AWS account has sufficient permissions and service limits

## Additional Documentation

- **[AMPLIFY_SETUP.md](./AMPLIFY_SETUP.md)** - Complete guide to deploy frontend with AWS Amplify
- **[AMPLIFY_ENV_VARIABLES.md](./AMPLIFY_ENV_VARIABLES.md)** - Configure environment variables in Amplify
- **[AMPLIFY_TESTING.md](./AMPLIFY_TESTING.md)** - Test and verify your Amplify deployment
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Pre-deployment checklist
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete API reference
- **[ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** - Admin dashboard user guide

## License

MIT
