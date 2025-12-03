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
    userPool: storageStack.userPool,
});
// Add dependencies
backendStack.addDependency(storageStack);
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsd0RBQW9EO0FBQ3BELHdEQUFvRDtBQUVwRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixnQ0FBZ0M7QUFDaEMsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7SUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztDQUN0RCxDQUFDO0FBRUYseUNBQXlDO0FBQ3pDLE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsZ0NBQWdDLEVBQUU7SUFDM0UsR0FBRztJQUNILFdBQVcsRUFBRSx5REFBeUQ7Q0FDdkUsQ0FBQyxDQUFDO0FBRUgsZ0RBQWdEO0FBQ2hELE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsZ0NBQWdDLEVBQUU7SUFDM0UsR0FBRztJQUNILFdBQVcsRUFBRSx5REFBeUQ7SUFDdEUsYUFBYSxFQUFFLFlBQVksQ0FBQyxhQUFhO0lBQ3pDLFlBQVksRUFBRSxZQUFZLENBQUMsWUFBWTtJQUN2QyxRQUFRLEVBQUUsWUFBWSxDQUFDLFFBQVE7Q0FDaEMsQ0FBQyxDQUFDO0FBRUgsbUJBQW1CO0FBQ25CLFlBQVksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFekMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFN0b3JhZ2VTdGFjayB9IGZyb20gJy4uL2xpYi9zdG9yYWdlLXN0YWNrJztcbmltcG9ydCB7IEJhY2tlbmRTdGFjayB9IGZyb20gJy4uL2xpYi9iYWNrZW5kLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IGVudmlyb25tZW50IGNvbmZpZ3VyYXRpb25cbmNvbnN0IGVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXG59O1xuXG4vLyBDcmVhdGUgc3RvcmFnZSBzdGFjayAoRHluYW1vREIgYW5kIFMzKVxuY29uc3Qgc3RvcmFnZVN0YWNrID0gbmV3IFN0b3JhZ2VTdGFjayhhcHAsICdQaW50ZXJlc3RBZmZpbGlhdGVTdG9yYWdlU3RhY2snLCB7XG4gIGVudixcbiAgZGVzY3JpcHRpb246ICdTdG9yYWdlIGluZnJhc3RydWN0dXJlIGZvciBQaW50ZXJlc3QgQWZmaWxpYXRlIFBsYXRmb3JtJyxcbn0pO1xuXG4vLyBDcmVhdGUgYmFja2VuZCBzdGFjayAoTGFtYmRhIGFuZCBBUEkgR2F0ZXdheSlcbmNvbnN0IGJhY2tlbmRTdGFjayA9IG5ldyBCYWNrZW5kU3RhY2soYXBwLCAnUGludGVyZXN0QWZmaWxpYXRlQmFja2VuZFN0YWNrJywge1xuICBlbnYsXG4gIGRlc2NyaXB0aW9uOiAnQmFja2VuZCBpbmZyYXN0cnVjdHVyZSBmb3IgUGludGVyZXN0IEFmZmlsaWF0ZSBQbGF0Zm9ybScsXG4gIHByb2R1Y3RzVGFibGU6IHN0b3JhZ2VTdGFjay5wcm9kdWN0c1RhYmxlLFxuICBpbWFnZXNCdWNrZXQ6IHN0b3JhZ2VTdGFjay5pbWFnZXNCdWNrZXQsXG4gIHVzZXJQb29sOiBzdG9yYWdlU3RhY2sudXNlclBvb2wsXG59KTtcblxuLy8gQWRkIGRlcGVuZGVuY2llc1xuYmFja2VuZFN0YWNrLmFkZERlcGVuZGVuY3koc3RvcmFnZVN0YWNrKTtcblxuYXBwLnN5bnRoKCk7XG4iXX0=