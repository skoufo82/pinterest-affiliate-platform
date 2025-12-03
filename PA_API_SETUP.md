# Amazon Product Advertising API Setup Guide

This guide explains how to set up Amazon Product Advertising API (PA-API) credentials for the automated price synchronization feature.

## Prerequisites

1. **Amazon Associates Account**
   - You must have an active Amazon Associates account
   - Your account must have at least 3 qualifying sales in the last 180 days
   - Without qualifying sales, PA-API access will be revoked after 30 days

2. **PA-API Credentials**
   - Access Key
   - Secret Key
   - Associate Tag (Partner Tag)

## Getting PA-API Credentials

1. Log in to [Amazon Associates Central](https://affiliate-program.amazon.com/)
2. Navigate to **Tools** → **Product Advertising API**
3. Click **Add Credentials** or view existing credentials
4. Note down:
   - Access Key
   - Secret Key (shown only once - save it securely)
   - Your Associate Tag (e.g., `yoursite-20`)

## Setting Up Credentials in AWS

### Option 1: Using AWS Console

1. Open the [AWS Systems Manager Console](https://console.aws.amazon.com/systems-manager/)
2. Navigate to **Parameter Store** in the left sidebar
3. Update the following parameters with your actual credentials:

   - **Parameter Name**: `/amazon-affiliate/pa-api/access-key`
     - **Type**: String
     - **Value**: Your PA-API Access Key

   - **Parameter Name**: `/amazon-affiliate/pa-api/secret-key`
     - **Type**: SecureString (recommended) or String
     - **Value**: Your PA-API Secret Key

   - **Parameter Name**: `/amazon-affiliate/pa-api/partner-tag`
     - **Type**: String
     - **Value**: Your Amazon Associates Tag (e.g., `yoursite-20`)

   - **Parameter Name**: `/amazon-affiliate/pa-api/marketplace`
     - **Type**: String
     - **Value**: `www.amazon.com` (or your marketplace domain)

### Option 2: Using AWS CLI

```bash
# Set PA-API Access Key
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/access-key" \
  --value "YOUR_ACCESS_KEY" \
  --type String \
  --overwrite \
  --profile default

# Set PA-API Secret Key (using SecureString for encryption)
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/secret-key" \
  --value "YOUR_SECRET_KEY" \
  --type SecureString \
  --overwrite \
  --profile default

# Set Partner Tag
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/partner-tag" \
  --value "yoursite-20" \
  --type String \
  --overwrite \
  --profile default

# Set Marketplace (optional - defaults to US)
aws ssm put-parameter \
  --name "/amazon-affiliate/pa-api/marketplace" \
  --value "www.amazon.com" \
  --type String \
  --overwrite \
  --profile default
```

## Verifying Setup

After setting up the credentials, verify they are accessible:

```bash
# List all PA-API parameters
aws ssm get-parameters-by-path \
  --path "/amazon-affiliate/pa-api/" \
  --profile default

# Get a specific parameter (non-secure)
aws ssm get-parameter \
  --name "/amazon-affiliate/pa-api/access-key" \
  --profile default

# Get a secure parameter (decrypted)
aws ssm get-parameter \
  --name "/amazon-affiliate/pa-api/secret-key" \
  --with-decryption \
  --profile default
```

## Setting Up SNS Alerts

To receive notifications when price sync errors occur:

1. Open the [AWS SNS Console](https://console.aws.amazon.com/sns/)
2. Find the topic: `pinterest-affiliate-price-sync-alerts`
3. Click **Create subscription**
4. Choose protocol:
   - **Email**: Enter your email address
   - **SMS**: Enter your phone number
   - **Lambda**: Connect to a Lambda function for custom handling
5. Confirm the subscription (check your email for confirmation link)

## Testing PA-API Access

You can test your PA-API credentials using the AWS CLI or by triggering a manual sync once the Lambda function is deployed.

## Security Best Practices

1. **Use SecureString for Secret Key**: Always use SecureString type for the secret key parameter
2. **Rotate Credentials Regularly**: Change your PA-API credentials periodically
3. **Monitor Access**: Use CloudTrail to monitor Parameter Store access
4. **Restrict IAM Permissions**: Only grant Parameter Store access to necessary Lambda functions
5. **Never Commit Credentials**: Never commit credentials to version control

## Troubleshooting

### Authentication Errors (401)

- Verify your Access Key and Secret Key are correct
- Check if your Amazon Associates account is in good standing
- Ensure you have at least 3 qualifying sales in the last 180 days

### Rate Limit Errors (429)

- PA-API has a default limit of 1 request per second
- The system implements automatic retry with exponential backoff
- Consider requesting higher rate limits from Amazon if needed

### Parameter Not Found

- Verify parameter names match exactly (case-sensitive)
- Check the AWS region matches your deployment region
- Ensure the Lambda execution role has `ssm:GetParameter` permissions

## Additional Resources

- [PA-API 5.0 Documentation](https://webservices.amazon.com/paapi5/documentation/)
- [Amazon Associates Program](https://affiliate-program.amazon.com/)
- [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
