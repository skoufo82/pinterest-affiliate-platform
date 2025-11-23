# Deployment Checklist

Quick reference checklist for deploying the Pinterest Affiliate Platform to AWS.

## Prerequisites

- [ ] AWS Account with appropriate permissions
- [ ] AWS CLI installed and configured
- [ ] Node.js 18+ and npm installed
- [ ] GitHub repository created
- [ ] Code committed to `main` branch

## Step 1: Deploy Infrastructure

```bash
# Install dependencies
npm install

# Deploy backend infrastructure
cd infrastructure
npm run deploy
```

- [ ] DynamoDB table created
- [ ] S3 bucket created
- [ ] Lambda functions deployed
- [ ] API Gateway created
- [ ] **Copy API Gateway URL from output**

## Step 2: Set Up AWS Amplify

Follow [AMPLIFY_SETUP.md](./AMPLIFY_SETUP.md):

- [ ] Create Amplify app in AWS Console
- [ ] Connect GitHub repository
- [ ] Configure `main` branch for production
- [ ] Enable branch autodetection for preview deployments
- [ ] Verify `amplify.yml` is detected

## Step 3: Configure Environment Variables

Follow [AMPLIFY_ENV_VARIABLES.md](./AMPLIFY_ENV_VARIABLES.md):

- [ ] Set `VITE_API_BASE_URL` (required - from Step 1)
- [ ] Set `VITE_ADMIN_PASSWORD` (optional)
- [ ] Set `VITE_PINTEREST_APP_ID` (optional)
- [ ] Set `VITE_GA_TRACKING_ID` (optional)

## Step 4: Trigger First Deployment

```bash
# Push to main branch to trigger build
git push origin main
```

- [ ] Build starts automatically
- [ ] Build completes successfully (3-7 minutes)
- [ ] Application is accessible at Amplify URL

## Step 5: Test Deployment

Follow [AMPLIFY_TESTING.md](./AMPLIFY_TESTING.md):

- [ ] Home page loads
- [ ] API calls work
- [ ] Environment variables are injected
- [ ] Admin dashboard accessible
- [ ] CRUD operations work
- [ ] Images load correctly
- [ ] Responsive design works
- [ ] Performance score ≥ 90 (Lighthouse)

## Step 6: Configure Custom Domain (Optional)

- [ ] Add custom domain in Amplify Console
- [ ] Configure DNS records
- [ ] Wait for SSL certificate provisioning
- [ ] Verify custom domain works

## Step 7: Set Up Monitoring (Optional)

- [ ] Configure CloudWatch alarms
- [ ] Set up Amplify build notifications
- [ ] Enable error tracking (e.g., Sentry)
- [ ] Configure uptime monitoring

## Step 8: Seed Data (Optional)

```bash
# Create sample products for testing
cd backend
npm run seed
```

- [ ] Sample products created
- [ ] Sample images uploaded
- [ ] Categories populated
- [ ] Verify data in DynamoDB

## Post-Deployment

- [ ] Document deployment URL
- [ ] Share access with team
- [ ] Update documentation
- [ ] Set up staging environment (if needed)
- [ ] Configure backup strategy
- [ ] Plan monitoring and maintenance

## Rollback Plan

If deployment fails:

1. **Frontend:** Redeploy previous version in Amplify Console
2. **Backend:** Rollback CDK stack: `cdk deploy --rollback`
3. **Database:** Use DynamoDB point-in-time recovery if needed

## Troubleshooting

### Build Fails
- Check build logs in Amplify Console
- Verify `package-lock.json` is committed
- Check TypeScript compilation errors
- Review [AMPLIFY_TESTING.md](./AMPLIFY_TESTING.md) troubleshooting section

### API Not Working
- Verify `VITE_API_BASE_URL` is correct
- Check API Gateway CORS configuration
- Test API endpoint directly with curl
- Review Lambda function logs in CloudWatch

### Environment Variables Not Working
- Verify variables are prefixed with `VITE_`
- Trigger new build after adding variables
- Check Amplify Console environment variables section

## Estimated Costs

For ~1000 visitors/day:
- Amplify Hosting: $0 (free tier)
- Lambda: ~$5/month
- DynamoDB: ~$2/month
- S3: ~$1/month
- CloudFront: ~$5/month
- **Total: ~$13/month**

## Resources

- [AMPLIFY_SETUP.md](./AMPLIFY_SETUP.md) - Amplify setup guide
- [AMPLIFY_ENV_VARIABLES.md](./AMPLIFY_ENV_VARIABLES.md) - Environment variables guide
- [AMPLIFY_TESTING.md](./AMPLIFY_TESTING.md) - Testing and verification guide
- [README.md](./README.md) - Project documentation

## Support

For issues or questions:
1. Check the troubleshooting sections in the guides
2. Review AWS Amplify documentation
3. Check CloudWatch logs for errors
4. Review GitHub issues

---

**Last Updated:** 2025-01-15
