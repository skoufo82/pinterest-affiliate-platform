# AWS Amplify Setup Guide

This guide walks you through connecting your GitHub repository to AWS Amplify for automated CI/CD deployment.

## Prerequisites

- AWS Account with appropriate permissions
- GitHub repository with the code
- AWS CLI configured (optional but recommended)

## Step 1: Create Amplify App

1. Navigate to the [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click **"New app"** → **"Host web app"**
3. Select **GitHub** as the repository service
4. Click **"Continue"**

## Step 2: Authorize GitHub Access

1. If prompted, authorize AWS Amplify to access your GitHub account
2. Select the organization/account where your repository is located
3. Select the repository: `pinterest-affiliate-platform` (or your repository name)
4. Click **"Next"**

## Step 3: Configure Build Settings

1. **App name**: Enter a name (e.g., "Pinterest Affiliate Platform")
2. **Branch**: Select `main` for production deployment
3. **Build and test settings**: 
   - Amplify should auto-detect the `amplify.yml` file
   - Verify the configuration shows:
     - Build command: `npm run build`
     - Output directory: `frontend/dist`
   - If not detected, you can manually paste the contents of `amplify.yml`
4. Click **"Advanced settings"** to expand environment variables section (we'll configure these in the next step)
5. Click **"Next"**

## Step 4: Review and Deploy

1. Review all settings
2. Click **"Save and deploy"**
3. Amplify will start the first build automatically
4. Wait for the build to complete (this may take 5-10 minutes)

## Step 5: Configure Branch Deployments

### Enable Preview Deployments for Feature Branches

1. In the Amplify Console, go to your app
2. Click **"App settings"** → **"Branch deployments"**
3. Under **"Branch autodetection"**, toggle **"Enable"**
4. Configure pattern matching:
   - Pattern: `feature/*` or `*` (for all branches)
   - This will create preview deployments for feature branches
5. Click **"Save"**

### Configure Main Branch as Production

1. Go to **"App settings"** → **"General"**
2. Verify that the `main` branch is set as the production branch
3. Production URL will be: `https://main.xxxxxx.amplifyapp.com`

## Step 6: Configure Custom Domain (Optional)

1. Go to **"App settings"** → **"Domain management"**
2. Click **"Add domain"**
3. Enter your custom domain name
4. Follow the DNS configuration instructions
5. Wait for SSL certificate provisioning (can take up to 24 hours)

## Step 7: Enable Build Notifications (Optional)

1. Go to **"App settings"** → **"Notifications"**
2. Click **"Add notification"**
3. Configure email or SNS notifications for:
   - Build started
   - Build succeeded
   - Build failed
4. Click **"Save"**

## Verification

After setup is complete:

1. Push a commit to the `main` branch
2. Verify that Amplify automatically triggers a build
3. Check the build logs for any errors
4. Visit the deployed URL to test the application
5. Create a feature branch and push to verify preview deployments work

## Troubleshooting

### Build Fails with "npm ci" Error
- Ensure `package-lock.json` is committed to the repository
- Check that Node.js version is compatible (18.x or higher)

### Environment Variables Not Working
- Verify variables are prefixed with `VITE_` for Vite to expose them
- Check that variables are set in Amplify Console under "Environment variables"
- Rebuild the app after adding/changing environment variables

### Preview Deployments Not Creating
- Verify branch autodetection is enabled
- Check that the branch name matches the pattern
- Ensure GitHub webhook is properly configured

## Next Steps

After completing this setup, proceed to:
- **Task 10.3**: Configure environment variables in Amplify Console
- **Task 10.4**: Test the deployment and verify functionality

## Useful Commands

```bash
# View Amplify app status
aws amplify list-apps

# Get app details
aws amplify get-app --app-id <app-id>

# Trigger manual build
aws amplify start-job --app-id <app-id> --branch-name main --job-type RELEASE
```

## Resources

- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [Amplify Hosting Guide](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
- [GitHub Integration](https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html)
