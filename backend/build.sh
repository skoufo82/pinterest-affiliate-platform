#!/bin/bash

# Build script for backend Lambda functions
echo "Building backend Lambda functions..."

# Clean dist folder
rm -rf dist
mkdir -p dist

# Compile TypeScript
echo "Compiling TypeScript..."
npm run build

# Install production dependencies
echo "Installing production dependencies..."
cd dist

# Create package.json with dependencies from parent
cat > package.json << 'EOF'
{
  "name": "backend-dist",
  "version": "1.0.0",
  "dependencies": {
    "@aws-sdk/client-cognito-identity-provider": "^3.0.0",
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "uuid": "^9.0.0"
  }
}
EOF

# Install dependencies
npm install --production --no-package-lock --no-audit --no-fund 2>&1 | grep -v "npm warn"

cd ..

echo "Build complete!"
echo "Dist size: $(du -sh dist | cut -f1)"
