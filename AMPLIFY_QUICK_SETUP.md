# AWS Amplify Quick Setup Guide

Your code is now on GitHub! Let's deploy the frontend to AWS Amplify.

## Repository Information
- **GitHub URL**: https://github.com/skoufo82/pinterest-affiliate-platform
- **Branch**: main

## Step-by-Step Amplify Setup

### 1. Open AWS Amplify Console

Go to: https://console.aws.amazon.com/amplify/home?region=us-east-1

Or search for "Amplify" in the AWS Console.

### 2. Create New App

1. Click **"New app"** → **"Host web app"**
2. Select **"GitHub"** as your git provider
3. Click **"Continue"**

### 3. Authorize GitHub

1. Click **"Authorize AWS Amplify"**
2. Grant access to your repositories
3. You may need to install the AWS Amplify app on your GitHub account

### 4. Select Repository

1. **Repository**: Select `skoufo82/pinterest-affiliate-platform`
2. **Branch**: Select `main`
3. Click **"Next"**

### 5. Configure Build Settings

Amplify should auto-detect your `amplify.yml` file. Verify it shows:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/dist
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
```

Click **"Next"**

### 6. Add Environment Variables

**CRITICAL**: Before deploying, add your API Gateway URL:

1. Expand **"Advanced settings"**
2. Click **"Add environment variable"**
3. Add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://u0xet1m9p1.execute-api.us-east-1.amazonaws.com/prod`

4. (Optional) Add other variables:
   - `VITE_PINTEREST_APP_ID` - Your Pinterest App ID
   - `VITE_GA_TRACKING_ID` - Google Analytics ID

### 7. Review and Deploy

1. Review all settings
2. Click **"Save and deploy"**
3. Wait 5-10 minutes for the build to complete

### 8. Get Your Live URL

Once deployed, you'll get an Amplify URL like:
```
https://main.d1234abcd.amplifyapp.com
```

## Verify Deployment

Visit your Amplify URL and check:
- ✅ Products load on home page
- ✅ Categories page works
- ✅ Product details open
- ✅ Admin dashboard accessible at `/admin`
- ✅ Images load from CloudFront CDN

## Update CORS (If Needed)

If you get CORS errors, you may need to update the API Gateway CORS settings to include your Amplify domain.

## Troubleshooting

### Build Fails

Check the build logs in Amplify Console. Common issues:
- Missing environment variables
- Node version mismatch
- Dependency installation errors

### Products Don't Load

- Verify `VITE_API_BASE_URL` is set correctly
- Check browser console for errors
- Verify API Gateway is accessible

### Images Don't Load

- Check S3 bucket permissions
- Verify CloudFront distribution is active
- Check image URLs in database

## Next Steps

1. **Test Your Live Site**: Visit your Amplify URL
2. **Set Up Custom Domain** (Optional):
   - Go to Amplify Console → Domain management
   - Add your custom domain
   - Follow DNS configuration steps

3. **Enable Branch Deployments**:
   - Create feature branches for testing
   - Amplify will create preview URLs automatically

4. **Monitor Your Site**:
   - Check Amplify build logs
   - Monitor CloudWatch for Lambda errors
   - Track API Gateway metrics

## Useful Commands

```bash
# View your Amplify app
gh browse

# Push updates
git add .
git commit -m "Update message"
git push

# Amplify will automatically rebuild and deploy!
```

## Cost Monitoring

Set up billing alerts in AWS:
1. Go to AWS Billing Dashboard
2. Set up a budget alert (e.g., $20/month)
3. Get notified before costs exceed your budget

---

**Your site is now live!** 🎉

Share your Amplify URL and start driving traffic from Pinterest!
