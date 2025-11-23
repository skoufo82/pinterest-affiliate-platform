# AWS SSO Configuration Guide

## Quick Setup

Run this command to configure AWS SSO:

```bash
aws configure sso
```

When prompted, enter:

1. **SSO session name**: `pinterest-affiliate` (or any name you prefer)
2. **SSO start URL**: `https://d-9066102a9d.awsapps.com/start`
3. **SSO region**: `us-east-1` (or your preferred region)
4. **SSO registration scopes**: Press Enter (use default)

This will open your browser to authenticate. After logging in:

5. **Select your AWS account** from the list
6. **Select your role** (e.g., AdministratorAccess, PowerUserAccess)
7. **CLI default client Region**: `us-east-1` (or your preferred region)
8. **CLI default output format**: `json`
9. **CLI profile name**: `default` (or custom name)

## Verify Configuration

After setup, verify your credentials:

```bash
aws sts get-caller-identity
```

You should see your AWS account ID and role information.

## For This Project

Once configured, you can proceed with deployment:

```bash
# 1. Install dependencies
npm install

# 2. Install AWS CDK globally
npm install -g aws-cdk

# 3. Bootstrap CDK (first time only)
cd infrastructure
cdk bootstrap

# 4. Deploy infrastructure
cdk deploy

# 5. Note the API Gateway URL from the output

# 6. Seed sample data
cd ../backend
export DYNAMODB_TABLE_NAME=ProductsTable
export AWS_REGION=us-east-1
npm run seed

# 7. Configure frontend
cd ../frontend
cp .env.example .env.local
# Edit .env.local and add your API Gateway URL

# 8. Test locally
npm run dev
```

## Troubleshooting

If SSO session expires:
```bash
aws sso login
```

If you need to reconfigure:
```bash
aws configure sso
```

To use a specific profile:
```bash
export AWS_PROFILE=your-profile-name
```
