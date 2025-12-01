# AWS SES Sandbox Mode Guide

## Current Status
- **SES Mode**: Sandbox (limited to verified emails only)
- **Domain**: koufobunch.com (verified ✅)
- **Sender Email**: noreply@koufobunch.com

## How to Create Users in Sandbox Mode

### Step 1: Verify the Email Address
Before creating a user, verify their email address in SES:

```bash
aws ses verify-email-identity --email-address USER_EMAIL@example.com --profile default
```

### Step 2: Check Email for Verification Link
The user will receive an email from AWS SES with a verification link. They must click it.

### Step 3: Verify Email is Confirmed
```bash
aws ses get-identity-verification-attributes --identities USER_EMAIL@example.com --profile default
```

Look for `"VerificationStatus": "Success"`

### Step 4: Create User in Admin Portal
Now you can create the user through the admin portal with "Send email invitation" checked.

## Moving to Production Mode

To send emails to any address without verification:

1. **Request Production Access**:
   - Go to AWS SES Console
   - Navigate to "Account dashboard"
   - Click "Request production access"
   - Fill out the form explaining your use case
   - AWS typically approves within 24 hours

2. **Benefits of Production Mode**:
   - Send to any email address
   - Higher sending limits
   - No need to verify recipient emails

## Verified Emails

Currently verified:
- skoufoudakis+affiliatetest2@gmail.com ✅
- skoufoudakis+affiliatetest3@gmail.com (pending - check email)
- skoufoudakis+affiliate4@gmail.com (pending - check email)
- skoufoudakis+affiliate5@gmail.com (pending - check email)

## Quick Verification Script

To verify multiple emails at once:

```bash
# Verify multiple emails
for email in "email1@example.com" "email2@example.com"; do
  aws ses verify-email-identity --email-address "$email" --profile default
  echo "Verification email sent to $email"
done
```

## Troubleshooting

### Email Not Received
- Check spam folder
- Verify the email address is correct
- Wait a few minutes and try again

### "Email address is not verified" Error
- The recipient email hasn't been verified in SES
- Follow Step 1-3 above before creating the user

### Check Current Verification Status
```bash
aws ses list-identities --profile default
aws ses get-identity-verification-attributes --identities $(aws ses list-identities --profile default --query 'Identities[*]' --output text) --profile default
```
