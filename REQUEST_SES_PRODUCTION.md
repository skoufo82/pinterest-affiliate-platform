# Request AWS SES Production Access

## Why You Need This
Currently in sandbox mode, you must verify every recipient email before sending. Production mode lets you send to ANY email address without verification.

## How to Request (Takes 5 Minutes)

### Option 1: AWS Console (Easiest)
1. Go to: https://console.aws.amazon.com/ses/home?region=us-east-1#/account
2. Click **"Request production access"** button
3. Fill out the form:

**Use Case Details:**
```
Mail Type: Transactional
Website URL: https://www.koufobunch.com
Use Case Description: 
We are sending transactional emails for our affiliate marketing platform admin portal. 
Specifically, we send welcome emails with login credentials when administrators create 
new user accounts. These are one-time transactional emails sent only when explicitly 
requested by an administrator.

Expected sending volume: Less than 10 emails per day initially.
```

**Additional Information:**
```
Process for handling bounces and complaints:
- We only send to verified business email addresses
- We maintain a suppression list for any bounces
- We include unsubscribe links in all emails
- We monitor bounce rates and complaint rates daily

Compliance:
- All emails are opt-in (admin-initiated)
- We comply with CAN-SPAM and GDPR
- Clear sender identification (noreply@koufobunch.com)
```

4. Click **Submit**
5. AWS typically approves within **24 hours** (often much faster)

### Option 2: AWS CLI
```bash
aws sesv2 put-account-details \
  --profile default \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url https://www.koufobunch.com \
  --use-case-description "Sending transactional welcome emails with login credentials for admin portal users. Low volume (less than 10 emails/day). All emails are admin-initiated and transactional in nature." \
  --additional-contact-email-addresses skoufoudakis@gmail.com
```

## What Happens After Approval

✅ **Immediate Benefits:**
- Send to ANY email address (no verification needed)
- Higher sending limits (50,000 emails/day)
- Better deliverability
- No more sandbox restrictions

## Timeline
- **Submission**: 5 minutes
- **AWS Review**: Usually 1-24 hours
- **Approval**: Automatic email notification

## Check Status
```bash
aws sesv2 get-account --profile default --query 'ProductionAccessEnabled'
```

Or check in console: https://console.aws.amazon.com/ses/home?region=us-east-1#/account

## After Approval
No code changes needed! Just:
1. Wait for approval email
2. Start creating users normally
3. Emails will work for any address

## Tips for Faster Approval
- Be honest about sending volume
- Explain it's transactional (not marketing)
- Mention you have bounce/complaint handling
- Include your website URL
- Use a business email if possible
