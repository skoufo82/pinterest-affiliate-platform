#!/bin/bash

# SES Email Verification Helper Script
# Usage: ./verify-email.sh email@example.com

if [ -z "$1" ]; then
    echo "Usage: ./verify-email.sh email@example.com"
    exit 1
fi

EMAIL=$1

echo "🔐 Verifying email address: $EMAIL"
echo ""

# Send verification email
aws ses verify-email-identity --email-address "$EMAIL" --profile default

if [ $? -eq 0 ]; then
    echo "✅ Verification email sent to: $EMAIL"
    echo ""
    echo "📧 Next steps:"
    echo "   1. Check the inbox for $EMAIL"
    echo "   2. Click the verification link in the email from AWS"
    echo "   3. Wait a few seconds for verification to complete"
    echo ""
    echo "To check verification status, run:"
    echo "   aws ses get-identity-verification-attributes --identities $EMAIL --profile default"
else
    echo "❌ Failed to send verification email"
    exit 1
fi
