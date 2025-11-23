#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { BackendStack } from '../lib/backend-stack';

const app = new cdk.App();

// Get environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create storage stack (DynamoDB and S3)
const storageStack = new StorageStack(app, 'PinterestAffiliateStorageStack', {
  env,
  description: 'Storage infrastructure for Pinterest Affiliate Platform',
});

// Create backend stack (Lambda and API Gateway)
const backendStack = new BackendStack(app, 'PinterestAffiliateBackendStack', {
  env,
  description: 'Backend infrastructure for Pinterest Affiliate Platform',
  productsTable: storageStack.productsTable,
  imagesBucket: storageStack.imagesBucket,
});

// Add dependencies
backendStack.addDependency(storageStack);

app.synth();
