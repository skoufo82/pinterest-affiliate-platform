# AWS Amplify Build and Deployment Testing Guide

This guide provides comprehensive testing procedures to verify your AWS Amplify deployment is working correctly.

## Pre-Deployment Checklist

Before testing the Amplify deployment, ensure:

- [ ] Infrastructure is deployed (DynamoDB, S3, Lambda, API Gateway)
- [ ] `amplify.yml` is configured correctly
- [ ] GitHub repository is connected to Amplify
- [ ] Environment variables are configured in Amplify Console
- [ ] At least one commit exists on the `main` branch

## Test 1: Trigger Initial Build

### Steps

1. **Push a commit to trigger build:**
   ```bash
   # Make a small change (e.g., update README)
   echo "\n## Deployment Test" >> README.md
   git add README.md
   git commit -m "test: trigger Amplify build"
   git push origin main
   ```

2. **Monitor the build in Amplify Console:**
   - Go to AWS Amplify Console
   - Select your app
   - Click on the `main` branch
   - Watch the build progress in real-time

3. **Verify build phases complete successfully:**
   - ✅ Provision
   - ✅ Build (preBuild → build)
   - ✅ Deploy
   - ✅ Verify

### Expected Results

- Build status: **Successful** (green checkmark)
- Build time: 3-7 minutes (typical)
- No errors in build logs

### Common Issues

**Issue:** Build fails at `npm ci`
- **Solution:** Ensure `package-lock.json` is committed
- **Solution:** Check Node.js version compatibility

**Issue:** Build fails at `npm run build`
- **Solution:** Check TypeScript compilation errors
- **Solution:** Verify all dependencies are installed
- **Solution:** Review build logs for specific errors

**Issue:** Build succeeds but deploy fails
- **Solution:** Check that `frontend/dist` directory is created
- **Solution:** Verify `amplify.yml` artifacts configuration

## Test 2: Verify Build Logs

### Steps

1. **Access build logs:**
   - In Amplify Console, click on the completed build
   - Review each phase's logs

2. **Check for environment variable injection:**
   - Look for lines showing environment variables being set
   - Verify `VITE_API_BASE_URL` and other variables are present
   - **Note:** Values should be masked in logs for security

3. **Verify build output:**
   ```
   ✓ built in XXXXms
   ✓ XX modules transformed
   ✓ rendering chunks...
   dist/index.html                   X.XX kB
   dist/assets/index-XXXXXXXX.css    XX.XX kB
   dist/assets/index-XXXXXXXX.js     XXX.XX kB
   ```

### Expected Results

- All phases show green checkmarks
- No error messages in logs
- Build artifacts are created in `frontend/dist`
- Environment variables are injected (masked in logs)

## Test 3: Access Deployed Application

### Steps

1. **Get the deployment URL:**
   - In Amplify Console, find the URL (e.g., `https://main.xxxxxx.amplifyapp.com`)
   - Or click the "Visit deployed URL" link

2. **Open the application in browser:**
   ```bash
   # Or use curl to test
   curl -I https://main.xxxxxx.amplifyapp.com
   ```

3. **Verify the page loads:**
   - Home page should display
   - No console errors
   - Images should load (lazy loading)
   - Navigation should work

### Expected Results

- HTTP Status: **200 OK**
- Page loads within 2-3 seconds
- No 404 errors for assets
- No CORS errors in console

### Common Issues

**Issue:** 404 Not Found
- **Solution:** Check that build artifacts were deployed
- **Solution:** Verify `baseDirectory` in `amplify.yml` is correct

**Issue:** Blank page
- **Solution:** Check browser console for JavaScript errors
- **Solution:** Verify environment variables are set correctly

**Issue:** Assets not loading (404 for CSS/JS)
- **Solution:** Check that Vite build output paths are correct
- **Solution:** Verify `index.html` references are correct

## Test 4: Verify Environment Variables

### Steps

1. **Open browser developer console** (F12)

2. **Test API connectivity:**
   ```javascript
   // In browser console
   console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
   ```

3. **Make a test API call:**
   - Navigate to the home page
   - Open Network tab in DevTools
   - Look for API calls to your API Gateway
   - Verify they're going to the correct endpoint

4. **Check API response:**
   - API calls should return data (or appropriate errors if no data exists)
   - No CORS errors
   - Response status should be 200 or appropriate status code

