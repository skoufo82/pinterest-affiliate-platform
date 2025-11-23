#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const storage_stack_1 = require("../lib/storage-stack");
const backend_stack_1 = require("../lib/backend-stack");
const app = new cdk.App();
// Get environment configuration
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};
// Create storage stack (DynamoDB and S3)
const storageStack = new storage_stack_1.StorageStack(app, 'PinterestAffiliateStorageStack', {
    env,
    description: 'Storage infrastructure for Pinterest Affiliate Platform',
});
// Create backend stack (Lambda and API Gateway)
const backendStack = new backend_stack_1.BackendStack(app, 'PinterestAffiliateBackendStack', {
    env,
    description: 'Backend infrastructure for Pinterest Affiliate Platform',
    productsTable: storageStack.productsTable,
    imagesBucket: storageStack.imagesBucket,
});
// Add dependencies
backendStack.addDependency(storageStack);
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsd0RBQW9EO0FBQ3BELHdEQUFvRDtBQUVwRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixnQ0FBZ0M7QUFDaEMsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7SUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztDQUN0RCxDQUFDO0FBRUYseUNBQXlDO0FBQ3pDLE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsZ0NBQWdDLEVBQUU7SUFDM0UsR0FBRztJQUNILFdBQVcsRUFBRSx5REFBeUQ7Q0FDdkUsQ0FBQyxDQUFDO0FBRUgsZ0RBQWdEO0FBQ2hELE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsZ0NBQWdDLEVBQUU7SUFDM0UsR0FBRztJQUNILFdBQVcsRUFBRSx5REFBeUQ7SUFDdEUsYUFBYSxFQUFFLFlBQVksQ0FBQyxhQUFhO0lBQ3pDLFlBQVksRUFBRSxZQUFZLENBQUMsWUFBWTtDQUN4QyxDQUFDLENBQUM7QUFFSCxtQkFBbUI7QUFDbkIsWUFBWSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUV6QyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgU3RvcmFnZVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0b3JhZ2Utc3RhY2snO1xuaW1wb3J0IHsgQmFja2VuZFN0YWNrIH0gZnJvbSAnLi4vbGliL2JhY2tlbmQtc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBHZXQgZW52aXJvbm1lbnQgY29uZmlndXJhdGlvblxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJyxcbn07XG5cbi8vIENyZWF0ZSBzdG9yYWdlIHN0YWNrIChEeW5hbW9EQiBhbmQgUzMpXG5jb25zdCBzdG9yYWdlU3RhY2sgPSBuZXcgU3RvcmFnZVN0YWNrKGFwcCwgJ1BpbnRlcmVzdEFmZmlsaWF0ZVN0b3JhZ2VTdGFjaycsIHtcbiAgZW52LFxuICBkZXNjcmlwdGlvbjogJ1N0b3JhZ2UgaW5mcmFzdHJ1Y3R1cmUgZm9yIFBpbnRlcmVzdCBBZmZpbGlhdGUgUGxhdGZvcm0nLFxufSk7XG5cbi8vIENyZWF0ZSBiYWNrZW5kIHN0YWNrIChMYW1iZGEgYW5kIEFQSSBHYXRld2F5KVxuY29uc3QgYmFja2VuZFN0YWNrID0gbmV3IEJhY2tlbmRTdGFjayhhcHAsICdQaW50ZXJlc3RBZmZpbGlhdGVCYWNrZW5kU3RhY2snLCB7XG4gIGVudixcbiAgZGVzY3JpcHRpb246ICdCYWNrZW5kIGluZnJhc3RydWN0dXJlIGZvciBQaW50ZXJlc3QgQWZmaWxpYXRlIFBsYXRmb3JtJyxcbiAgcHJvZHVjdHNUYWJsZTogc3RvcmFnZVN0YWNrLnByb2R1Y3RzVGFibGUsXG4gIGltYWdlc0J1Y2tldDogc3RvcmFnZVN0YWNrLmltYWdlc0J1Y2tldCxcbn0pO1xuXG4vLyBBZGQgZGVwZW5kZW5jaWVzXG5iYWNrZW5kU3RhY2suYWRkRGVwZW5kZW5jeShzdG9yYWdlU3RhY2spO1xuXG5hcHAuc3ludGgoKTtcbiJdfQ==