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
        // Create DynamoDB table for creators
        this.creatorsTable = new dynamodb.Table(this, 'CreatorsTable', {
            tableName: 'CreatorsTable',
            partitionKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
        });
        // Add GSI for slug-based queries
        this.creatorsTable.addGlobalSecondaryIndex({
            indexName: 'slug-index',
            partitionKey: {
                name: 'slug',
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Add GSI for userId-based queries
        this.creatorsTable.addGlobalSecondaryIndex({
            indexName: 'userId-index',
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
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
        // Add GSI for creator-based product queries
        // TEMPORARILY COMMENTED - Will add incrementally
        // this.productsTable.addGlobalSecondaryIndex({
        //   indexName: 'creatorId-index',
        //   partitionKey: {
        //     name: 'creatorId',
        //     type: dynamodb.AttributeType.STRING,
        //   },
        //   sortKey: {
        //     name: 'createdAt',
        //     type: dynamodb.AttributeType.STRING,
        //   },
        //   projectionType: dynamodb.ProjectionType.ALL,
        // });
        // Add GSI for status-based product queries (for moderation)
        // TEMPORARILY COMMENTED - Will add incrementally
        // this.productsTable.addGlobalSecondaryIndex({
        //   indexName: 'status-index',
        //   partitionKey: {
        //     name: 'status',
        //     type: dynamodb.AttributeType.STRING,
        //   },
        //   sortKey: {
        //     name: 'createdAt',
        //     type: dynamodb.AttributeType.STRING,
        //   },
        //   projectionType: dynamodb.ProjectionType.ALL,
        // });
        // Create DynamoDB table for analytics events
        this.analyticsEventsTable = new dynamodb.Table(this, 'AnalyticsEventsTable', {
            tableName: 'AnalyticsEventsTable',
            partitionKey: {
                name: 'creatorId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            timeToLiveAttribute: 'ttl', // TTL for 90 days
        });
        // Create DynamoDB table for analytics summaries
        this.analyticsSummariesTable = new dynamodb.Table(this, 'AnalyticsSummariesTable', {
            tableName: 'AnalyticsSummariesTable',
            partitionKey: {
                name: 'creatorId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'date',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
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
        new cdk.CfnOutput(this, 'CreatorsTableName', {
            value: this.creatorsTable.tableName,
            description: 'DynamoDB Creators Table Name',
            exportName: 'CreatorsTableName',
        });
        new cdk.CfnOutput(this, 'AnalyticsEventsTableName', {
            value: this.analyticsEventsTable.tableName,
            description: 'DynamoDB Analytics Events Table Name',
            exportName: 'AnalyticsEventsTableName',
        });
        new cdk.CfnOutput(this, 'AnalyticsSummariesTableName', {
            value: this.analyticsSummariesTable.tableName,
            description: 'DynamoDB Analytics Summaries Table Name',
            exportName: 'AnalyticsSummariesTableName',
        });
    }
}
exports.StorageStack = StorageStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0b3JhZ2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLG1FQUFxRDtBQUNyRCx1REFBeUM7QUFDekMsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUM5RCxpRUFBbUQ7QUFHbkQsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFVekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixxQ0FBcUM7UUFDckMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM3RCxTQUFTLEVBQUUsZUFBZTtZQUMxQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxtQkFBbUIsRUFBRSxJQUFJO1lBQ3pCLFVBQVUsRUFBRSxRQUFRLENBQUMsZUFBZSxDQUFDLFdBQVc7U0FDakQsQ0FBQyxDQUFDO1FBRUgsaUNBQWlDO1FBQ2pDLElBQUksQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUM7WUFDekMsU0FBUyxFQUFFLFlBQVk7WUFDdkIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxNQUFNO2dCQUNaLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxjQUFjLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHO1NBQzVDLENB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RUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLGdCQUFnQjtZQUMzQyxXQUFXLEVBQUUsNkJBQTZCO1lBQzFDLFVBQVUsRUFBRSxrQkFBa0I7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO1lBQ25DLFdBQVcsRUFBRSw4QkFBOEI7WUFDM0MsVUFBVSxFQUFFLG1CQUFtQjtTQUNoQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2xELEtBQUssRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsU0FBUztZQUMxQyxXQUFXLEVBQUUsc0NBQXNDO1lBQ25ELFVBQVUsRUFBRSwwQkFBMEI7U0FDdkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUNyRCxLQUFLLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFNBQVM7WUFDN0MsV0FBVyxFQUFFLHlDQUF5QztZQUN0RCxVQUFVLEVBQUUsNkJBQTZCO1NBQzFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTdVRCxvQ0E2VUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgU3RvcmFnZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHByb2R1Y3RzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgY3JlYXRvcnNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBhbmFseXRpY3NFdmVudHNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBhbmFseXRpY3NTdW1tYXJpZXNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBpbWFnZXNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGltYWdlc0NkbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBEeW5hbW9EQiB0YWJsZSBmb3IgY3JlYXRvcnNcbiAgICB0aGlzLmNyZWF0b3JzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0NyZWF0b3JzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdDcmVhdG9yc1RhYmxlJyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnaWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHNsdWctYmFzZWQgcXVlcmllc1xuICAgIHRoaXMuY3JlYXRvcnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdzbHVnLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc2x1ZycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciB1c2VySWQtYmFzZWQgcXVlcmllc1xuICAgIHRoaXMuY3JlYXRvcnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICd1c2VySWQtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd1c2VySWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIER5bmFtb0RCIHRhYmxlIGZvciBwcm9kdWN0c1xuICAgIHRoaXMucHJvZHVjdHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUHJvZHVjdHNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ1Byb2R1Y3RzVGFibGUnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdpZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgY2F0ZWdvcnkgcXVlcmllc1xuICAgIHRoaXMucHJvZHVjdHNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdjYXRlZ29yeS1jcmVhdGVkQXQtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdjYXRlZ29yeScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2NyZWF0ZWRBdCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBwdWJsaXNoZWQgcHJvZHVjdHNcbiAgICB0aGlzLnByb2R1Y3RzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAncHVibGlzaGVkLWNyZWF0ZWRBdC1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3B1Ymxpc2hlZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2NyZWF0ZWRBdCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBjcmVhdG9yLWJhc2VkIHByb2R1Y3QgcXVlcmllc1xuICAgIC8vIFRFTVBPUkFSSUxZIENPTU1FTlRFRCAtIFdpbGwgYWRkIGluY3JlbWVudGFsbHlcbiAgICAvLyB0aGlzLnByb2R1Y3RzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgIC8vICAgaW5kZXhOYW1lOiAnY3JlYXRvcklkLWluZGV4JyxcbiAgICAvLyAgIHBhcnRpdGlvbktleToge1xuICAgIC8vICAgICBuYW1lOiAnY3JlYXRvcklkJyxcbiAgICAvLyAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgLy8gICB9LFxuICAgIC8vICAgc29ydEtleToge1xuICAgIC8vICAgICBuYW1lOiAnY3JlYXRlZEF0JyxcbiAgICAvLyAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgLy8gICB9LFxuICAgIC8vICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICAvLyB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHN0YXR1cy1iYXNlZCBwcm9kdWN0IHF1ZXJpZXMgKGZvciBtb2RlcmF0aW9uKVxuICAgIC8vIFRFTVBPUkFSSUxZIENPTU1FTlRFRCAtIFdpbGwgYWRkIGluY3JlbWVudGFsbHlcbiAgICAvLyB0aGlzLnByb2R1Y3RzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgIC8vICAgaW5kZXhOYW1lOiAnc3RhdHVzLWluZGV4JyxcbiAgICAvLyAgIHBhcnRpdGlvbktleToge1xuICAgIC8vICAgICBuYW1lOiAnc3RhdHVzJyxcbiAgICAvLyAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgLy8gICB9LFxuICAgIC8vICAgc29ydEtleToge1xuICAgIC8vICAgICBuYW1lOiAnY3JlYXRlZEF0JyxcbiAgICAvLyAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgLy8gICB9LFxuICAgIC8vICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICAvLyB9KTtcblxuICAgIC8vIENyZWF0ZSBEeW5hbW9EQiB0YWJsZSBmb3IgYW5hbHl0aWNzIGV2ZW50c1xuICAgIHRoaXMuYW5hbHl0aWNzRXZlbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0FuYWx5dGljc0V2ZW50c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnQW5hbHl0aWNzRXZlbnRzVGFibGUnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdjcmVhdG9ySWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLCAvLyBUVEwgZm9yIDkwIGRheXNcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBEeW5hbW9EQiB0YWJsZSBmb3IgYW5hbHl0aWNzIHN1bW1hcmllc1xuICAgIHRoaXMuYW5hbHl0aWNzU3VtbWFyaWVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0FuYWx5dGljc1N1bW1hcmllc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnQW5hbHl0aWNzU3VtbWFyaWVzVGFibGUnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdjcmVhdG9ySWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdkYXRlJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgUzMgYnVja2V0IGZvciBwcm9kdWN0IGltYWdlc1xuICAgIHRoaXMuaW1hZ2VzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUHJvZHVjdEltYWdlc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBwaW50ZXJlc3QtYWZmaWxpYXRlLWltYWdlcy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICBibG9ja1B1YmxpY1BvbGljeTogZmFsc2UsXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlLFxuICAgICAgfSksXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW1xuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuR0VULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUFVULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUE9TVCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIC8vIEFkZCBsaWZlY3ljbGUgcnVsZXMgZm9yIGNhY2hlIG9wdGltaXphdGlvblxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnRGVsZXRlT2xkVmVyc2lvbnMnLFxuICAgICAgICAgIG5vbmN1cnJlbnRWZXJzaW9uRXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGZvciBpbWFnZSBjYWNoaW5nXG4gICAgdGhpcy5pbWFnZXNDZG4gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0ltYWdlc0NETicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuaW1hZ2VzQnVja2V0KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgY2FjaGVQb2xpY3k6IG5ldyBjbG91ZGZyb250LkNhY2hlUG9saWN5KHRoaXMsICdJbWFnZUNhY2hlUG9saWN5Jywge1xuICAgICAgICAgIGNhY2hlUG9saWN5TmFtZTogJ1Byb2R1Y3RJbWFnZXNDYWNoZVBvbGljeScsXG4gICAgICAgICAgY29tbWVudDogJ0NhY2hlIHBvbGljeSBmb3IgcHJvZHVjdCBpbWFnZXMgd2l0aCAyNCBob3VyIFRUTCcsXG4gICAgICAgICAgZGVmYXVsdFR0bDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSxcbiAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgICBtYXhUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgZW5hYmxlQWNjZXB0RW5jb2RpbmdHemlwOiB0cnVlLFxuICAgICAgICAgIGVuYWJsZUFjY2VwdEVuY29kaW5nQnJvdGxpOiB0cnVlLFxuICAgICAgICAgIGhlYWRlckJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlSGVhZGVyQmVoYXZpb3IuYWxsb3dMaXN0KFxuICAgICAgICAgICAgJ09yaWdpbicsXG4gICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtUmVxdWVzdC1NZXRob2QnLFxuICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLVJlcXVlc3QtSGVhZGVycydcbiAgICAgICAgICApLFxuICAgICAgICAgIHF1ZXJ5U3RyaW5nQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVRdWVyeVN0cmluZ0JlaGF2aW9yLmFsbCgpLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMTAwLCAvLyBVc2Ugb25seSBOb3J0aCBBbWVyaWNhIGFuZCBFdXJvcGVcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBjb21tZW50OiAnQ0ROIGZvciBQaW50ZXJlc3QgQWZmaWxpYXRlIFBsYXRmb3JtIHByb2R1Y3QgaW1hZ2VzJyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDb2duaXRvIFVzZXIgUG9vbCBmb3IgYWRtaW4gYXV0aGVudGljYXRpb25cbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ0FkbWluVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6ICdQaW50ZXJlc3RBZmZpbGlhdGVBZG1pbnMnLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IGZhbHNlLCAvLyBPbmx5IGFkbWlucyBjYW4gY3JlYXRlIHVzZXJzXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICB1c2VybmFtZTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhdXRvVmVyaWZ5OiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGdpdmVuTmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2UsXG4gICAgICB9LFxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFVzZXIgUG9vbCBDbGllbnQgZm9yIHRoZSBmcm9udGVuZFxuICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnQWRtaW5Vc2VyUG9vbENsaWVudCcsIHtcbiAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiAnUGludGVyZXN0QWZmaWxpYXRlV2ViQ2xpZW50JyxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICB9LFxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLCAvLyBObyBzZWNyZXQgZm9yIHB1YmxpYyBjbGllbnRzXG4gICAgICBwcmV2ZW50VXNlckV4aXN0ZW5jZUVycm9yczogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBhZG1pbiBncm91cFxuICAgIG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgJ0FkbWluR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICdBZG1pbnMnLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbmlzdHJhdG9yIHVzZXJzIHdpdGggZnVsbCBhY2Nlc3MnLFxuICAgICAgcHJlY2VkZW5jZTogMSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCB0aGUgdGFibGUgbmFtZSBhbmQgYnVja2V0IG5hbWVcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJvZHVjdHNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wcm9kdWN0c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgUHJvZHVjdHMgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiAnUHJvZHVjdHNUYWJsZU5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ltYWdlc0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5pbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgSW1hZ2VzIEJ1Y2tldCBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdJbWFnZXNCdWNrZXROYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJbWFnZXNCdWNrZXRVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5pbWFnZXNCdWNrZXQuYnVja2V0V2Vic2l0ZVVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgSW1hZ2VzIEJ1Y2tldCBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogJ0ltYWdlc0J1Y2tldFVybCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSW1hZ2VzQ2RuRG9tYWluJywge1xuICAgICAgdmFsdWU6IHRoaXMuaW1hZ2VzQ2RuLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgQ0ROIERvbWFpbiBmb3IgSW1hZ2VzJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdJbWFnZXNDZG5Eb21haW4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ltYWdlc0NkblVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuaW1hZ2VzQ2RuLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBDRE4gVVJMIGZvciBJbWFnZXMnLFxuICAgICAgZXhwb3J0TmFtZTogJ0ltYWdlc0NkblVybCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdVc2VyUG9vbElkJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdVc2VyUG9vbENsaWVudElkJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDcmVhdG9yc1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNyZWF0b3JzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBDcmVhdG9ycyBUYWJsZSBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdDcmVhdG9yc1RhYmxlTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQW5hbHl0aWNzRXZlbnRzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuYW5hbHl0aWNzRXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBBbmFseXRpY3MgRXZlbnRzIFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogJ0FuYWx5dGljc0V2ZW50c1RhYmxlTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQW5hbHl0aWNzU3VtbWFyaWVzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuYW5hbHl0aWNzU3VtbWFyaWVzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBBbmFseXRpY3MgU3VtbWFyaWVzIFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogJ0FuYWx5dGljc1N1bW1hcmllc1RhYmxlTmFtZScsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==