### Expected Results

- Environment variables are accessible in the application
- API calls use the correct base URL from `VITE_API_BASE_URL`
- No undefined environment variable errors
- API responses are received successfully

### Common Issues

**Issue:** `VITE_API_BASE_URL` is undefined
- **Solution:** Verify variable is set in Amplify Console
- **Solution:** Trigger a new build after adding variables
- **Solution:** Check variable name has `VITE_` prefix

**Issue:** CORS errors
- **Solution:** Verify API Gateway CORS configuration
- **Solution:** Check that API Gateway allows requests from Amplify domain

**Issue:** API returns 403 Forbidden
- **Solution:** Check API Gateway authentication settings
- **Solution:** Verify Lambda function permissions

## Test 5: Test Core Functionality

### Public Site Tests

1. **Home Page:**
   - [ ] Hero section displays
   - [ ] Featured products load
   - [ ] Category navigation links work
   - [ ] Images lazy load correctly

2. **Categories Page:**
   - [ ] All categories display
   - [ ] Category cards are clickable
   - [ ] Navigation to category products works

3. **Category Products Page:**
   - [ ] Products filter by category
   - [ ] Masonry layout displays correctly
   - [ ] Product cards show all information
   - [ ] Affiliate links work (open Amazon)

4. **Product Detail:**
   - [ ] Product modal opens
   - [ ] Full product information displays
   - [ ] Amazon affiliate button works
   - [ ] Pinterest share button works

5. **Footer:**
   - [ ] Affiliate disclosure is visible
   - [ ] Social media links work

### Admin Dashboard Tests

1. **Admin Access:**
   - [ ] Navigate to `/admin`
   - [ ] Admin dashboard loads
   - [ ] Product list displays

2. **Create Product:**
   - [ ] Navigate to create product page
   - [ ] Form displays all fields
   - [ ] Image upload works
   - [ ] Product creation succeeds
   - [ ] Redirect to dashboard after creation

3. **Edit Product:**
   - [ ] Click edit on a product
   - [ ] Form pre-fills with product data
   - [ ] Changes save successfully
   - [ ] Updated product displays correctly

4. **Delete Product:**
   - [ ] Click delete on a product
   - [ ] Confirmation modal appears
   - [ ] Product deletes on confirmation
   - [ ] Product list updates

### Expected Results

- All functionality works as expected
- No console errors
- API calls succeed
- Data persists correctly

## Test 6: Test Responsive Design

### Steps

1. **Test on different screen sizes:**
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)

2. **Use browser DevTools:**
   - Open DevTools (F12)
   - Click device toolbar icon
   - Test various device presets

3. **Verify responsive behavior:**
   - [ ] Masonry grid adjusts columns (3/2/1)
   - [ ] Navigation collapses to hamburger menu on mobile
   - [ ] Images scale appropriately
   - [ ] Text is readable on all sizes
   - [ ] Buttons are tappable on mobile

### Expected Results

- Layout adapts to screen size
- No horizontal scrolling
- Touch targets are at least 44x44px
- Content is readable without zooming

## Test 7: Test Performance

### Steps

1. **Run Lighthouse audit:**
   - Open Chrome DevTools
   - Go to Lighthouse tab
   - Select "Performance" and "Best Practices"
   - Click "Generate report"

2. **Check key metrics:**
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Time to Interactive (TTI)
   - Cumulative Layout Shift (CLS)

3. **Test on mobile network:**
   - In DevTools, throttle network to "Fast 3G"
   - Reload page and measure load time

### Expected Results

- Performance score: **≥ 90**
- LCP: **< 2.5s**
- FCP: **< 1.8s**
- CLS: **< 0.1**
- No major performance warnings

### Common Issues

**Issue:** Low performance score
- **Solution:** Optimize images (compress, use WebP)
- **Solution:** Enable code splitting
- **Solution:** Implement caching strategies

**Issue:** Large bundle size
- **Solution:** Analyze bundle with `vite-bundle-visualizer`
- **Solution:** Remove unused dependencies
- **Solution:** Lazy load components

## Test 8: Test Feature Branch Deployment

