#!/bin/bash

# AWS SSO Setup Script for Pinterest Affiliate Platform

echo "==================================="
echo "AWS SSO Configuration Setup"
echo "==================================="
echo ""

# Create AWS config directory
mkdir -p ~/.aws

# SSO Configuration
SSO_START_URL="https://d-9066102a9d.awsapps.com/start"
SSO_REGION="us-east-1"  # Default, change if needed

echo "Please provide the following information:"
echo ""

# Get AWS Account ID
read -p "Enter your AWS Account ID (12 digits): " ACCOUNT_ID

# Get SSO Role Name
echo ""
echo "Common role names: AdministratorAccess, PowerUserAccess, DeveloperAccess"
read -p "Enter your SSO Role Name: " ROLE_NAME

# Get preferred region
read -p "Enter your preferred AWS region (default: us-east-1): " REGION
REGION=${REGION:-us-east-1}

# Get profile name
read -p "Enter profile name (default: default): " PROFILE_NAME
PROFILE_NAME=${PROFILE_NAME:-default}

# Create AWS config file
cat > ~/.aws/config << EOF
[profile $PROFILE_NAME]
sso_start_url = $SSO_START_URL
sso_region = $SSO_REGION
sso_account_id = $ACCOUNT_ID
sso_role_name = $ROLE_NAME
region = $REGION
output = json
EOF

echo ""
echo "✓ AWS SSO configuration created!"
echo ""
echo "Configuration saved to: ~/.aws/config"
echo ""
echo "Next steps:"
echo "1. Install AWS CLI v2 (required for SSO):"
echo "   curl 'https://awscli.amazonaws.com/AWSCLIV2.pkg' -o 'AWSCLIV2.pkg'"
echo "   sudo installer -pkg AWSCLIV2.pkg -target /"
echo ""
echo "2. Login to AWS SSO:"
echo "   aws sso login --profile $PROFILE_NAME"
echo ""
echo "3. Verify your credentials:"
echo "   aws sts get-caller-identity --profile $PROFILE_NAME"
echo ""
echo "4. Set as default profile (optional):"
echo "   export AWS_PROFILE=$PROFILE_NAME"
echo ""
