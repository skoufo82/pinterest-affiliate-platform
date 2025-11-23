# Deployment Guide - Pinterest Affiliate Platform

This guide will walk you through deploying your Pinterest Affiliate Platform to AWS.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] AWS Account created
- [ ] AWS CLI installed and configured
- [ ] Node.js >= 18.0.0 installed
- [ ] AWS CDK CLI installed globally (`npm install -g aws-cdk`)
- [ ] All project dependencies installed (`npm install`)

## Step 1: Configure AWS Credentials

You'll need AWS credentials with appropriate permissions. Here's how to set them up:

### Option A: Using AWS CLI Configure (Recommended)

```bash
aws configure
```

You'll be prompted for:
- **AWS Access Key ID**: Get from AWS Console → IAM → Users → Security Credentials
- **AWS Secret Access Key**: Provided when you create the access key
- **Default region**: e.g., `us-east-1`
- **Default output format**: `json`

### Option B: Using Environment Variables

```bash
export AWS_ACCESS_KEY_ID=your_access_key_here
export AWS_SECRET_ACCESS_KEY=your_secret_key_here
export AWS_DEFAULT_REGION=us-east-1
```

### Verify Your Credentials

```bash
aws sts get-caller-identity
```

You should see your AWS account ID and user ARN.

## Step 2: Install Project Dependencies

```bash
# Install all workspace dependencies
npm install

# Install infrastructure dependencies
cd infrastructure
npm install
cd ..

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

## Step 3: Bootstrap AWS CDK (First Time Only)

This creates the necessary S3 bucket and IAM roles for CDK deployments:

```bash
cd infrastructure
cdk bootstrap
```

Expected output:
```
✅  Environment aws://ACCOUNT-ID/REGION bootstrapped
```

## Step 4: Deploy Backend Infrastructure

Deploy the DynamoDB tables, S3 buckets, Lambda functions, and API Gateway:

```bash
cd infrastructure
npm run deploy
```

This will:
1. Create DynamoDB ProductsTable with GSIs
2. Create S3 bucket for product images
3. Deploy Lambda functions for all API endpoints
4. Create API Gateway REST API
5. Set up IAM roles and permissions

**IMPORTANT**: Save the API Gateway URL from the output!

Example output:
```
Outputs:
BackendStack.ApiEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
BackendStack.ImagesBucketName = pinterest-affiliate-images-abc123
BackendStack.ProductsTableName = ProductsTable
```

## Step 5: Seed Sample Data (Optional)

Populate your database with sample products:

```bash
cd backend

# Set environment variables (use values from CDK output)
export AWS_REGION=us-east-1
export DYNAMODB_TABLE_NAME=ProductsTable

# Run seed script
npm run seed
```

You should see:
```
✓ Created category: Home & Kitchen
✓ Created category: Fashion & Beauty
...
✓ Created product: Wireless Bluetooth Headphones
...
✓ Seed process completed successfully!
```

## Step 6: Configure Frontend

Create the frontend environment file:

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local` and add your API Gateway URL:

```env
VITE_API_BASE_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

## Step 7: Test Locally

Run the frontend locally to verify everything works:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser and verify:
- [ ] Products load on the home page
- [ ] Categories page displays all categories
- [ ] Product detail modal opens when clicking a product
- [ ] Admin dashboard is accessible at `/admin`
- [ ] You can create/edit/delete products in admin

## Step 8: Deploy Frontend to AWS Amplify

### Option A: Using AWS Amplify Console (Recommended)

1. **Go to AWS Amplify Console**
   - Navigate to: https://console.aws.amazon.com/amplify/
   - Click "New app" → "Host web app"

2. **Connect Repository**
   - Select "GitHub" (or your git provider)
   - Authorize AWS Amplify to access your repository
   - Select your repository and branch (usually `main`)

3. **Configure Build Settings**
   - Amplify should auto-detect the `amplify.yml` file
   - Verify the build settings look correct
   - Click "Next"

4. **Add Environment Variables**
   - Click "Advanced settings"
   - Add environment variable:
     - Key: `VITE_API_BASE_URL`
     - Value: Your API Gateway URL
   - Add any optional variables (Pinterest ID, Analytics, etc.)

5. **Review and Deploy**
   - Review all settings
   - Click "Save and deploy"
   - Wait for deployment to complete (5-10 minutes)

6. **Get Your URL**
   - Once deployed, you'll get an Amplify URL like:
   - `https://main.d1234abcd.amplifyapp.com`

