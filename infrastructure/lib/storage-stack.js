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
exports.StorageStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
class StorageStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create DynamoDB table for products
        this.productsTable = new dynamodb.Table(this, 'ProductsTable', {
            tableName: 'ProductsTable',
            partitionKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
        });
        // Add GSI for category queries
        this.productsTable.addGlobalSecondaryIndex({
            indexName: 'category-createdAt-index',
            partitionKey: {
                name: 'category',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'createdAt',
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Add GSI for published products
        this.productsTable.addGlobalSecondaryIndex({
            indexName: 'published-createdAt-index',
            partitionKey: {
                name: 'published',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'createdAt',
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Create S3 bucket for product images
        this.imagesBucket = new s3.Bucket(this, 'ProductImagesBucket', {
            bucketName: `pinterest-affiliate-images-${this.account}`,
            publicReadAccess: true,
            blockPublicAccess: new s3.BlockPublicAccess({
                blockPublicAcls: false,
                blockPublicPolicy: false,
                ignorePublicAcls: false,
                restrictPublicBuckets: false,
            }),
            cors: [
                {
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.POST,
                    ],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                    maxAge: 3000,
                },
            ],
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            encryption: s3.BucketEncryption.S3_MANAGED,
            // Add lifecycle rules for cache optimization
            lifecycleRules: [
                {
                    id: 'DeleteOldVersions',
                    noncurrentVersionExpiration: cdk.Duration.days(30),
                    enabled: true,
                },
            ],
        });
        // Create CloudFront distribution for image caching
        this.imagesCdn = new cloudfront.Distribution(this, 'ImagesCDN', {
            defaultBehavior: {
                origin: new origins.S3Origin(this.imagesBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                compress: true,
                cachePolicy: new cloudfront.CachePolicy(this, 'ImageCachePolicy', {
                    cachePolicyName: 'ProductImagesCachePolicy',
                    comment: 'Cache policy for product images with 24 hour TTL',
                    defaultTtl: cdk.Duration.hours(24),
                    minTtl: cdk.Duration.hours(1),
                    maxTtl: cdk.Duration.days(365),
                    enableAcceptEncodingGzip: true,
                    enableAcceptEncodingBrotli: true,
                    headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'),
                    queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
                }),
            },
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
            enabled: true,
            comment: 'CDN for Pinterest Affiliate Platform product images',
        });
        // Create Cognito User Pool for admin authentication
        this.userPool = new cognito.UserPool(this, 'AdminUserPool', {
            userPoolName: 'PinterestAffiliateAdmins',
            selfSignUpEnabled: false, // Only admins can create users
            signInAliases: {
                email: true,
                username: true,
            },
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
                givenName: {
                    required: false,
                    mutable: true,
                },
                familyName: {
                    required: false,
                    mutable: true,
                },
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // Create User Pool Client for the frontend
        this.userPoolClient = new cognito.UserPoolClient(this, 'AdminUserPoolClient', {
            userPool: this.userPool,
            userPoolClientName: 'PinterestAffiliateWebClient',
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            generateSecret: false, // No secret for public clients
            preventUserExistenceErrors: true,
        });
        // Create admin group
        new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
            userPoolId: this.userPool.userPoolId,
            groupName: 'Admins',
            description: 'Administrator users with full access',
            precedence: 1,
        });
        // Output the table name and bucket name
        new cdk.CfnOutput(this, 'ProductsTableName', {
            value: this.productsTable.tableName,
            description: 'DynamoDB Products Table Name',
            exportName: 'ProductsTableName',
        });
        new cdk.CfnOutput(this, 'ImagesBucketName', {
            value: this.imagesBucket.bucketName,
            description: 'S3 Images Bucket Name',
            exportName: 'ImagesBucketName',
        });
        new cdk.CfnOutput(this, 'ImagesBucketUrl', {
            value: this.imagesBucket.bucketWebsiteUrl,
            description: 'S3 Images Bucket URL',
            exportName: 'ImagesBucketUrl',
        });
        new cdk.CfnOutput(this, 'ImagesCdnDomain', {
            value: this.imagesCdn.distributionDomainName,
            description: 'CloudFront CDN Domain for Images',
            exportName: 'ImagesCdnDomain',
        });
        new cdk.CfnOutput(this, 'ImagesCdnUrl', {
            value: `https://${this.imagesCdn.distributionDomainName}`,
            description: 'CloudFront CDN URL for Images',
            exportName: 'ImagesCdnUrl',
        });
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID',
            exportName: 'UserPoolId',
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: this.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
            exportName: 'UserPoolClientId',
        });
    }
}
exports.StorageStack = StorageStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0b3JhZ2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLG1FQUFxRDtBQUNyRCx1REFBeUM7QUFDekMsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUM5RCxpRUFBbUQ7QUFHbkQsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFPekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixxQ0FBcUM7UUFDckMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM3RCxTQUFTLEVBQUUsZUFBZTtZQUMxQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxtQkFBbUIsRUFBRSxJQUFJO1lBQ3pCLFVBQVUsRUFBRSxRQUFRLENBQUMsZUFBZSxDQUFDLFdBQVc7U0FDakQsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUM7WUFDekMsU0FBUyxFQUFFLDBCQUEwQjtZQUNyQyxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElB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QUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCO1lBQ3pDLFdBQVcsRUFBRSxzQkFBc0I7WUFDbkMsVUFBVSxFQUFFLGlCQUFpQjtTQUM5QixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLHNCQUFzQjtZQUM1QyxXQUFXLEVBQUUsa0NBQWtDO1lBQy9DLFVBQVUsRUFBRSxpQkFBaUI7U0FDOUIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLFdBQVcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsRUFBRTtZQUN6RCxXQUFXLEVBQUUsK0JBQStCO1lBQzVDLFVBQVUsRUFBRSxjQUFjO1NBQzNCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVU7WUFDL0IsV0FBVyxFQUFFLHNCQUFzQjtZQUNuQyxVQUFVLEVBQUUsWUFBWTtTQUN6QixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLGdCQUFnQjtZQUMzQyxXQUFXLEVBQUUsNkJBQTZCO1lBQzFDLFVBQVUsRUFBRSxrQkFBa0I7U0FDL0IsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdE5ELG9DQXNOQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBTdG9yYWdlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgcHJvZHVjdHNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBpbWFnZXNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGltYWdlc0NkbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBEeW5hbW9EQiB0YWJsZSBmb3IgcHJvZHVjdHNcbiAgICB0aGlzLnByb2R1Y3RzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Byb2R1Y3RzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdQcm9kdWN0c1RhYmxlJyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnaWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIGNhdGVnb3J5IHF1ZXJpZXNcbiAgICB0aGlzLnByb2R1Y3RzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnY2F0ZWdvcnktY3JlYXRlZEF0LWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnY2F0ZWdvcnknLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjcmVhdGVkQXQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgcHVibGlzaGVkIHByb2R1Y3RzXG4gICAgdGhpcy5wcm9kdWN0c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ3B1Ymxpc2hlZC1jcmVhdGVkQXQtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdwdWJsaXNoZWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjcmVhdGVkQXQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFMzIGJ1Y2tldCBmb3IgcHJvZHVjdCBpbWFnZXNcbiAgICB0aGlzLmltYWdlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1Byb2R1Y3RJbWFnZXNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgcGludGVyZXN0LWFmZmlsaWF0ZS1pbWFnZXMtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IHRydWUsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogbmV3IHMzLkJsb2NrUHVibGljQWNjZXNzKHtcbiAgICAgICAgYmxvY2tQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLFxuICAgICAgICBpZ25vcmVQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgcmVzdHJpY3RQdWJsaWNCdWNrZXRzOiBmYWxzZSxcbiAgICAgIH0pLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBPU1QsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIG1heEFnZTogMzAwMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICAvLyBBZGQgbGlmZWN5Y2xlIHJ1bGVzIGZvciBjYWNoZSBvcHRpbWl6YXRpb25cbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZU9sZFZlcnNpb25zJyxcbiAgICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBmb3IgaW1hZ2UgY2FjaGluZ1xuICAgIHRoaXMuaW1hZ2VzQ2RuID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdJbWFnZXNDRE4nLCB7XG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbih0aGlzLmltYWdlc0J1Y2tldCksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgIGNhY2hlUG9saWN5OiBuZXcgY2xvdWRmcm9udC5DYWNoZVBvbGljeSh0aGlzLCAnSW1hZ2VDYWNoZVBvbGljeScsIHtcbiAgICAgICAgICBjYWNoZVBvbGljeU5hbWU6ICdQcm9kdWN0SW1hZ2VzQ2FjaGVQb2xpY3knLFxuICAgICAgICAgIGNvbW1lbnQ6ICdDYWNoZSBwb2xpY3kgZm9yIHByb2R1Y3QgaW1hZ2VzIHdpdGggMjQgaG91ciBUVEwnLFxuICAgICAgICAgIGRlZmF1bHRUdGw6IGNkay5EdXJhdGlvbi5ob3VycygyNCksXG4gICAgICAgICAgbWluVHRsOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgICAgbWF4VHRsOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgIGVuYWJsZUFjY2VwdEVuY29kaW5nR3ppcDogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVBY2NlcHRFbmNvZGluZ0Jyb3RsaTogdHJ1ZSxcbiAgICAgICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUhlYWRlckJlaGF2aW9yLmFsbG93TGlzdChcbiAgICAgICAgICAgICdPcmlnaW4nLFxuICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLVJlcXVlc3QtTWV0aG9kJyxcbiAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1SZXF1ZXN0LUhlYWRlcnMnXG4gICAgICAgICAgKSxcbiAgICAgICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlUXVlcnlTdHJpbmdCZWhhdmlvci5hbGwoKSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgICAgcHJpY2VDbGFzczogY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTXzEwMCwgLy8gVXNlIG9ubHkgTm9ydGggQW1lcmljYSBhbmQgRXVyb3BlXG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgY29tbWVudDogJ0NETiBmb3IgUGludGVyZXN0IEFmZmlsaWF0ZSBQbGF0Zm9ybSBwcm9kdWN0IGltYWdlcycsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ29nbml0byBVc2VyIFBvb2wgZm9yIGFkbWluIGF1dGhlbnRpY2F0aW9uXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdBZG1pblVzZXJQb29sJywge1xuICAgICAgdXNlclBvb2xOYW1lOiAnUGludGVyZXN0QWZmaWxpYXRlQWRtaW5zJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiBmYWxzZSwgLy8gT25seSBhZG1pbnMgY2FuIGNyZWF0ZSB1c2Vyc1xuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgdXNlcm5hbWU6IHRydWUsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBnaXZlbk5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZmFtaWx5TmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogOCxcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBVc2VyIFBvb2wgQ2xpZW50IGZvciB0aGUgZnJvbnRlbmRcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ0FkbWluVXNlclBvb2xDbGllbnQnLCB7XG4gICAgICB1c2VyUG9vbDogdGhpcy51c2VyUG9vbCxcbiAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogJ1BpbnRlcmVzdEFmZmlsaWF0ZVdlYkNsaWVudCcsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSwgLy8gTm8gc2VjcmV0IGZvciBwdWJsaWMgY2xpZW50c1xuICAgICAgcHJldmVudFVzZXJFeGlzdGVuY2VFcnJvcnM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgYWRtaW4gZ3JvdXBcbiAgICBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdBZG1pbkdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZ3JvdXBOYW1lOiAnQWRtaW5zJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW5pc3RyYXRvciB1c2VycyB3aXRoIGZ1bGwgYWNjZXNzJyxcbiAgICAgIHByZWNlZGVuY2U6IDEsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgdGhlIHRhYmxlIG5hbWUgYW5kIGJ1Y2tldCBuYW1lXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Byb2R1Y3RzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJvZHVjdHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIFByb2R1Y3RzIFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogJ1Byb2R1Y3RzVGFibGVOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJbWFnZXNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuaW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIEltYWdlcyBCdWNrZXQgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiAnSW1hZ2VzQnVja2V0TmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSW1hZ2VzQnVja2V0VXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuaW1hZ2VzQnVja2V0LmJ1Y2tldFdlYnNpdGVVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIEltYWdlcyBCdWNrZXQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdJbWFnZXNCdWNrZXRVcmwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ltYWdlc0NkbkRvbWFpbicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmltYWdlc0Nkbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IENETiBEb21haW4gZm9yIEltYWdlcycsXG4gICAgICBleHBvcnROYW1lOiAnSW1hZ2VzQ2RuRG9tYWluJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJbWFnZXNDZG5VcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLmltYWdlc0Nkbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgQ0ROIFVSTCBmb3IgSW1hZ2VzJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdJbWFnZXNDZG5VcmwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCcsXG4gICAgICBleHBvcnROYW1lOiAnVXNlclBvb2xJZCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgICBleHBvcnROYW1lOiAnVXNlclBvb2xDbGllbnRJZCcsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==