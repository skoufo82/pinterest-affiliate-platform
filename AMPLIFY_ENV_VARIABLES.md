# AWS Amplify Environment Variables Configuration

This guide explains how to configure environment variables in AWS Amplify for the Pinterest Affiliate Platform.

## Required Environment Variables

### VITE_API_BASE_URL (Required)

The base URL for your API Gateway endpoint.

**How to get the value:**
1. Deploy your infrastructure using CDK: `cd infrastructure && npm run deploy`
2. The API Gateway URL will be output at the end of deployment
3. It will look like: `https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod`

**Example:**
```
VITE_API_BASE_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

## Optional Environment Variables

### VITE_ADMIN_PASSWORD (Optional)

A simple password for protecting admin routes (basic protection).

**Example:**
```
VITE_ADMIN_PASSWORD=your-secure-admin-password-here
```

**Note:** For production, consider implementing proper authentication with AWS Amplify Auth or Cognito.

### VITE_PINTEREST_APP_ID (Optional)

Pinterest API credentials for enhanced Pinterest integration.

**How to get the value:**
1. Go to [Pinterest Developers](https://developers.pinterest.com/)
2. Create a new app or use an existing one
3. Copy the App ID from your app settings

**Example:**
```
VITE_PINTEREST_APP_ID=1234567890
```

### VITE_GA_TRACKING_ID (Optional)

Google Analytics tracking ID for monitoring site traffic.

**How to get the value:**
1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new property or use an existing one
3. Copy the Measurement ID (starts with G-)

**Example:**
```
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

## How to Configure in AWS Amplify Console

### Method 1: Using AWS Amplify Console (Recommended)

1. Navigate to the [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app
3. Click **"App settings"** → **"Environment variables"** in the left sidebar
4. Click **"Manage variables"**
5. Add each variable:
   - Click **"Add variable"**
   - Enter the **Variable name** (e.g., `VITE_API_BASE_URL`)
   - Enter the **Value**
   - Click **"Save"**
6. Repeat for all required and optional variables
7. After adding all variables, trigger a new build:
   - Go to the app overview
   - Click **"Redeploy this version"** or push a new commit

### Method 2: Using AWS CLI

```bash
# Set API Base URL (Required)
aws amplify update-app \
  --app-id <your-app-id> \
  --environment-variables VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com/prod

# Add multiple variables at once
aws amplify update-branch \
  --app-id <your-app-id> \
  --branch-name main \
  --environment-variables \
    VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com/prod \
    VITE_ADMIN_PASSWORD=your-password \
    VITE_PINTEREST_APP_ID=1234567890 \
    VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

### Method 3: Using AWS CDK (Infrastructure as Code)

If you want to manage environment variables through CDK, you can add them to your infrastructure code:

```typescript
// In infrastructure/lib/frontend-stack.ts (if you create this stack)
import * as amplify from 'aws-cdk-lib/aws-amplify';

const amplifyApp = new amplify.CfnApp(this, 'AmplifyApp', {
  name: 'pinterest-affiliate-platform',
  environmentVariables: [
    {
      name: 'VITE_API_BASE_URL',
      value: apiGateway.url,
    },
    // Add other variables as needed
  ],
});
```

## Environment-Specific Variables

You can configure different values for different branches:

1. In Amplify Console, go to **"App settings"** → **"Environment variables"**
2. Click **"Manage variables"**
3. For each variable, you can set branch-specific overrides:
   - Click the variable
   - Click **"Add branch override"**
   - Select the branch (e.g., `develop`, `staging`)
   - Enter the branch-specific value
   - Click **"Save"**

**Example use case:**
- `main` branch → Production API URL
- `develop` branch → Development API URL
- Feature branches → Development API URL (default)

## Verification

After configuring environment variables:

1. Trigger a new build (push a commit or click "Redeploy")
2. Check the build logs to verify variables are being injected
3. After deployment, open the browser console on your deployed site
4. Check that API calls are going to the correct endpoint
5. Verify functionality that depends on environment variables

### Testing Environment Variables

You can add a temporary debug component to verify variables are loaded:

```typescript
// Temporary debug component
const EnvDebug = () => {
  return (
    <div style={{ padding: '20px', background: '#f0f0f0' }}>
      <h3>Environment Variables (Debug)</h3>
      <pre>
        {JSON.stringify({
          API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
          HAS_ADMIN_PASSWORD: !!import.meta.env.VITE_ADMIN_PASSWORD,
          HAS_PINTEREST_ID: !!import.meta.env.VITE_PINTEREST_APP_ID,
          HAS_GA_ID: !!import.meta.env.VITE_GA_TRACKING_ID,
        }, null, 2)}
      </pre>
    </div>
  );
};
```

**Important:** Remove debug components before production deployment!

## Security Best Practices

1. **Never commit sensitive values to Git**
   - Use `.env.local` for local development (already in `.gitignore`)
   - Store production values only in Amplify Console

2. **Use AWS Secrets Manager for highly sensitive data**
   - For production systems, consider using AWS Secrets Manager
   - Access secrets from Lambda functions, not frontend

3. **Prefix all frontend variables with VITE_**
   - Vite only exposes variables prefixed with `VITE_`
   - This prevents accidental exposure of backend secrets

4. **Rotate credentials regularly**
   - Change admin passwords periodically
   - Rotate API keys and tokens

5. **Use different values for different environments**
   - Development, staging, and production should have separate credentials

## Troubleshooting

### Variables Not Available in Application

**Problem:** `import.meta.env.VITE_API_BASE_URL` is undefined

**Solutions:**
1. Verify the variable is prefixed with `VITE_`
2. Check that the variable is set in Amplify Console
3. Trigger a new build after adding variables
4. Clear browser cache and hard reload

### Build Fails After Adding Variables

**Problem:** Build fails with environment variable errors

**Solutions:**
1. Check for typos in variable names
2. Ensure values don't contain special characters that need escaping
3. Review build logs for specific error messages

### API Calls Failing

**Problem:** API calls return 404 or CORS errors

**Solutions:**
1. Verify `VITE_API_BASE_URL` is correct and includes `/prod` or appropriate stage
2. Check that API Gateway is deployed and accessible
3. Verify CORS is configured in API Gateway
4. Test the API endpoint directly with curl or Postman

## Example .env.local for Local Development

Create this file in the `frontend/` directory for local development:

```env
# API Configuration
VITE_API_BASE_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod

# Admin Configuration (Optional)
VITE_ADMIN_PASSWORD=local-dev-password

# Pinterest Integration (Optional)
VITE_PINTEREST_APP_ID=1234567890

# Analytics (Optional)
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

**Note:** This file is already in `.gitignore` and will not be committed.

## Next Steps

After configuring environment variables:
- Proceed to **Task 10.4**: Test Amplify build and deployment
- Verify all functionality works with the configured variables
- Monitor application logs for any environment-related issues

## Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Amplify Environment Variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
