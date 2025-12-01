---
inclusion: always
---

# AWS SSO Configuration

This project uses AWS SSO for authentication to AWS services.

## SSO Configuration Details

- **SSO Start URL**: https://d-9066102a9d.awsapps.com/start/
- **SSO Username**: skoufoadm
- **AWS Account ID**: 788222620487
- **Default Region**: us-east-1
- **Profile Name**: default

## Setting Up AWS SSO

To configure AWS SSO for this project, run:

```bash
aws configure sso --profile default
```

When prompted, use these values:
- SSO session name: pinterest-affiliate
- SSO start URL: https://d-9066102a9d.awsapps.com/start/
- SSO region: us-east-1
- SSO registration scopes: sso:account:access
- CLI default client Region: us-east-1
- CLI default output format: json

## AWS CLI Version Conflict

This system has both AWS CLI v1 and v2 installed. Always use v2 for SSO:

```bash
# Use AWS CLI v2 directly
/usr/local/bin/aws sso login --profile default

# Or create an alias (add to ~/.zshrc or ~/.bashrc)
alias aws='/usr/local/bin/aws'
```

## Logging In

When your session expires, reauthenticate with:

```bash
/usr/local/bin/aws sso login --profile default
```

This will open a browser window for authentication.

## Verifying Authentication

Check your current authentication status:

```bash
aws sts get-caller-identity --profile default
```

## Deployment Commands

When deploying infrastructure, ensure you're authenticated:

```bash
# Deploy all stacks
cd infrastructure
npx cdk deploy --all --profile default

# Deploy specific stack
npx cdk deploy PinterestAffiliateBackendStack --profile default
```

## Building Backend Before Deployment

Always build the backend before deploying:

```bash
cd backend
npm run build
# Or use the build script
chmod +x build.sh
./build.sh
```