### Option B: Using Amplify CLI

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
amplify init

# Add hosting
amplify add hosting

# Publish
amplify publish
```

## Step 9: Verify Deployment

Test your production site:

1. **Public Site**
   - Visit your Amplify URL
   - Verify products load
   - Test navigation between pages
   - Click affiliate links (should go to Amazon)
   - Test Pinterest share button

2. **Admin Dashboard**
   - Visit `https://your-amplify-url.com/admin`
   - Create a test product
   - Upload an image
   - Verify it appears on the public site
   - Edit and delete the test product

## Step 10: Update Amazon Affiliate Links

Replace the placeholder affiliate links with your real Amazon Associates tag:

1. Sign up for Amazon Associates: https://affiliate-program.amazon.com/
2. Get your affiliate tag (e.g., `yourname-20`)
3. Update all product links in the admin dashboard
4. Format: `https://amazon.com/dp/PRODUCTID?tag=yourname-20`

## Troubleshooting

### CDK Deployment Fails

**Error: "Unable to resolve AWS account"**
```bash
# Verify credentials
aws sts get-caller-identity

# Reconfigure if needed
aws configure
```

**Error: "Stack already exists"**
```bash
# Destroy and redeploy
cdk destroy
cdk deploy
```

### API Gateway Returns 403 or CORS Errors

- Verify CORS is configured in `infrastructure/lib/backend-stack.ts`
- Check that your frontend URL is allowed
- Redeploy infrastructure: `cdk deploy`

### Products Not Loading

- Verify API Gateway URL in `.env.local`
- Check browser console for errors
- Verify Lambda functions are deployed
- Check CloudWatch logs for Lambda errors

### Image Upload Fails

- Verify S3 bucket has correct permissions
- Check that presigned URL generation works
- Verify file size is under 5MB
- Check file type is JPEG, PNG, or WebP

## Cost Estimate

With the free tier and low traffic (1000 visitors/day):

- **Amplify Hosting**: $0 (free tier)
- **Lambda**: ~$5/month (1M requests)
- **DynamoDB**: ~$2/month (on-demand)
- **S3**: ~$1/month (10GB storage)
- **API Gateway**: ~$3/month
- **CloudWatch**: ~$2/month

**Total: ~$13/month**

## Next Steps

1. **Customize Branding**
   - Update logo and colors in `frontend/src/components/public/Header.tsx`
   - Modify footer text in `frontend/src/components/public/Footer.tsx`

2. **Add Products**
   - Use the admin dashboard to add your curated products
   - Write compelling descriptions
   - Use high-quality images

3. **Set Up Pinterest**
   - Create a Pinterest business account
   - Create boards for your categories
   - Pin your products to Pinterest
   - Drive traffic to your site

4. **Monitor Performance**
   - Check CloudWatch logs for errors
   - Monitor API Gateway metrics
   - Track affiliate link clicks
   - Optimize based on user behavior

5. **Optional Enhancements**
   - Set up custom domain with Route 53
   - Add Google Analytics
   - Implement Pinterest Analytics
   - Add email newsletter signup

## Support

For issues or questions:
- Check [README.md](./README.md) for troubleshooting
- Review [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for API details
- See [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) for admin help

## Security Checklist

Before going live:
- [ ] Update all placeholder affiliate links
- [ ] Set up admin authentication (optional)
- [ ] Review IAM permissions (principle of least privilege)
- [ ] Enable CloudWatch alarms for errors
- [ ] Set up billing alerts in AWS
- [ ] Review and accept Amazon Associates terms
- [ ] Add affiliate disclosure to footer (already included)

Congratulations! Your Pinterest Affiliate Platform is now live! 🎉