### Steps

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/test-deployment
   ```

2. **Make a visible change:**
   ```bash
   # Edit a component to add a test message
   echo "// Test deployment" >> frontend/src/App.tsx
   git add .
   git commit -m "feat: test feature branch deployment"
   git push origin feature/test-deployment
   ```

3. **Verify preview deployment:**
   - Go to Amplify Console
   - Check that a new branch appears
   - Wait for build to complete
   - Access the preview URL (e.g., `https://feature-test-deployment.xxxxxx.amplifyapp.com`)

4. **Verify isolation:**
   - Changes should only appear in preview deployment
   - Production (`main` branch) should be unchanged

### Expected Results

- Preview deployment created automatically
- Unique URL generated for feature branch
- Changes visible in preview, not in production
- Preview can be shared with team for review

## Test 9: Test Rollback

### Steps

1. **View deployment history:**
   - In Amplify Console, go to your app
   - View list of deployments

2. **Trigger a rollback:**
   - Click on a previous successful deployment
   - Click "Redeploy this version"
   - Confirm the action

3. **Verify rollback:**
   - Wait for redeployment to complete
   - Access the application
   - Verify it matches the previous version

### Expected Results

- Rollback completes successfully
- Application reverts to previous state
- No data loss
- Rollback takes < 5 minutes

## Test 10: Test Build Failure Handling

### Steps

1. **Introduce a build error:**
   ```bash
   # Add a TypeScript error
   echo "const x: string = 123;" >> frontend/src/App.tsx
   git add .
   git commit -m "test: intentional build failure"
   git push origin main
   ```

2. **Monitor build failure:**
   - Watch build fail in Amplify Console
   - Review error logs

3. **Verify current deployment unchanged:**
   - Access the application URL
   - Verify it still shows the previous working version

4. **Fix the error:**
   ```bash
   git revert HEAD
   git push origin main
   ```

### Expected Results

- Build fails with clear error message
- Previous deployment remains active
- No downtime for users
- Error logs provide actionable information

## Verification Checklist

After completing all tests, verify:

- [ ] Builds trigger automatically on push to `main`
- [ ] Build succeeds without errors
- [ ] Application is accessible at Amplify URL
- [ ] Environment variables are injected correctly
- [ ] API calls work and return data
- [ ] All pages load correctly
- [ ] Admin functionality works
- [ ] Responsive design works on all screen sizes
- [ ] Performance meets targets (Lighthouse score ≥ 90)
- [ ] Feature branch deployments work
- [ ] Rollback functionality works
- [ ] Build failures don't affect current deployment

## Troubleshooting Resources

### Build Logs
- Location: Amplify Console → App → Branch → Build details
- Look for: Error messages, stack traces, failed commands

### Application Logs
- Browser Console: F12 → Console tab
- Network Tab: F12 → Network tab (for API calls)

### AWS Resources
- CloudWatch Logs: For Lambda function logs
- API Gateway: For API endpoint testing
- DynamoDB: For data verification

### Useful Commands

```bash
# Test API endpoint directly
curl https://your-api-gateway-url.amazonaws.com/prod/api/products

# Check DNS resolution
nslookup your-amplify-url.amplifyapp.com

# Test with different user agents
curl -A "Mozilla/5.0" https://your-amplify-url.amplifyapp.com

# View Amplify app details
aws amplify get-app --app-id <app-id>

# List all deployments
aws amplify list-jobs --app-id <app-id> --branch-name main
```

## Next Steps

After successful testing:

1. **Document the deployment URL** for team access
2. **Set up monitoring and alerts** (CloudWatch, Amplify notifications)
3. **Configure custom domain** (if applicable)
4. **Set up staging environment** (optional)
5. **Implement automated testing** in CI/CD pipeline
6. **Monitor performance** and optimize as needed

## Success Criteria

Your Amplify deployment is successful when:

✅ Builds complete without errors  
✅ Application is accessible and functional  
✅ Environment variables work correctly  
✅ API integration works  
✅ Performance meets targets  
✅ Responsive design works  
✅ Feature branches deploy to preview URLs  
✅ Rollback works when needed  

## Resources

- [AWS Amplify Troubleshooting](https://docs.aws.amazon.com/amplify/latest/userguide/troubleshooting.html)
- [Vite Build Troubleshooting](https://vitejs.dev/guide/troubleshooting.html)
- [Chrome DevTools Guide](https://developer.chrome.com/docs/devtools/)
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
