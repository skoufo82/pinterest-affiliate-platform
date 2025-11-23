# Amplify Authentication Setup

## ✅ Phase 2 Complete - Frontend Authentication Deployed

Your authentication system is now deployed! Here's what you need to do to make it work on Amplify.

## Add Environment Variables to Amplify

1. **Go to Amplify Console**:
   ```
   https://console.aws.amazon.com/amplify/home?region=us-east-1
   ```

2. **Select your app**: `pinterest-affiliate-platform`

3. **Go to Environment variables**:
   - Click "Environment variables" in the left sidebar
   - Or go to: App settings → Environment variables

4. **Add these variables**:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_BASE_URL` | `https://u0xet1m9p1.execute-api.us-east-1.amazonaws.com/prod` |
   | `VITE_USER_POOL_ID` | `us-east-1_dgrSfYa3L` |
   | `VITE_USER_POOL_CLIENT_ID` | `5flaqgdb6is8mn2vsi7bos2ric` |
   | `VITE_USER_POOL_REGION` | `us-east-1` |

5. **Save and Redeploy**:
   - Click "Save"
   - Amplify will automatically trigger a new build
   - Wait 3-5 minutes for deployment

## Testing Your Authentication

### 1. Access the Login Page

Visit: https://koufobunch.com/login

### 2. Login with Admin Credentials

```
Username: admin
Password: Admin123!
```

### 3. Verify Protected Routes

After login, you should be able to access:
- https://koufobunch.com/admin
- https://koufobunch.com/admin/products
- https://koufobunch.com/admin/products/new

### 4. Test Logout

Click the "Logout" button in the admin sidebar.

## What's New

### Authentication Features
- ✅ Login page with Cognito integration
- ✅ JWT token-based API authentication
- ✅ Protected admin routes
- ✅ Automatic token refresh
- ✅ Logout functionality
- ✅ User info display in sidebar

### Security
- ✅ All admin endpoints require authentication
- ✅ JWT tokens automatically included in API requests
- ✅ Session management with Cognito
- ✅ Secure password policies enforced

### User Experience
- ✅ Redirect to login if not authenticated
- ✅ Return to intended page after login
- ✅ Loading states during authentication
- ✅ Clear error messages
- ✅ Mobile-responsive login page

## Creating Additional Users

### Option 1: Via AWS Console

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_dgrSfYa3L \
  --username newuser \
  --user-attributes Name=email,Value=user@koufobunch.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_dgrSfYa3L \
  --username newuser \
  --group-name Admins

aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_dgrSfYa3L \
  --username newuser \
  --password NewUser123! \
  --permanent
```

### Option 2: Via User Management UI (Coming Next)

We'll add a user management interface in the admin dashboard where you can:
- Create new users
- List all users
- Delete users
- Reset passwords

## Troubleshooting

### "Cannot read properties of undefined" Error

**Cause**: Environment variables not set in Amplify

**Solution**:
1. Add all 4 environment variables in Amplify Console
2. Redeploy the app
3. Clear browser cache

### Login Fails with "User Pool ID is undefined"

**Cause**: Environment variables not loaded

**Solution**:
1. Check Amplify Console → Environment variables
2. Ensure all variables are saved
3. Trigger a new deployment
4. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

### "Unauthorized" Error on Admin Pages

**Cause**: JWT token not being sent or expired

**Solution**:
1. Logout and login again
2. Check browser console for errors
3. Verify API Gateway authorizer is configured

### Admin Dashboard Shows "Loading..." Forever

**Cause**: Authentication check stuck

**Solution**:
1. Clear browser localStorage
2. Clear cookies for koufobunch.com
3. Try incognito/private browsing mode
4. Check browser console for errors

### CORS Errors

**Cause**: API Gateway CORS not configured for authenticated requests

**Solution**: Already configured in CDK, but if issues persist:
1. Check API Gateway CORS settings
2. Ensure Authorization header is allowed
3. Redeploy backend: `cd infrastructure && cdk deploy`

## Next Steps

### Phase 3: User Management UI (Optional)

Would you like to add a user management interface? This would allow you to:
- Create new admin users from the dashboard
- View all users and their roles
- Delete users
- Reset user passwords
- All without using AWS Console

This would take approximately 1-2 hours to implement.

### Alternative: Use AWS Console

You can manage users directly in AWS Cognito Console:
```
https://console.aws.amazon.com/cognito/users/?region=us-east-1#/pool/us-east-1_dgrSfYa3L/users
```

## Current Status

### ✅ Completed
- Cognito User Pool created
- Admin user created
- User management Lambda functions deployed
- API Gateway protected with Cognito
- Frontend authentication implemented
- Login page created
- Protected routes configured
- Logout functionality added
- Code pushed to GitHub

### 🚀 Ready to Deploy
- Amplify will auto-deploy from GitHub
- Add environment variables in Amplify Console
- Test login at https://koufobunch.com/login

### ⏳ Optional Next Steps
- User management UI in admin dashboard
- Password change functionality
- User profile page
- Email notifications for new users

## Important Notes

### Breaking Changes
- **Admin dashboard now requires login**
- All admin API endpoints require JWT token
- Public product viewing still works without auth

### Security Best Practices
- Change default admin password after first login
- Create separate users for different administrators
- Regularly review user access
- Monitor CloudWatch logs for suspicious activity

### Credentials

**Admin User**
- Username: `admin`
- Password: `Admin123!`
- Email: `admin@koufobunch.com`

**Cognito Details**
- User Pool ID: `us-east-1_dgrSfYa3L`
- Client ID: `5flaqgdb6is8mn2vsi7bos2ric`
- Region: `us-east-1`

---

**Status**: Phase 2 Complete ✅ | Ready for Amplify Deployment 🚀

Once you add the environment variables to Amplify, your authentication system will be fully operational!
