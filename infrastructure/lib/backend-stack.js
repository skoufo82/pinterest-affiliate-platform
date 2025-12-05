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
exports.BackendStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const events_targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const path = __importStar(require("path"));
class BackendStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { productsTable, creatorsTable, analyticsEventsTable, analyticsSummariesTable, imagesBucket, userPool } = props;
        // Create SNS topic for price sync alerts
        this.priceSyncAlertTopic = new sns.Topic(this, 'PriceSyncAlertTopic', {
            topicName: 'pinterest-affiliate-price-sync-alerts',
            displayName: 'Amazon Price Sync Alerts',
        });
        // Create Parameter Store parameters for PA-API credentials
        // Note: These are placeholders - actual values must be set manually via AWS Console or CLI
        new ssm.StringParameter(this, 'PAAPIAccessKey', {
            parameterName: '/amazon-affiliate/pa-api/access-key',
            stringValue: 'PLACEHOLDER_ACCESS_KEY',
            description: 'Amazon Product Advertising API Access Key',
            tier: ssm.ParameterTier.STANDARD,
        });
        new ssm.StringParameter(this, 'PAAPISecretKey', {
            parameterName: '/amazon-affiliate/pa-api/secret-key',
            stringValue: 'PLACEHOLDER_SECRET_KEY',
            description: 'Amazon Product Advertising API Secret Key',
            tier: ssm.ParameterTier.STANDARD,
        });
        new ssm.StringParameter(this, 'PAAPIPartnerTag', {
            parameterName: '/amazon-affiliate/pa-api/partner-tag',
            stringValue: 'PLACEHOLDER_PARTNER_TAG',
            description: 'Amazon Associates Partner Tag',
            tier: ssm.ParameterTier.STANDARD,
        });
        new ssm.StringParameter(this, 'PAAPIMarketplace', {
            parameterName: '/amazon-affiliate/pa-api/marketplace',
            stringValue: 'www.amazon.com',
            description: 'Amazon Marketplace (default: US)',
            tier: ssm.ParameterTier.STANDARD,
        });
        // Create IAM role for Lambda functions
        const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Grant DynamoDB permissions
        productsTable.grantReadWriteData(lambdaRole);
        creatorsTable.grantReadWriteData(lambdaRole);
        analyticsEventsTable.grantReadWriteData(lambdaRole);
        analyticsSummariesTable.grantReadWriteData(lambdaRole);
        // Grant S3 permissions
        imagesBucket.grantReadWrite(lambdaRole);
        // Grant Cognito permissions for user management
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminDeleteUser',
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:AdminSetUserPassword',
                'cognito-idp:AdminAddUserToGroup',
                'cognito-idp:AdminRemoveUserFromGroup',
                'cognito-idp:AdminListGroupsForUser',
                'cognito-idp:ListUsers',
                'cognito-idp:ListUsersInGroup',
            ],
            resources: [userPool.userPoolArn],
        }));
        // Grant SES permissions for sending emails
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ses:SendEmail',
                'ses:SendRawEmail',
            ],
            resources: ['*'], // SES requires * for email sending
        }));
        // Grant Parameter Store permissions for PA-API credentials
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
            ],
            resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/amazon-affiliate/*`,
            ],
        }));
        // Grant SNS permissions for price sync alerts
        this.priceSyncAlertTopic.grantPublish(lambdaRole);
        // Grant CloudWatch permissions for custom metrics
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cloudwatch:PutMetricData',
            ],
            resources: ['*'], // CloudWatch metrics require * resource
        }));
        // Common Lambda environment variables
        const commonEnvironment = {
            PRODUCTS_TABLE_NAME: productsTable.tableName,
            CREATORS_TABLE_NAME: creatorsTable.tableName,
            ANALYTICS_EVENTS_TABLE_NAME: analyticsEventsTable.tableName,
            ANALYTICS_SUMMARIES_TABLE_NAME: analyticsSummariesTable.tableName,
            IMAGES_BUCKET_NAME: imagesBucket.bucketName,
            USER_POOL_ID: userPool.userPoolId,
            REGION: this.region,
        };
        // Common Lambda configuration
        const lambdaConfig = {
            runtime: lambda.Runtime.NODEJS_18_X,
            role: lambdaRole,
            environment: commonEnvironment,
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
        };
        // Create Lambda functions - using compiled dist folder
        const getProductsFunction = new lambda.Function(this, 'GetProductsFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-getProducts',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/getProducts/index.handler',
            description: 'Get all products with optional category filtering',
        });
        const getProductFunction = new lambda.Function(this, 'GetProductFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-getProduct',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/getProduct/index.handler',
            description: 'Get a single product by ID',
        });
        const createProductFunction = new lambda.Function(this, 'CreateProductFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-createProduct',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/createProduct/index.handler',
            description: 'Create a new product',
        });
        const updateProductFunction = new lambda.Function(this, 'UpdateProductFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-updateProduct',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/updateProduct/index.handler',
            description: 'Update an existing product',
        });
        const deleteProductFunction = new lambda.Function(this, 'DeleteProductFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-deleteProduct',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/deleteProduct/index.handler',
            description: 'Delete a product',
        });
        const uploadImageFunction = new lambda.Function(this, 'UploadImageFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-uploadImage',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/uploadImage/index.handler',
            description: 'Generate presigned URL for image upload',
        });
        // User Management Lambda Functions
        const createUserFunction = new lambda.Function(this, 'CreateUserFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-createUser',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/createUser/index.handler',
            description: 'Create a new admin user',
        });
        const listUsersFunction = new lambda.Function(this, 'ListUsersFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-listUsers',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/listUsers/index.handler',
            description: 'List all users',
        });
        const deleteUserFunction = new lambda.Function(this, 'DeleteUserFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-deleteUser',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/deleteUser/index.handler',
            description: 'Delete a user',
        });
        const resetPasswordFunction = new lambda.Function(this, 'ResetPasswordFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-resetPassword',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/resetPassword/index.handler',
            description: 'Reset user password',
        });
        const adminGetProductsFunction = new lambda.Function(this, 'AdminGetProductsFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-adminGetProducts',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/adminGetProducts/index.handler',
            description: 'Get all products for admin (including unpublished)',
        });
        const getCategoriesFunction = new lambda.Function(this, 'GetCategoriesFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-getCategories',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/getCategories/index.handler',
            description: 'Get all product categories',
        });
        // Create CloudWatch Log Group for Price Sync Lambda
        // Requirement 8.4: Add CloudWatch log group
        const priceSyncLogGroup = new logs.LogGroup(this, 'PriceSyncLogGroup', {
            logGroupName: '/aws/lambda/pinterest-affiliate-syncAmazonPrices',
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create Price Sync Lambda Function
        // Requirements 3.1, 3.2: Scheduled Lambda for automatic price synchronization
        const syncAmazonPricesFunction = new lambda.Function(this, 'SyncAmazonPricesFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-syncAmazonPrices',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/syncAmazonPrices/index.handler',
            description: 'Synchronize product prices with Amazon PA-API',
            timeout: cdk.Duration.minutes(10), // Longer timeout for batch processing
            memorySize: 1024, // More memory for processing multiple products
            logGroup: priceSyncLogGroup,
            environment: {
                ...commonEnvironment,
                SNS_TOPIC_ARN: this.priceSyncAlertTopic.topicArn,
            },
        });
        // Create EventBridge rule for scheduled execution
        // Requirement 3.1: Schedule to run daily at 2 AM UTC
        const priceSyncRule = new events.Rule(this, 'PriceSyncScheduleRule', {
            ruleName: 'pinterest-affiliate-price-sync-daily',
            description: 'Triggers price sync Lambda daily at 2 AM UTC',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '2',
                day: '*',
                month: '*',
                year: '*',
            }),
            enabled: true,
        });
        // Add Lambda as target with retry policy
        // Requirement 3.2: Configure retry policy (2 retries with exponential backoff)
        priceSyncRule.addTarget(new events_targets.LambdaFunction(syncAmazonPricesFunction, {
            retryAttempts: 2,
            maxEventAge: cdk.Duration.hours(2),
        }));
        // Grant EventBridge permission to invoke the Lambda
        syncAmazonPricesFunction.grantInvoke(new iam.ServicePrincipal('events.amazonaws.com'));
        // Create Manual Price Sync Trigger Lambda Function
        // Requirement 3.4: Manual sync trigger endpoint for administrators
        const triggerPriceSyncFunction = new lambda.Function(this, 'TriggerPriceSyncFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-triggerPriceSync',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/triggerPriceSync/index.handler',
            description: 'Manually trigger price sync with Amazon PA-API',
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                ...commonEnvironment,
                PRICE_SYNC_LAMBDA_NAME: syncAmazonPricesFunction.functionName,
            },
        });
        // Grant permission to invoke the price sync Lambda
        // Note: Due to circular dependency with shared Lambda role, this permission
        // is added manually via AWS CLI after deployment
        // Command: aws iam put-role-policy --role-name <LambdaExecutionRole> --policy-name InvokePriceSyncLambda --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"lambda:InvokeFunction","Resource":"arn:aws:lambda:REGION:ACCOUNT:function:pinterest-affiliate-syncAmazonPrices"}]}'
        // Create Get Sync History Lambda Function
        // Requirement 6.4: Display sync execution logs in admin panel
        const getSyncHistoryFunction = new lambda.Function(this, 'GetSyncHistoryFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-getSyncHistory',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/getSyncHistory/index.handler',
            description: 'Retrieve price sync execution history from CloudWatch Logs',
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                ...commonEnvironment,
            },
        });
        // Grant CloudWatch Logs read permissions
        getSyncHistoryFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:FilterLogEvents',
                'logs:DescribeLogStreams',
            ],
            resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/syncAmazonPrices:*`,
            ],
        }));
        // Create Cognito Authorizer for API Gateway
        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [userPool],
            authorizerName: 'AdminAuthorizer',
            identitySource: 'method.request.header.Authorization',
        });
        // Create API Gateway
        this.api = new apigateway.RestApi(this, 'PinterestAffiliateApi', {
            restApiName: 'Pinterest Affiliate API',
            description: 'API for Pinterest Affiliate Platform',
            deployOptions: {
                stageName: 'prod',
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                metricsEnabled: true,
                // Disable caching by default (will enable only for public endpoints)
                cachingEnabled: false,
                // Enable throttling at the stage level
                throttlingBurstLimit: 5000, // Maximum concurrent requests
                throttlingRateLimit: 10000, // Maximum requests per second
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
                allowCredentials: true,
            },
        });
        // Create API resources and methods
        const apiResource = this.api.root.addResource('api');
        // Public endpoints with caching
        const productsResource = apiResource.addResource('products');
        productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsFunction, {
            cacheKeyParameters: ['method.request.querystring.category'],
        }), {
            requestParameters: {
                'method.request.querystring.category': false,
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Cache-Control': true,
                    },
                },
            ],
        });
        const productResource = productsResource.addResource('{id}');
        productResource.addMethod('GET', new apigateway.LambdaIntegration(getProductFunction, {
            cacheKeyParameters: ['method.request.path.id'],
        }), {
            requestParameters: {
                'method.request.path.id': true,
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Cache-Control': true,
                    },
                },
            ],
        });
        // Categories endpoint
        const categoriesResource = apiResource.addResource('categories');
        categoriesResource.addMethod('GET', new apigateway.LambdaIntegration(getCategoriesFunction), {
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Cache-Control': true,
                    },
                },
            ],
        });
        // Admin endpoints (protected by Cognito)
        const adminResource = apiResource.addResource('admin');
        const adminProductsResource = adminResource.addResource('products');
        // GET all products (admin - includes unpublished)
        adminProductsResource.addMethod('GET', new apigateway.LambdaIntegration(adminGetProductsFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        adminProductsResource.addMethod('POST', new apigateway.LambdaIntegration(createProductFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        const adminProductResource = adminProductsResource.addResource('{id}');
        adminProductResource.addMethod('PUT', new apigateway.LambdaIntegration(updateProductFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        adminProductResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteProductFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        const uploadImageResource = adminResource.addResource('upload-image');
        uploadImageResource.addMethod('POST', new apigateway.LambdaIntegration(uploadImageFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // User Management endpoints (protected by Cognito)
        const usersResource = adminResource.addResource('users');
        usersResource.addMethod('GET', new apigateway.LambdaIntegration(listUsersFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        usersResource.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        const userResource = usersResource.addResource('{username}');
        userResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteUserFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        const resetPasswordResource = userResource.addResource('reset-password');
        resetPasswordResource.addMethod('POST', new apigateway.LambdaIntegration(resetPasswordFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // Manual Price Sync Trigger endpoint (protected by Cognito)
        // Requirement 3.4: POST /admin/sync-prices API endpoint
        const syncPricesResource = adminResource.addResource('sync-prices');
        syncPricesResource.addMethod('POST', new apigateway.LambdaIntegration(triggerPriceSyncFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // Sync History endpoint (protected by Cognito)
        // Requirement 6.4: GET /admin/sync-history API endpoint
        const syncHistoryResource = adminResource.addResource('sync-history');
        syncHistoryResource.addMethod('GET', new apigateway.LambdaIntegration(getSyncHistoryFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // ========================================
        // Multi-Creator Platform API Routes
        // ========================================
        // Create Lambda functions for multi-creator platform
        const createCreatorFunction = new lambda.Function(this, 'CreateCreatorFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-createCreator',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/createCreator/index.handler',
            description: 'Create a new creator profile',
        });
        const getCreatorBySlugFunction = new lambda.Function(this, 'GetCreatorBySlugFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-getCreatorBySlug',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/getCreatorBySlug/index.handler',
            description: 'Get creator profile by slug',
        });
        const updateCreatorProfileFunction = new lambda.Function(this, 'UpdateCreatorProfileFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-updateCreatorProfile',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/updateCreatorProfile/index.handler',
            description: 'Update creator profile',
        });
        const getCreatorAnalyticsFunction = new lambda.Function(this, 'GetCreatorAnalyticsFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-getCreatorAnalytics',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/getCreatorAnalytics/index.handler',
            description: 'Get creator analytics',
        });
        const trackPageViewFunction = new lambda.Function(this, 'TrackPageViewFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-trackPageView',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/trackPageView/index.handler',
            description: 'Track page view event',
        });
        const trackAffiliateClickFunction = new lambda.Function(this, 'TrackAffiliateClickFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-trackAffiliateClick',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/trackAffiliateClick/index.handler',
            description: 'Track affiliate click event',
        });
        const getPendingProductsFunction = new lambda.Function(this, 'GetPendingProductsFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-getPendingProducts',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/getPendingProducts/index.handler',
            description: 'Get all pending products for moderation',
        });
        const approveProductFunction = new lambda.Function(this, 'ApproveProductFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-approveProduct',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/approveProduct/index.handler',
            description: 'Approve a product',
        });
        const rejectProductFunction = new lambda.Function(this, 'RejectProductFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-rejectProduct',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/rejectProduct/index.handler',
            description: 'Reject a product',
        });
        const listAllCreatorsFunction = new lambda.Function(this, 'ListAllCreatorsFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-listAllCreators',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/listAllCreators/index.handler',
            description: 'List all creators (admin)',
        });
        const updateCreatorStatusFunction = new lambda.Function(this, 'UpdateCreatorStatusFunction', {
            ...lambdaConfig,
            functionName: 'pinterest-affiliate-updateCreatorStatus',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
            handler: 'functions/updateCreatorStatus/index.handler',
            description: 'Update creator status (admin)',
        });
        // ========================================
        // Public Creator Routes (No Auth Required)
        // ========================================
        // GET /api/creators/{slug}
        const creatorsResource = apiResource.addResource('creators');
        const creatorSlugResource = creatorsResource.addResource('{slug}');
        creatorSlugResource.addMethod('GET', new apigateway.LambdaIntegration(getCreatorBySlugFunction, {
            cacheKeyParameters: ['method.request.path.slug'],
        }), {
            requestParameters: {
                'method.request.path.slug': true,
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Cache-Control': true,
                    },
                },
            ],
        });
        // GET /api/creators/{slug}/products
        const creatorProductsResource = creatorSlugResource.addResource('products');
        creatorProductsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsFunction, {
            cacheKeyParameters: [
                'method.request.path.slug',
                'method.request.querystring.category',
                'method.request.querystring.search',
                'method.request.querystring.sort',
            ],
        }), {
            requestParameters: {
                'method.request.path.slug': true,
                'method.request.querystring.category': false,
                'method.request.querystring.search': false,
                'method.request.querystring.sort': false,
                'method.request.querystring.limit': false,
                'method.request.querystring.offset': false,
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Cache-Control': true,
                    },
                },
            ],
        });
        // GET /api/creators/{slug}/featured
        const creatorFeaturedResource = creatorSlugResource.addResource('featured');
        creatorFeaturedResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsFunction, {
            cacheKeyParameters: ['method.request.path.slug'],
        }), {
            requestParameters: {
                'method.request.path.slug': true,
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Cache-Control': true,
                    },
                },
            ],
        });
        // ========================================
        // Creator Routes (Creator Auth Required)
        // ========================================
        const creatorResource = apiResource.addResource('creator');
        // GET /api/creator/profile
        // PUT /api/creator/profile
        const creatorProfileResource = creatorResource.addResource('profile');
        creatorProfileResource.addMethod('GET', new apigateway.LambdaIntegration(getCreatorBySlugFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        creatorProfileResource.addMethod('PUT', new apigateway.LambdaIntegration(updateCreatorProfileFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // GET /api/creator/products
        // POST /api/creator/products
        const creatorOwnProductsResource = creatorResource.addResource('products');
        creatorOwnProductsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        creatorOwnProductsResource.addMethod('POST', new apigateway.LambdaIntegration(createProductFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // PUT /api/creator/products/{id}
        // DELETE /api/creator/products/{id}
        const creatorProductResource = creatorOwnProductsResource.addResource('{id}');
        creatorProductResource.addMethod('PUT', new apigateway.LambdaIntegration(updateProductFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        creatorProductResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteProductFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // GET /api/creator/analytics
        const creatorAnalyticsResource = creatorResource.addResource('analytics');
        creatorAnalyticsResource.addMethod('GET', new apigateway.LambdaIntegration(getCreatorAnalyticsFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestParameters: {
                'method.request.querystring.startDate': false,
                'method.request.querystring.endDate': false,
            },
        });
        // ========================================
        // Admin Creator Management Routes
        // ========================================
        // GET /api/admin/creators
        const adminCreatorsResource = adminResource.addResource('creators');
        adminCreatorsResource.addMethod('GET', new apigateway.LambdaIntegration(listAllCreatorsFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // POST /api/admin/creators (for admin to create creators)
        adminCreatorsResource.addMethod('POST', new apigateway.LambdaIntegration(createCreatorFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // PUT /api/admin/creators/{id}/status
        const adminCreatorIdResource = adminCreatorsResource.addResource('{id}');
        const adminCreatorStatusResource = adminCreatorIdResource.addResource('status');
        adminCreatorStatusResource.addMethod('PUT', new apigateway.LambdaIntegration(updateCreatorStatusFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // GET /api/admin/products/pending
        const adminPendingResource = adminProductsResource.addResource('pending');
        adminPendingResource.addMethod('GET', new apigateway.LambdaIntegration(getPendingProductsFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // PUT /api/admin/products/{id}/approve
        const adminProductApproveResource = adminProductResource.addResource('approve');
        adminProductApproveResource.addMethod('PUT', new apigateway.LambdaIntegration(approveProductFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // PUT /api/admin/products/{id}/reject
        const adminProductRejectResource = adminProductResource.addResource('reject');
        adminProductRejectResource.addMethod('PUT', new apigateway.LambdaIntegration(rejectProductFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // ========================================
        // Analytics Tracking Routes (Public)
        // ========================================
        // POST /api/analytics/page-view
        const analyticsResource = apiResource.addResource('analytics');
        const pageViewResource = analyticsResource.addResource('page-view');
        pageViewResource.addMethod('POST', new apigateway.LambdaIntegration(trackPageViewFunction));
        // POST /api/analytics/affiliate-click
        const affiliateClickResource = analyticsResource.addResource('affiliate-click');
        affiliateClickResource.addMethod('POST', new apigateway.LambdaIntegration(trackAffiliateClickFunction));
        // ========================================
        // Rate Limiting Configuration
        // ========================================
        // Create Usage Plans for different user types
        // Requirements: Performance and security
        // Public Usage Plan - 100 requests per minute per IP
        const publicUsagePlan = this.api.addUsagePlan('PublicUsagePlan', {
            name: 'Public API Usage',
            description: 'Rate limiting for public endpoints',
            throttle: {
                rateLimit: 100, // requests per second
                burstLimit: 200, // maximum concurrent requests
            },
            quota: {
                limit: 100000, // requests per month
                period: apigateway.Period.MONTH,
            },
        });
        // Associate public usage plan with the API stage
        publicUsagePlan.addApiStage({
            stage: this.api.deploymentStage,
        });
        // Creator Usage Plan - 1000 requests per minute per user
        const creatorUsagePlan = this.api.addUsagePlan('CreatorUsagePlan', {
            name: 'Creator API Usage',
            description: 'Rate limiting for creator endpoints',
            throttle: {
                rateLimit: 1000, // requests per second
                burstLimit: 2000, // maximum concurrent requests
            },
            quota: {
                limit: 1000000, // requests per month
                period: apigateway.Period.MONTH,
            },
        });
        creatorUsagePlan.addApiStage({
            stage: this.api.deploymentStage,
        });
        // Admin Usage Plan - 10000 requests per minute per user
        const adminUsagePlan = this.api.addUsagePlan('AdminUsagePlan', {
            name: 'Admin API Usage',
            description: 'Rate limiting for admin endpoints',
            throttle: {
                rateLimit: 10000, // requests per second
                burstLimit: 20000, // maximum concurrent requests
            },
            quota: {
                limit: 10000000, // requests per month
                period: apigateway.Period.MONTH,
            },
        });
        adminUsagePlan.addApiStage({
            stage: this.api.deploymentStage,
        });
        // Configure method-level throttling for specific endpoints
        // This provides more granular control over rate limits
        // Public endpoints - 100 req/min
        const publicThrottle = {
            throttle: {
                rateLimit: 100,
                burstLimit: 200,
            },
        };
        // Creator endpoints - 1000 req/min
        const creatorThrottle = {
            throttle: {
                rateLimit: 1000,
                burstLimit: 2000,
            },
        };
        // Admin endpoints - 10000 req/min
        const adminThrottle = {
            throttle: {
                rateLimit: 10000,
                burstLimit: 20000,
            },
        };
        // Note: Method-level throttling is applied through the deployment stage settings
        // The usage plans above provide account-level throttling
        // For IP-based throttling on public endpoints, AWS WAF would be required
        // Output usage plan IDs
        new cdk.CfnOutput(this, 'PublicUsagePlanId', {
            value: publicUsagePlan.usagePlanId,
            description: 'Public API Usage Plan ID',
        });
        new cdk.CfnOutput(this, 'CreatorUsagePlanId', {
            value: creatorUsagePlan.usagePlanId,
            description: 'Creator API Usage Plan ID',
        });
        new cdk.CfnOutput(this, 'AdminUsagePlanId', {
            value: adminUsagePlan.usagePlanId,
            description: 'Admin API Usage Plan ID',
        });
        // Create CloudWatch Dashboard for Price Sync Monitoring
        // Requirement 8.3: Create CloudWatch dashboard for price sync monitoring
        const priceSyncDashboard = new cloudwatch.Dashboard(this, 'PriceSyncDashboard', {
            dashboardName: 'PinterestAffiliate-PriceSync',
        });
        // Add widgets to the dashboard
        priceSyncDashboard.addWidgets(
        // Success and Failure Counts
        new cloudwatch.GraphWidget({
            title: 'Price Sync - Success vs Failure',
            left: [
                new cloudwatch.Metric({
                    namespace: 'PriceSync',
                    metricName: 'SuccessCount',
                    statistic: 'Sum',
                    label: 'Successful Updates',
                    color: cloudwatch.Color.GREEN,
                }),
                new cloudwatch.Metric({
                    namespace: 'PriceSync',
                    metricName: 'FailureCount',
                    statistic: 'Sum',
                    label: 'Failed Updates',
                    color: cloudwatch.Color.RED,
                }),
            ],
            width: 12,
            height: 6,
        }), 
        // Success Rate
        new cloudwatch.GraphWidget({
            title: 'Price Sync - Success Rate',
            left: [
                new cloudwatch.Metric({
                    namespace: 'PriceSync',
                    metricName: 'SuccessRate',
                    statistic: 'Average',
                    label: 'Success Rate (%)',
                    color: cloudwatch.Color.BLUE,
                }),
            ],
            width: 12,
            height: 6,
            leftYAxis: {
                min: 0,
                max: 100,
            },
        }));
        priceSyncDashboard.addWidgets(
        // Execution Duration
        new cloudwatch.GraphWidget({
            title: 'Price Sync - Execution Duration',
            left: [
                new cloudwatch.Metric({
                    namespace: 'PriceSync',
                    metricName: 'Duration',
                    statistic: 'Average',
                    label: 'Avg Duration (ms)',
                    color: cloudwatch.Color.PURPLE,
                }),
                new cloudwatch.Metric({
                    namespace: 'PriceSync',
                    metricName: 'Duration',
                    statistic: 'Maximum',
                    label: 'Max Duration (ms)',
                    color: cloudwatch.Color.ORANGE,
                }),
            ],
            width: 12,
            height: 6,
        }), 
        // Products Processed
        new cloudwatch.GraphWidget({
            title: 'Price Sync - Products Processed',
            left: [
                new cloudwatch.Metric({
                    namespace: 'PriceSync',
                    metricName: 'TotalProducts',
                    statistic: 'Sum',
                    label: 'Total Products',
                    color: cloudwatch.Color.GREY,
                }),
                new cloudwatch.Metric({
                    namespace: 'PriceSync',
                    metricName: 'ProcessedCount',
                    statistic: 'Sum',
                    label: 'Processed (with ASIN)',
                    color: cloudwatch.Color.BLUE,
                }),
                new cloudwatch.Metric({
                    namespace: 'PriceSync',
                    metricName: 'SkippedCount',
                    statistic: 'Sum',
                    label: 'Skipped (no ASIN)',
                    color: cloudwatch.Color.BROWN,
                }),
            ],
            width: 12,
            height: 6,
        }));
        // Requirement 8.4: Set up alarms for high failure rates
        const highFailureRateAlarm = new cloudwatch.Alarm(this, 'HighFailureRateAlarm', {
            alarmName: 'PriceSync-HighFailureRate',
            alarmDescription: 'Alert when price sync failure rate exceeds 50%',
            metric: new cloudwatch.Metric({
                namespace: 'PriceSync',
                metricName: 'FailureRate',
                statistic: 'Average',
            }),
            threshold: 50,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        // Add SNS action to the alarm
        highFailureRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.priceSyncAlertTopic));
        // Requirement 8.4: Set up alarms for authentication errors
        // This alarm monitors CloudWatch Logs for authentication errors
        const authErrorMetricFilter = new logs.MetricFilter(this, 'AuthErrorMetricFilter', {
            logGroup: priceSyncLogGroup,
            metricNamespace: 'PriceSync',
            metricName: 'AuthenticationErrors',
            filterPattern: logs.FilterPattern.anyTerm('401', 'Unauthorized', 'InvalidSignature', 'SignatureDoesNotMatch'),
            metricValue: '1',
            defaultValue: 0,
        });
        const authErrorAlarm = new cloudwatch.Alarm(this, 'AuthErrorAlarm', {
            alarmName: 'PriceSync-AuthenticationError',
            alarmDescription: 'Alert when PA-API authentication errors occur',
            metric: authErrorMetricFilter.metric({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        authErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.priceSyncAlertTopic));
        // Alarm for execution duration exceeding 5 minutes
        const longExecutionAlarm = new cloudwatch.Alarm(this, 'LongExecutionAlarm', {
            alarmName: 'PriceSync-LongExecution',
            alarmDescription: 'Alert when price sync execution exceeds 5 minutes',
            metric: new cloudwatch.Metric({
                namespace: 'PriceSync',
                metricName: 'Duration',
                statistic: 'Maximum',
            }),
            threshold: 300000, // 5 minutes in milliseconds
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        longExecutionAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.priceSyncAlertTopic));
        // Output API Gateway URL
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: this.api.url,
            description: 'API Gateway URL',
            exportName: 'ApiGatewayUrl',
        });
        new cdk.CfnOutput(this, 'ApiId', {
            value: this.api.restApiId,
            description: 'API Gateway ID',
            exportName: 'ApiGatewayId',
        });
        // Output SNS topic ARN for price sync alerts
        new cdk.CfnOutput(this, 'PriceSyncAlertTopicArn', {
            value: this.priceSyncAlertTopic.topicArn,
            description: 'SNS Topic ARN for Price Sync Alerts',
            exportName: 'PriceSyncAlertTopicArn',
        });
        // Output Parameter Store parameter names
        new cdk.CfnOutput(this, 'PAAPIParametersPrefix', {
            value: '/amazon-affiliate/pa-api/',
            description: 'Parameter Store prefix for PA-API credentials',
        });
        // Output CloudWatch Dashboard URL
        new cdk.CfnOutput(this, 'PriceSyncDashboardUrl', {
            value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${priceSyncDashboard.dashboardName}`,
            description: 'CloudWatch Dashboard URL for Price Sync Monitoring',
        });
        // Output Alarm ARNs
        new cdk.CfnOutput(this, 'HighFailureRateAlarmArn', {
            value: highFailureRateAlarm.alarmArn,
            description: 'High Failure Rate Alarm ARN',
        });
        new cdk.CfnOutput(this, 'AuthErrorAlarmArn', {
            value: authErrorAlarm.alarmArn,
            description: 'Authentication Error Alarm ARN',
        });
        new cdk.CfnOutput(this, 'LongExecutionAlarmArn', {
            value: longExecutionAlarm.alarmArn,
            description: 'Long Execution Alarm ARN',
        });
        // Output Price Sync Lambda details
        new cdk.CfnOutput(this, 'PriceSyncLambdaArn', {
            value: syncAmazonPricesFunction.functionArn,
            description: 'Price Sync Lambda Function ARN',
            exportName: 'PriceSyncLambdaArn',
        });
        new cdk.CfnOutput(this, 'PriceSyncLambdaName', {
            value: syncAmazonPricesFunction.functionName,
            description: 'Price Sync Lambda Function Name',
            exportName: 'PriceSyncLambdaName',
        });
        // Output EventBridge rule details
        new cdk.CfnOutput(this, 'PriceSyncRuleArn', {
            value: priceSyncRule.ruleArn,
            description: 'EventBridge Rule ARN for Price Sync',
            exportName: 'PriceSyncRuleArn',
        });
        new cdk.CfnOutput(this, 'PriceSyncRuleName', {
            value: priceSyncRule.ruleName,
            description: 'EventBridge Rule Name for Price Sync',
        });
        new cdk.CfnOutput(this, 'PriceSyncSchedule', {
            value: 'Daily at 2:00 AM UTC (cron: 0 2 * * ? *)',
            description: 'Price Sync Schedule',
        });
        // Output Manual Trigger Lambda details
        new cdk.CfnOutput(this, 'TriggerPriceSyncLambdaArn', {
            value: triggerPriceSyncFunction.functionArn,
            description: 'Manual Price Sync Trigger Lambda Function ARN',
            exportName: 'TriggerPriceSyncLambdaArn',
        });
        new cdk.CfnOutput(this, 'TriggerPriceSyncLambdaName', {
            value: triggerPriceSyncFunction.functionName,
            description: 'Manual Price Sync Trigger Lambda Function Name',
            exportName: 'TriggerPriceSyncLambdaName',
        });
        new cdk.CfnOutput(this, 'ManualSyncEndpoint', {
            value: `${this.api.url}api/admin/sync-prices`,
            description: 'Manual Price Sync API Endpoint (POST)',
        });
    }
}
exports.BackendStack = BackendStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2VuZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhY2tlbmQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFHekQseURBQTJDO0FBQzNDLDJEQUE2QztBQUU3Qyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLHVFQUF5RDtBQUN6RCx1RkFBeUU7QUFDekUsK0RBQWlEO0FBQ2pELCtFQUFpRTtBQUVqRSwyQ0FBNkI7QUFXN0IsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFJekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBRSxvQkFBb0IsRUFBRSx1QkFBdUIsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXRILHlDQUF5QztRQUN6QyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNwRSxTQUFTLEVBQUUsdUNBQXVDO1lBQ2xELFdBQVcsRUFBRSwwQkFBMEI7U0FDeEMsQ0FBQyxDQUFDO1FBRUgsMkRBQTJEO1FBQzNELDJGQUEyRjtRQUMzRixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzlDLGFBQWEsRUFBRSxxQ0FBcUM7WUFDcEQsV0FBVyxFQUFFLHdCQUF3QjtZQUNyQyxXQUFXLEVBQUUsMkNBQTJDO1lBQ3hELElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVE7U0FDakMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUM5QyxhQUFhLEVBQUUscUNBQXFDO1lBQ3BELFdBQVcsRUFBRSx3QkFBd0I7WUFDckMsV0FBVyxFQUFFLDJDQUEyQztZQUN4RCxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQ2pDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDL0MsYUFBYSxFQUFFLHNDQUFzQztZQUNyRCxXQUFXLEVBQUUseUJBQXlCO1lBQ3RDLFdBQVcsRUFBRSwrQkFBK0I7WUFDNUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUTtTQUNqQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ2hELGFBQWEsRUFBRSxzQ0FBc0M7WUFDckQsV0FBVyxFQUFFLGdCQUFnQjtZQUM3QixXQUFXLEVBQUUsa0NBQWtDO1lBQy9DLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVE7U0FDakMsQ0FBQyxDQUFDO1FBRUgsdUNBQXVDO1FBQ3ZDLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0QsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBDQUEwQyxDQUFDO2FBQ3ZGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsNkJBQTZCO1FBQzdCLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUM3QyxhQUFhLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDN0Msb0JBQW9CLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDcEQsdUJBQXVCLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFdkQsdUJBQXVCO1FBQ3ZCLFlBQVksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFeEMsZ0RBQWdEO1FBQ2hELFVBQVUsQ0FBQyxXQUFXLENBQ3BCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCw2QkFBNkI7Z0JBQzdCLDZCQUE2QjtnQkFDN0IsMEJBQTBCO2dCQUMxQix1Q0FBdUM7Z0JBQ3ZDLGtDQUFrQztnQkFDbEMsaUNBQWlDO2dCQUNqQyxzQ0FBc0M7Z0JBQ3RDLG9DQUFvQztnQkFDcEMsdUJBQXVCO2dCQUN2Qiw4QkFBOEI7YUFDL0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO1NBQ2xDLENBQUMsQ0FDSCxDQUFDO1FBRUYsMkNBQTJDO1FBQzNDLFVBQVUsQ0FBQyxXQUFXLENBQ3BCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxlQUFlO2dCQUNmLGtCQUFrQjthQUNuQjtZQUNELFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLG1DQUFtQztTQUN0RCxDQUFDLENBQ0gsQ0FBQztRQUVGLDJEQUEyRDtRQUMzRCxVQUFVLENBQUMsV0FBVyxDQUNwQixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1Asa0JBQWtCO2dCQUNsQixtQkFBbUI7YUFDcEI7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsZUFBZSxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLCtCQUErQjthQUMxRTtTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYsOENBQThDO1FBQzlDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbEQsa0RBQWtEO1FBQ2xELFVBQVUsQ0FBQyxXQUFXLENBQ3BCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCwwQkFBMEI7YUFDM0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSx3Q0FBd0M7U0FDM0QsQ0FBQyxDQUNILENBQUM7UUFJRixzQ0FBc0M7UUFDdEMsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixtQkFBbUIsRUFBRSxhQUFhLENBQUMsU0FBUztZQUM1QyxtQkFBbUIsRUFBRSxhQUFhLENBQUMsU0FBUztZQUM1QywyQkFBMkIsRUFBRSxvQkFBb0IsQ0FBQyxTQUFTO1lBQzNELDhCQUE4QixFQUFFLHVCQUF1QixDQUFDLFNBQVM7WUFDakUsa0JBQWtCLEVBQUUsWUFBWSxDQUFDLFVBQVU7WUFDM0MsWUFBWSxFQUFFLFFBQVEsQ0FBQyxVQUFVO1lBQ2pDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsOEJBQThCO1FBQzlCLE1BQU0sWUFBWSxHQUFHO1lBQ25CLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsSUFBSSxFQUFFLFVBQVU7WUFDaEIsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1NBQ2hCLENBQUM7UUFFRix1REFBdUQ7UUFDdkQsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzNFLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxpQ0FBaUM7WUFDL0MsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLHFDQUFxQztZQUM5QyxXQUFXLEVBQUUsbURBQW1EO1NBQ2pFLENBQUMsQ0FBQztRQUVILE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUN6RSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsZ0NBQWdDO1lBQzlDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSxvQ0FBb0M7WUFDN0MsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxNQUFNLHFCQUFxQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0UsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLG1DQUFtQztZQUNqRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsdUNBQXVDO1lBQ2hELFdBQVcsRUFBRSxzQkFBc0I7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9FLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxtQ0FBbUM7WUFDakQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLHVDQUF1QztZQUNoRCxXQUFXLEVBQUUsNEJBQTRCO1NBQzFDLENBQUMsQ0FBQztRQUVILE1BQU0scUJBQXFCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsbUNBQW1DO1lBQ2pELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx1Q0FBdUM7WUFDaEQsV0FBVyxFQUFFLGtCQUFrQjtTQUNoQyxDQUFDLENBQUM7UUFFSCxNQUFNLG1CQUFtQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0UsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLGlDQUFpQztZQUMvQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUscUNBQXFDO1lBQzlDLFdBQVcsRUFBRSx5Q0FBeUM7U0FDdkQsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUN6RSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsZ0NBQWdDO1lBQzlDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSxvQ0FBb0M7WUFDN0MsV0FBVyxFQUFFLHlCQUF5QjtTQUN2QyxDQUFDLENBQUM7UUFFSCxNQUFNLGlCQUFpQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDdkUsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLCtCQUErQjtZQUM3QyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsbUNBQW1DO1lBQzVDLFdBQVcsRUFBRSxnQkFBZ0I7U0FDOUIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ3pFLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxnQ0FBZ0M7WUFDOUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLG9DQUFvQztZQUM3QyxXQUFXLEVBQUUsZUFBZTtTQUM3QixDQUFDLENBQUM7UUFFSCxNQUFNLHFCQUFxQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0UsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLG1DQUFtQztZQUNqRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsdUNBQXVDO1lBQ2hELFdBQVcsRUFBRSxxQkFBcUI7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsTUFBTSx3QkFBd0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ3JGLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxzQ0FBc0M7WUFDcEQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLDBDQUEwQztZQUNuRCxXQUFXLEVBQUUsb0RBQW9EO1NBQ2xFLENBQUMsQ0FBQztRQUVILE1BQU0scUJBQXFCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsbUNBQW1DO1lBQ2pELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx1Q0FBdUM7WUFDaEQsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxvREFBb0Q7UUFDcEQsNENBQTRDO1FBQzVDLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUNyRSxZQUFZLEVBQUUsa0RBQWtEO1lBQ2hFLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7WUFDdEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxvQ0FBb0M7UUFDcEMsOEVBQThFO1FBQzlFLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNyRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsc0NBQXNDO1lBQ3BELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSwwQ0FBMEM7WUFDbkQsV0FBVyxFQUFFLCtDQUErQztZQUM1RCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUUsc0NBQXNDO1lBQ3pFLFVBQVUsRUFBRSxJQUFJLEVBQUUsK0NBQStDO1lBQ2pFLFFBQVEsRUFBRSxpQkFBaUI7WUFDM0IsV0FBVyxFQUFFO2dCQUNYLEdBQUcsaUJBQWlCO2dCQUNwQixhQUFhLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVE7YUFDakQ7U0FDRixDQUFDLENBQUM7UUFFSCxrREFBa0Q7UUFDbEQscURBQXFEO1FBQ3JELE1BQU0sYUFBYSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDbkUsUUFBUSxFQUFFLHNDQUFzQztZQUNoRCxXQUFXLEVBQUUsOENBQThDO1lBQzNELFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztnQkFDN0IsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEdBQUc7Z0JBQ1QsR0FBRyxFQUFFLEdBQUc7Z0JBQ1IsS0FBSyxFQUFFLEdBQUc7Z0JBQ1YsSUFBSSxFQUFFLEdBQUc7YUFDVixDQUFDO1lBQ0YsT0FBTyxFQUFFLElBQUk7U0FDZCxDQUFDLENBQUM7UUFFSCx5Q0FBeUM7UUFDekMsK0VBQStFO1FBQy9FLGFBQWEsQ0FBQyxTQUFTLENBQ3JCLElBQUksY0FBYyxDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsRUFBRTtZQUMxRCxhQUFhLEVBQUUsQ0FBQztZQUNoQixXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQ25DLENBQUMsQ0FDSCxDQUFDO1FBRUYsb0RBQW9EO1FBQ3BELHdCQUF3QixDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7UUFFdkYsbURBQW1EO1FBQ25ELG1FQUFtRTtRQUNuRSxNQUFNLHdCQUF3QixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDckYsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLHNDQUFzQztZQUNwRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsMENBQTBDO1lBQ25ELFdBQVcsRUFBRSxnREFBZ0Q7WUFDN0QsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxVQUFVLEVBQUUsR0FBRztZQUNmLFdBQVcsRUFBRTtnQkFDWCxHQUFHLGlCQUFpQjtnQkFDcEIsc0JBQXNCLEVBQUUsd0JBQXdCLENBQUMsWUFBWTthQUM5RDtTQUNGLENBQUMsQ0FBQztRQUVILG1EQUFtRDtRQUNuRCw0RUFBNEU7UUFDNUUsaURBQWlEO1FBQ2pELGlUQUFpVDtRQUVqVCwwQ0FBMEM7UUFDMUMsOERBQThEO1FBQzlELE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUNqRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsb0NBQW9DO1lBQ2xELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx3Q0FBd0M7WUFDakQsV0FBVyxFQUFFLDREQUE0RDtZQUN6RSxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsV0FBVyxFQUFFO2dCQUNYLEdBQUcsaUJBQWlCO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgseUNBQXlDO1FBQ3pDLHNCQUFzQixDQUFDLGVBQWUsQ0FDcEMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLHNCQUFzQjtnQkFDdEIseUJBQXlCO2FBQzFCO1lBQ0QsU0FBUyxFQUFFO2dCQUNULGdCQUFnQixJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLDJDQUEyQzthQUN2RjtTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYsNENBQTRDO1FBQzVDLE1BQU0sVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLDBCQUEwQixDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUN0RixnQkFBZ0IsRUFBRSxDQUFDLFFBQVEsQ0FBQztZQUM1QixjQUFjLEVBQUUsaUJBQWlCO1lBQ2pDLGNBQWMsRUFBRSxxQ0FBcUM7U0FDdEQsQ0FBQyxDQUFDO1FBRUgscUJBQXFCO1FBQ3JCLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRCxXQUFXLEVBQUUseUJBQXlCO1lBQ3RDLFdBQVcsRUFBRSxzQ0FBc0M7WUFDbkQsYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxNQUFNO2dCQUNqQixZQUFZLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLElBQUk7Z0JBQ2hELGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLGNBQWMsRUFBRSxJQUFJO2dCQUNwQixxRUFBcUU7Z0JBQ3JFLGNBQWMsRUFBRSxLQUFLO2dCQUNyQix1Q0FBdUM7Z0JBQ3ZDLG9CQUFvQixFQUFFLElBQUksRUFBRSw4QkFBOEI7Z0JBQzFELG1CQUFtQixFQUFFLEtBQUssRUFBRSw4QkFBOEI7YUFDM0Q7WUFDRCwyQkFBMkIsRUFBRTtnQkFDM0IsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFO29CQUNaLGNBQWM7b0JBQ2QsWUFBWTtvQkFDWixlQUFlO29CQUNmLFdBQVc7b0JBQ1gsc0JBQXNCO2lCQUN2QjtnQkFDRCxnQkFBZ0IsRUFBRSxJQUFJO2FBQ3ZCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVyRCxnQ0FBZ0M7UUFDaEMsTUFBTSxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdELGdCQUFnQixDQUFDLFNBQVMsQ0FDeEIsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixFQUFFO1lBQ3BELGtCQUFrQixFQUFFLENBQUMscUNBQXFDLENBQUM7U0FDNUQsQ0FBQyxFQUNGO1lBQ0UsaUJBQWlCLEVBQUU7Z0JBQ2pCLHFDQUFxQyxFQUFFLEtBQUs7YUFDN0M7WUFDRCxlQUFlLEVBQUU7Z0JBQ2Y7b0JBQ0UsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLGtCQUFrQixFQUFFO3dCQUNsQixzQ0FBc0MsRUFBRSxJQUFJO3FCQUM3QztpQkFDRjthQUNGO1NBQ0YsQ0FDRixDQUFDO1FBRUYsTUFBTSxlQUFlLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzdELGVBQWUsQ0FBQyxTQUFTLENBQ3ZCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsRUFBRTtZQUNuRCxrQkFBa0IsRUFBRSxDQUFDLHdCQUF3QixDQUFDO1NBQy9DLENBQUMsRUFDRjtZQUNFLGlCQUFpQixFQUFFO2dCQUNqQix3QkFBd0IsRUFBRSxJQUFJO2FBQy9CO1lBQ0QsZUFBZSxFQUFFO2dCQUNmO29CQUNFLFVBQVUsRUFBRSxLQUFLO29CQUNqQixrQkFBa0IsRUFBRTt3QkFDbEIsc0NBQXNDLEVBQUUsSUFBSTtxQkFDN0M7aUJBQ0Y7YUFDRjtTQUNGLENBQ0YsQ0FBQztRQUVGLHNCQUFzQjtRQUN0QixNQUFNLGtCQUFrQixHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDakUsa0JBQWtCLENBQUMsU0FBUyxDQUMxQixLQUFLLEVBQ0wsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLENBQUMsRUFDdkQ7WUFDRSxlQUFlLEVBQUU7Z0JBQ2Y7b0JBQ0UsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLGtCQUFrQixFQUFFO3dCQUNsQixzQ0FBc0MsRUFBRSxJQUFJO3FCQUM3QztpQkFDRjthQUNGO1NBQ0YsQ0FDRixDQUFDO1FBRUYseUNBQXlDO1FBQ3pDLE1BQU0sYUFBYSxHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkQsTUFBTSxxQkFBcUIsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRXBFLGtEQUFrRDtRQUNsRCxxQkFBcUIsQ0FBQyxTQUFTLENBQzdCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyx3QkFBd0IsQ0FBQyxFQUMxRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixxQkFBcUIsQ0FBQyxTQUFTLENBQzdCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixNQUFNLG9CQUFvQixHQUFHLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2RSxvQkFBb0IsQ0FBQyxTQUFTLENBQzVCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFDRixvQkFBb0IsQ0FBQyxTQUFTLENBQzVCLFFBQVEsRUFDUixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixNQUFNLG1CQUFtQixHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDdEUsbUJBQW1CLENBQUMsU0FBUyxDQUMzQixNQUFNLEVBQ04sSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsRUFDckQ7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDeEQsQ0FDRixDQUFDO1FBRUYsbURBQW1EO1FBQ25ELE1BQU0sYUFBYSxHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDekQsYUFBYSxDQUFDLFNBQVMsQ0FDckIsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLGlCQUFpQixDQUFDLEVBQ25EO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUNGLGFBQWEsQ0FBQyxTQUFTLENBQ3JCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUNwRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixNQUFNLFlBQVksR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzdELFlBQVksQ0FBQyxTQUFTLENBQ3BCLFFBQVEsRUFDUixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUNwRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixNQUFNLHFCQUFxQixHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN6RSxxQkFBcUIsQ0FBQyxTQUFTLENBQzdCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRiw0REFBNEQ7UUFDNUQsd0RBQXdEO1FBQ3hELE1BQU0sa0JBQWtCLEdBQUcsYUFBYSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNwRSxrQkFBa0IsQ0FBQyxTQUFTLENBQzFCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyx3QkFBd0IsQ0FBQyxFQUMxRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRiwrQ0FBK0M7UUFDL0Msd0RBQXdEO1FBQ3hELE1BQU0sbUJBQW1CLEdBQUcsYUFBYSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN0RSxtQkFBbUIsQ0FBQyxTQUFTLENBQzNCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsQ0FBQyxFQUN4RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRiwyQ0FBMkM7UUFDM0Msb0NBQW9DO1FBQ3BDLDJDQUEyQztRQUUzQyxxREFBcUQ7UUFDckQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9FLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxtQ0FBbUM7WUFDakQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLHVDQUF1QztZQUNoRCxXQUFXLEVBQUUsOEJBQThCO1NBQzVDLENBQUMsQ0FBQztRQUVILE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNyRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsc0NBQXNDO1lBQ3BELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSwwQ0FBMEM7WUFDbkQsV0FBVyxFQUFFLDZCQUE2QjtTQUMzQyxDQUFDLENBQUM7UUFFSCxNQUFNLDRCQUE0QixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsOEJBQThCLEVBQUU7WUFDN0YsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLDBDQUEwQztZQUN4RCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsOENBQThDO1lBQ3ZELFdBQVcsRUFBRSx3QkFBd0I7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSwyQkFBMkIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDZCQUE2QixFQUFFO1lBQzNGLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSx5Q0FBeUM7WUFDdkQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLDZDQUE2QztZQUN0RCxXQUFXLEVBQUUsdUJBQXVCO1NBQ3JDLENBQUMsQ0FBQztRQUVILE1BQU0scUJBQXFCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsbUNBQW1DO1lBQ2pELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx1Q0FBdUM7WUFDaEQsV0FBVyxFQUFFLHVCQUF1QjtTQUNyQyxDQUFDLENBQUM7UUFFSCxNQUFNLDJCQUEyQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsNkJBQTZCLEVBQUU7WUFDM0YsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLHlDQUF5QztZQUN2RCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsNkNBQTZDO1lBQ3RELFdBQVcsRUFBRSw2QkFBNkI7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ3pGLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSx3Q0FBd0M7WUFDdEQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLDRDQUE0QztZQUNyRCxXQUFXLEVBQUUseUNBQXlDO1NBQ3ZELENBQUMsQ0FBQztRQUVILE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUNqRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsb0NBQW9DO1lBQ2xELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx3Q0FBd0M7WUFDakQsV0FBVyxFQUFFLG1CQUFtQjtTQUNqQyxDQUFDLENBQUM7UUFFSCxNQUFNLHFCQUFxQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0UsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLG1DQUFtQztZQUNqRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsdUNBQXVDO1lBQ2hELFdBQVcsRUFBRSxrQkFBa0I7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ25GLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxxQ0FBcUM7WUFDbkQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLHlDQUF5QztZQUNsRCxXQUFXLEVBQUUsMkJBQTJCO1NBQ3pDLENBQUMsQ0FBQztRQUVILE1BQU0sMkJBQTJCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUMzRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUseUNBQXlDO1lBQ3ZELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSw2Q0FBNkM7WUFDdEQsV0FBVyxFQUFFLCtCQUErQjtTQUM3QyxDQUFDLENBQUM7UUFFSCwyQ0FBMkM7UUFDM0MsMkNBQTJDO1FBQzNDLDJDQUEyQztRQUUzQywyQkFBMkI7UUFDM0IsTUFBTSxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdELE1BQU0sbUJBQW1CLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ25FLG1CQUFtQixDQUFDLFNBQVMsQ0FDM0IsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHdCQUF3QixFQUFFO1lBQ3pELGtCQUFrQixFQUFFLENBQUMsMEJBQTBCLENBQUM7U0FDakQsQ0FBQyxFQUNGO1lBQ0UsaUJBQWlCLEVBQUU7Z0JBQ2pCLDBCQUEwQixFQUFFLElBQUk7YUFDakM7WUFDRCxlQUFlLEVBQUU7Z0JBQ2Y7b0JBQ0UsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLGtCQUFrQixFQUFFO3dCQUNsQixzQ0FBc0MsRUFBRSxJQUFJO3FCQUM3QztpQkFDRjthQUNGO1NBQ0YsQ0FDRixDQUFDO1FBRUYsb0NBQW9DO1FBQ3BDLE1BQU0sdUJBQXVCLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzVFLHVCQUF1QixDQUFDLFNBQVMsQ0FDL0IsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixFQUFFO1lBQ3BELGtCQUFrQixFQUFFO2dCQUNsQiwwQkFBMEI7Z0JBQzFCLHFDQUFxQztnQkFDckMsbUNBQW1DO2dCQUNuQyxpQ0FBaUM7YUFDbEM7U0FDRixDQUFDLEVBQ0Y7WUFDRSxpQkFBaUIsRUFBRTtnQkFDakIsMEJBQTBCLEVBQUUsSUFBSTtnQkFDaEMscUNBQXFDLEVBQUUsS0FBSztnQkFDNUMsbUNBQW1DLEVBQUUsS0FBSztnQkFDMUMsaUNBQWlDLEVBQUUsS0FBSztnQkFDeEMsa0NBQWtDLEVBQUUsS0FBSztnQkFDekMsbUNBQW1DLEVBQUUsS0FBSzthQUMzQztZQUNELGVBQWUsRUFBRTtnQkFDZjtvQkFDRSxVQUFVLEVBQUUsS0FBSztvQkFDakIsa0JBQWtCLEVBQUU7d0JBQ2xCLHNDQUFzQyxFQUFFLElBQUk7cUJBQzdDO2lCQUNGO2FBQ0Y7U0FDRixDQUNGLENBQUM7UUFFRixvQ0FBb0M7UUFDcEMsTUFBTSx1QkFBdUIsR0FBRyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDNUUsdUJBQXVCLENBQUMsU0FBUyxDQUMvQixLQUFLLEVBQ0wsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLEVBQUU7WUFDcEQsa0JBQWtCLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQztTQUNqRCxDQUFDLEVBQ0Y7WUFDRSxpQkFBaUIsRUFBRTtnQkFDakIsMEJBQTBCLEVBQUUsSUFBSTthQUNqQztZQUNELGVBQWUsRUFBRTtnQkFDZjtvQkFDRSxVQUFVLEVBQUUsS0FBSztvQkFDakIsa0JBQWtCLEVBQUU7d0JBQ2xCLHNDQUFzQyxFQUFFLElBQUk7cUJBQzdDO2lCQUNGO2FBQ0Y7U0FDRixDQUNGLENBQUM7UUFFRiwyQ0FBMkM7UUFDM0MseUNBQXlDO1FBQ3pDLDJDQUEyQztRQUUzQyxNQUFNLGVBQWUsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTNELDJCQUEyQjtRQUMzQiwyQkFBMkI7UUFDM0IsTUFBTSxzQkFBc0IsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3RFLHNCQUFzQixDQUFDLFNBQVMsQ0FDOUIsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHdCQUF3QixDQUFDLEVBQzFEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUNGLHNCQUFzQixDQUFDLFNBQVMsQ0FDOUIsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLDRCQUE0QixDQUFDLEVBQzlEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUVGLDRCQUE0QjtRQUM1Qiw2QkFBNkI7UUFDN0IsTUFBTSwwQkFBMEIsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzNFLDBCQUEwQixDQUFDLFNBQVMsQ0FDbEMsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixDQUFDLEVBQ3JEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUNGLDBCQUEwQixDQUFDLFNBQVMsQ0FDbEMsTUFBTSxFQUNOLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLEVBQ3ZEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUVGLGlDQUFpQztRQUNqQyxvQ0FBb0M7UUFDcEMsTUFBTSxzQkFBc0IsR0FBRywwQkFBMEIsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUUsc0JBQXNCLENBQUMsU0FBUyxDQUM5QixLQUFLLEVBQ0wsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLENBQUMsRUFDdkQ7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDeEQsQ0FDRixDQUFDO1FBQ0Ysc0JBQXNCLENBQUMsU0FBUyxDQUM5QixRQUFRLEVBQ1IsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLENBQUMsRUFDdkQ7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDeEQsQ0FDRixDQUFDO1FBRUYsNkJBQTZCO1FBQzdCLE1BQU0sd0JBQXdCLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMxRSx3QkFBd0IsQ0FBQyxTQUFTLENBQ2hDLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQywyQkFBMkIsQ0FBQyxFQUM3RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztZQUN2RCxpQkFBaUIsRUFBRTtnQkFDakIsc0NBQXNDLEVBQUUsS0FBSztnQkFDN0Msb0NBQW9DLEVBQUUsS0FBSzthQUM1QztTQUNGLENBQ0YsQ0FBQztRQUVGLDJDQUEyQztRQUMzQyxrQ0FBa0M7UUFDbEMsMkNBQTJDO1FBRTNDLDBCQUEwQjtRQUMxQixNQUFNLHFCQUFxQixHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDcEUscUJBQXFCLENBQUMsU0FBUyxDQUM3QixLQUFLLEVBQ0wsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsdUJBQXVCLENBQUMsRUFDekQ7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDeEQsQ0FDRixDQUFDO1FBRUYsMERBQTBEO1FBQzFELHFCQUFxQixDQUFDLFNBQVMsQ0FDN0IsTUFBTSxFQUNOLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLEVBQ3ZEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUVGLHNDQUFzQztRQUN0QyxNQUFNLHNCQUFzQixHQUFHLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN6RSxNQUFNLDBCQUEwQixHQUFHLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNoRiwwQkFBMEIsQ0FBQyxTQUFTLENBQ2xDLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQywyQkFBMkIsQ0FBQyxFQUM3RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixrQ0FBa0M7UUFDbEMsTUFBTSxvQkFBb0IsR0FBRyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDMUUsb0JBQW9CLENBQUMsU0FBUyxDQUM1QixLQUFLLEVBQ0wsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsMEJBQTBCLENBQUMsRUFDNUQ7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDeEQsQ0FDRixDQUFDO1FBRUYsdUNBQXVDO1FBQ3ZDLE1BQU0sMkJBQTJCLEdBQUcsb0JBQW9CLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2hGLDJCQUEyQixDQUFDLFNBQVMsQ0FDbkMsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHNCQUFzQixDQUFDLEVBQ3hEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUVGLHNDQUFzQztRQUN0QyxNQUFNLDBCQUEwQixHQUFHLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM5RSwwQkFBMEIsQ0FBQyxTQUFTLENBQ2xDLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRiwyQ0FBMkM7UUFDM0MscUNBQXFDO1FBQ3JDLDJDQUEyQztRQUUzQyxnQ0FBZ0M7UUFDaEMsTUFBTSxpQkFBaUIsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sZ0JBQWdCLEdBQUcsaUJBQWlCLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3BFLGdCQUFnQixDQUFDLFNBQVMsQ0FDeEIsTUFBTSxFQUNOLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLENBQ3hELENBQUM7UUFFRixzQ0FBc0M7UUFDdEMsTUFBTSxzQkFBc0IsR0FBRyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNoRixzQkFBc0IsQ0FBQyxTQUFTLENBQzlCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQywyQkFBMkIsQ0FBQyxDQUM5RCxDQUFDO1FBRUYsMkNBQTJDO1FBQzNDLDhCQUE4QjtRQUM5QiwyQ0FBMkM7UUFFM0MsOENBQThDO1FBQzlDLHlDQUF5QztRQUV6QyxxREFBcUQ7UUFDckQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsaUJBQWlCLEVBQUU7WUFDL0QsSUFBSSxFQUFFLGtCQUFrQjtZQUN4QixXQUFXLEVBQUUsb0NBQW9DO1lBQ2pELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUUsR0FBRyxFQUFFLHNCQUFzQjtnQkFDdEMsVUFBVSxFQUFFLEdBQUcsRUFBRSw4QkFBOEI7YUFDaEQ7WUFDRCxLQUFLLEVBQUU7Z0JBQ0wsS0FBSyxFQUFFLE1BQU0sRUFBRSxxQkFBcUI7Z0JBQ3BDLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTSxDQUFDLEtBQUs7YUFDaEM7U0FDRixDQUFDLENBQUM7UUFFSCxpREFBaUQ7UUFDakQsZUFBZSxDQUFDLFdBQVcsQ0FBQztZQUMxQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlO1NBQ2hDLENBQUMsQ0FBQztRQUVILHlEQUF5RDtRQUN6RCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFFO1lBQ2pFLElBQUksRUFBRSxtQkFBbUI7WUFDekIsV0FBVyxFQUFFLHFDQUFxQztZQUNsRCxRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFLElBQUksRUFBRSxzQkFBc0I7Z0JBQ3ZDLFVBQVUsRUFBRSxJQUFJLEVBQUUsOEJBQThCO2FBQ2pEO1lBQ0QsS0FBSyxFQUFFO2dCQUNMLEtBQUssRUFBRSxPQUFPLEVBQUUscUJBQXFCO2dCQUNyQyxNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLO2FBQ2hDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsV0FBVyxDQUFDO1lBQzNCLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLGVBQWU7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsd0RBQXdEO1FBQ3hELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFO1lBQzdELElBQUksRUFBRSxpQkFBaUI7WUFDdkIsV0FBVyxFQUFFLG1DQUFtQztZQUNoRCxRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFLEtBQUssRUFBRSxzQkFBc0I7Z0JBQ3hDLFVBQVUsRUFBRSxLQUFLLEVBQUUsOEJBQThCO2FBQ2xEO1lBQ0QsS0FBSyxFQUFFO2dCQUNMLEtBQUssRUFBRSxRQUFRLEVBQUUscUJBQXFCO2dCQUN0QyxNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLO2FBQ2hDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsY0FBYyxDQUFDLFdBQVcsQ0FBQztZQUN6QixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlO1NBQ2hDLENBQUMsQ0FBQztRQUVILDJEQUEyRDtRQUMzRCx1REFBdUQ7UUFFdkQsaUNBQWlDO1FBQ2pDLE1BQU0sY0FBYyxHQUFHO1lBQ3JCLFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUUsR0FBRztnQkFDZCxVQUFVLEVBQUUsR0FBRzthQUNoQjtTQUNGLENBQUM7UUFFRixtQ0FBbUM7UUFDbkMsTUFBTSxlQUFlLEdBQUc7WUFDdEIsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRSxJQUFJO2dCQUNmLFVBQVUsRUFBRSxJQUFJO2FBQ2pCO1NBQ0YsQ0FBQztRQUVGLGtDQUFrQztRQUNsQyxNQUFNLGFBQWEsR0FBRztZQUNwQixRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLFVBQVUsRUFBRSxLQUFLO2FBQ2xCO1NBQ0YsQ0FBQztRQUVGLGlGQUFpRjtRQUNqRix5REFBeUQ7UUFDekQseUVBQXlFO1FBRXpFLHdCQUF3QjtRQUN4QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxlQUFlLENBQUMsV0FBVztZQUNsQyxXQUFXLEVBQUUsMEJBQTBCO1NBQ3hDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLGdCQUFnQixDQUFDLFdBQVc7WUFDbkMsV0FBVyxFQUFFLDJCQUEyQjtTQUN6QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxjQUFjLENBQUMsV0FBVztZQUNqQyxXQUFXLEVBQUUseUJBQXlCO1NBQ3ZDLENBQUMsQ0FBQztRQUVILHdEQUF3RDtRQUN4RCx5RUFBeUU7UUFDekUsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzlFLGFBQWEsRUFBRSw4QkFBOEI7U0FDOUMsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLGtCQUFrQixDQUFDLFVBQVU7UUFDM0IsNkJBQTZCO1FBQzdCLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUN6QixLQUFLLEVBQUUsaUNBQWlDO1lBQ3hDLElBQUksRUFBRTtnQkFDSixJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQ3BCLFNBQVMsRUFBRSxXQUFXO29CQUN0QixVQUFVLEVBQUUsY0FBYztvQkFDMUIsU0FBUyxFQUFFLEtBQUs7b0JBQ2hCLEtBQUssRUFBRSxvQkFBb0I7b0JBQzNCLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUs7aUJBQzlCLENBQUM7Z0JBQ0YsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsV0FBVztvQkFDdEIsVUFBVSxFQUFFLGNBQWM7b0JBQzFCLFNBQVMsRUFBRSxLQUFLO29CQUNoQixLQUFLLEVBQUUsZ0JBQWdCO29CQUN2QixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHO2lCQUM1QixDQUFDO2FBQ0g7WUFDRCxLQUFLLEVBQUUsRUFBRTtZQUNULE1BQU0sRUFBRSxDQUFDO1NBQ1YsQ0FBQztRQUNGLGVBQWU7UUFDZixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLDJCQUEyQjtZQUNsQyxJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsV0FBVztvQkFDdEIsVUFBVSxFQUFFLGFBQWE7b0JBQ3pCLFNBQVMsRUFBRSxTQUFTO29CQUNwQixLQUFLLEVBQUUsa0JBQWtCO29CQUN6QixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJO2lCQUM3QixDQUFDO2FBQ0g7WUFDRCxLQUFLLEVBQUUsRUFBRTtZQUNULE1BQU0sRUFBRSxDQUFDO1lBQ1QsU0FBUyxFQUFFO2dCQUNULEdBQUcsRUFBRSxDQUFDO2dCQUNOLEdBQUcsRUFBRSxHQUFHO2FBQ1Q7U0FDRixDQUFDLENBQ0gsQ0FBQztRQUVGLGtCQUFrQixDQUFDLFVBQVU7UUFDM0IscUJBQXFCO1FBQ3JCLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUN6QixLQUFLLEVBQUUsaUNBQWlDO1lBQ3hDLElBQUksRUFBRTtnQkFDSixJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQ3BCLFNBQVMsRUFBRSxXQUFXO29CQUN0QixVQUFVLEVBQUUsVUFBVTtvQkFDdEIsU0FBUyxFQUFFLFNBQVM7b0JBQ3BCLEtBQUssRUFBRSxtQkFBbUI7b0JBQzFCLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU07aUJBQy9CLENBQUM7Z0JBQ0YsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsV0FBVztvQkFDdEIsVUFBVSxFQUFFLFVBQVU7b0JBQ3RCLFNBQVMsRUFBRSxTQUFTO29CQUNwQixLQUFLLEVBQUUsbUJBQW1CO29CQUMxQixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNO2lCQUMvQixDQUFDO2FBQ0g7WUFDRCxLQUFLLEVBQUUsRUFBRTtZQUNULE1BQU0sRUFBRSxDQUFDO1NBQ1YsQ0FBQztRQUNGLHFCQUFxQjtRQUNyQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLGlDQUFpQztZQUN4QyxJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsV0FBVztvQkFDdEIsVUFBVSxFQUFFLGVBQWU7b0JBQzNCLFNBQVMsRUFBRSxLQUFLO29CQUNoQixLQUFLLEVBQUUsZ0JBQWdCO29CQUN2QixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJO2lCQUM3QixDQUFDO2dCQUNGLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLFdBQVc7b0JBQ3RCLFVBQVUsRUFBRSxnQkFBZ0I7b0JBQzVCLFNBQVMsRUFBRSxLQUFLO29CQUNoQixLQUFLLEVBQUUsdUJBQXVCO29CQUM5QixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJO2lCQUM3QixDQUFDO2dCQUNGLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLFdBQVc7b0JBQ3RCLFVBQVUsRUFBRSxjQUFjO29CQUMxQixTQUFTLEVBQUUsS0FBSztvQkFDaEIsS0FBSyxFQUFFLG1CQUFtQjtvQkFDMUIsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSztpQkFDOUIsQ0FBQzthQUNIO1lBQ0QsS0FBSyxFQUFFLEVBQUU7WUFDVCxNQUFNLEVBQUUsQ0FBQztTQUNWLENBQUMsQ0FDSCxDQUFDO1FBRUYsd0RBQXdEO1FBQ3hELE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUM5RSxTQUFTLEVBQUUsMkJBQTJCO1lBQ3RDLGdCQUFnQixFQUFFLGdEQUFnRDtZQUNsRSxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUM1QixTQUFTLEVBQUUsV0FBVztnQkFDdEIsVUFBVSxFQUFFLGFBQWE7Z0JBQ3pCLFNBQVMsRUFBRSxTQUFTO2FBQ3JCLENBQUM7WUFDRixTQUFTLEVBQUUsRUFBRTtZQUNiLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLHNCQUFzQjtZQUN4RSxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtTQUM1RCxDQUFDLENBQUM7UUFFSCw4QkFBOEI7UUFDOUIsb0JBQW9CLENBQUMsY0FBYyxDQUNqQyxJQUFJLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FDM0QsQ0FBQztRQUVGLDJEQUEyRDtRQUMzRCxnRUFBZ0U7UUFDaEUsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ2pGLFFBQVEsRUFBRSxpQkFBaUI7WUFDM0IsZUFBZSxFQUFFLFdBQVc7WUFDNUIsVUFBVSxFQUFFLHNCQUFzQjtZQUNsQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSx1QkFBdUIsQ0FBQztZQUM3RyxXQUFXLEVBQUUsR0FBRztZQUNoQixZQUFZLEVBQUUsQ0FBQztTQUNoQixDQUFDLENBQUM7UUFFSCxNQUFNLGNBQWMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ2xFLFNBQVMsRUFBRSwrQkFBK0I7WUFDMUMsZ0JBQWdCLEVBQUUsK0NBQStDO1lBQ2pFLE1BQU0sRUFBRSxxQkFBcUIsQ0FBQyxNQUFNLENBQUM7Z0JBQ25DLFNBQVMsRUFBRSxLQUFLO2dCQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUM7WUFDRixTQUFTLEVBQUUsQ0FBQztZQUNaLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLGtDQUFrQztZQUNwRixnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtTQUM1RCxDQUFDLENBQUM7UUFFSCxjQUFjLENBQUMsY0FBYyxDQUMzQixJQUFJLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FDM0QsQ0FBQztRQUVGLG1EQUFtRDtRQUNuRCxNQUFNLGtCQUFrQixHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDMUUsU0FBUyxFQUFFLHlCQUF5QjtZQUNwQyxnQkFBZ0IsRUFBRSxtREFBbUQ7WUFDckUsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsU0FBUyxFQUFFLFdBQVc7Z0JBQ3RCLFVBQVUsRUFBRSxVQUFVO2dCQUN0QixTQUFTLEVBQUUsU0FBUzthQUNyQixDQUFDO1lBQ0YsU0FBUyxFQUFFLE1BQU0sRUFBRSw0QkFBNEI7WUFDL0MsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixrQkFBa0IsRUFBRSxVQUFVLENBQUMsa0JBQWtCLENBQUMsc0JBQXNCO1lBQ3hFLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO1NBQzVELENBQUMsQ0FBQztRQUVILGtCQUFrQixDQUFDLGNBQWMsQ0FDL0IsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQzNELENBQUM7UUFFRix5QkFBeUI7UUFDekIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDaEMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRztZQUNuQixXQUFXLEVBQUUsaUJBQWlCO1lBQzlCLFVBQVUsRUFBRSxlQUFlO1NBQzVCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQy9CLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVM7WUFDekIsV0FBVyxFQUFFLGdCQUFnQjtZQUM3QixVQUFVLEVBQUUsY0FBYztTQUMzQixDQUFDLENBQUM7UUFFSCw2Q0FBNkM7UUFDN0MsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUNoRCxLQUFLLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVE7WUFDeEMsV0FBVyxFQUFFLHFDQUFxQztZQUNsRCxVQUFVLEVBQUUsd0JBQXdCO1NBQ3JDLENBQUMsQ0FBQztRQUVILHlDQUF5QztRQUN6QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSwyQkFBMkI7WUFDbEMsV0FBVyxFQUFFLCtDQUErQztTQUM3RCxDQUFDLENBQUM7UUFFSCxrQ0FBa0M7UUFDbEMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUseURBQXlELElBQUksQ0FBQyxNQUFNLG9CQUFvQixrQkFBa0IsQ0FBQyxhQUFhLEVBQUU7WUFDakksV0FBVyxFQUFFLG9EQUFvRDtTQUNsRSxDQUFDLENBQUM7UUFFSCxvQkFBb0I7UUFDcEIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNqRCxLQUFLLEVBQUUsb0JBQW9CLENBQUMsUUFBUTtZQUNwQyxXQUFXLEVBQUUsNkJBQTZCO1NBQzNDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGNBQWMsQ0FBQyxRQUFRO1lBQzlCLFdBQVcsRUFBRSxnQ0FBZ0M7U0FDOUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtZQUNsQyxXQUFXLEVBQUUsMEJBQTBCO1NBQ3hDLENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSx3QkFBd0IsQ0FBQyxXQUFXO1lBQzNDLFdBQVcsRUFBRSxnQ0FBZ0M7WUFDN0MsVUFBVSxFQUFFLG9CQUFvQjtTQUNqQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSx3QkFBd0IsQ0FBQyxZQUFZO1lBQzVDLFdBQVcsRUFBRSxpQ0FBaUM7WUFDOUMsVUFBVSxFQUFFLHFCQUFxQjtTQUNsQyxDQUFDLENBQUM7UUFFSCxrQ0FBa0M7UUFDbEMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsYUFBYSxDQUFDLE9BQU87WUFDNUIsV0FBVyxFQUFFLHFDQUFxQztZQUNsRCxVQUFVLEVBQUUsa0JBQWtCO1NBQy9CLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGFBQWEsQ0FBQyxRQUFRO1lBQzdCLFdBQVcsRUFBRSxzQ0FBc0M7U0FDcEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsMENBQTBDO1lBQ2pELFdBQVcsRUFBRSxxQkFBcUI7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsdUNBQXVDO1FBQ3ZDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDbkQsS0FBSyxFQUFFLHdCQUF3QixDQUFDLFdBQVc7WUFDM0MsV0FBVyxFQUFFLCtDQUErQztZQUM1RCxVQUFVLEVBQUUsMkJBQTJCO1NBQ3hDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsNEJBQTRCLEVBQUU7WUFDcEQsS0FBSyxFQUFFLHdCQUF3QixDQUFDLFlBQVk7WUFDNUMsV0FBVyxFQUFFLGdEQUFnRDtZQUM3RCxVQUFVLEVBQUUsNEJBQTRCO1NBQ3pDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLHVCQUF1QjtZQUM3QyxXQUFXLEVBQUUsdUNBQXVDO1NBQ3JELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTl2Q0Qsb0NBOHZDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHNzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3NtJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaF9hY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgZXZlbnRzX3RhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuaW50ZXJmYWNlIEJhY2tlbmRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBwcm9kdWN0c1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgY3JlYXRvcnNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIGFuYWx5dGljc0V2ZW50c1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgYW5hbHl0aWNzU3VtbWFyaWVzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBpbWFnZXNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG59XG5cbmV4cG9ydCBjbGFzcyBCYWNrZW5kU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBwcmljZVN5bmNBbGVydFRvcGljOiBzbnMuVG9waWM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJhY2tlbmRTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHByb2R1Y3RzVGFibGUsIGNyZWF0b3JzVGFibGUsIGFuYWx5dGljc0V2ZW50c1RhYmxlLCBhbmFseXRpY3NTdW1tYXJpZXNUYWJsZSwgaW1hZ2VzQnVja2V0LCB1c2VyUG9vbCB9ID0gcHJvcHM7XG5cbiAgICAvLyBDcmVhdGUgU05TIHRvcGljIGZvciBwcmljZSBzeW5jIGFsZXJ0c1xuICAgIHRoaXMucHJpY2VTeW5jQWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ1ByaWNlU3luY0FsZXJ0VG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXByaWNlLXN5bmMtYWxlcnRzJyxcbiAgICAgIGRpc3BsYXlOYW1lOiAnQW1hem9uIFByaWNlIFN5bmMgQWxlcnRzJyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBQYXJhbWV0ZXIgU3RvcmUgcGFyYW1ldGVycyBmb3IgUEEtQVBJIGNyZWRlbnRpYWxzXG4gICAgLy8gTm90ZTogVGhlc2UgYXJlIHBsYWNlaG9sZGVycyAtIGFjdHVhbCB2YWx1ZXMgbXVzdCBiZSBzZXQgbWFudWFsbHkgdmlhIEFXUyBDb25zb2xlIG9yIENMSVxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdQQUFQSUFjY2Vzc0tleScsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICcvYW1hem9uLWFmZmlsaWF0ZS9wYS1hcGkvYWNjZXNzLWtleScsXG4gICAgICBzdHJpbmdWYWx1ZTogJ1BMQUNFSE9MREVSX0FDQ0VTU19LRVknLFxuICAgICAgZGVzY3JpcHRpb246ICdBbWF6b24gUHJvZHVjdCBBZHZlcnRpc2luZyBBUEkgQWNjZXNzIEtleScsXG4gICAgICB0aWVyOiBzc20uUGFyYW1ldGVyVGllci5TVEFOREFSRCxcbiAgICB9KTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdQQUFQSVNlY3JldEtleScsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICcvYW1hem9uLWFmZmlsaWF0ZS9wYS1hcGkvc2VjcmV0LWtleScsXG4gICAgICBzdHJpbmdWYWx1ZTogJ1BMQUNFSE9MREVSX1NFQ1JFVF9LRVknLFxuICAgICAgZGVzY3JpcHRpb246ICdBbWF6b24gUHJvZHVjdCBBZHZlcnRpc2luZyBBUEkgU2VjcmV0IEtleScsXG4gICAgICB0aWVyOiBzc20uUGFyYW1ldGVyVGllci5TVEFOREFSRCxcbiAgICB9KTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdQQUFQSVBhcnRuZXJUYWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnL2FtYXpvbi1hZmZpbGlhdGUvcGEtYXBpL3BhcnRuZXItdGFnJyxcbiAgICAgIHN0cmluZ1ZhbHVlOiAnUExBQ0VIT0xERVJfUEFSVE5FUl9UQUcnLFxuICAgICAgZGVzY3JpcHRpb246ICdBbWF6b24gQXNzb2NpYXRlcyBQYXJ0bmVyIFRhZycsXG4gICAgICB0aWVyOiBzc20uUGFyYW1ldGVyVGllci5TVEFOREFSRCxcbiAgICB9KTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdQQUFQSU1hcmtldHBsYWNlJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogJy9hbWF6b24tYWZmaWxpYXRlL3BhLWFwaS9tYXJrZXRwbGFjZScsXG4gICAgICBzdHJpbmdWYWx1ZTogJ3d3dy5hbWF6b24uY29tJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW1hem9uIE1hcmtldHBsYWNlIChkZWZhdWx0OiBVUyknLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgSUFNIHJvbGUgZm9yIExhbWJkYSBmdW5jdGlvbnNcbiAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdMYW1iZGFFeGVjdXRpb25Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgRHluYW1vREIgcGVybWlzc2lvbnNcbiAgICBwcm9kdWN0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFSb2xlKTtcbiAgICBjcmVhdG9yc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFSb2xlKTtcbiAgICBhbmFseXRpY3NFdmVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG4gICAgYW5hbHl0aWNzU3VtbWFyaWVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuXG4gICAgLy8gR3JhbnQgUzMgcGVybWlzc2lvbnNcbiAgICBpbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUobGFtYmRhUm9sZSk7XG5cbiAgICAvLyBHcmFudCBDb2duaXRvIHBlcm1pc3Npb25zIGZvciB1c2VyIG1hbmFnZW1lbnRcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5EZWxldGVVc2VyJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5VcGRhdGVVc2VyQXR0cmlidXRlcycsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluU2V0VXNlclBhc3N3b3JkJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5BZGRVc2VyVG9Hcm91cCcsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluUmVtb3ZlVXNlckZyb21Hcm91cCcsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluTGlzdEdyb3Vwc0ZvclVzZXInLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpMaXN0VXNlcnMnLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpMaXN0VXNlcnNJbkdyb3VwJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbdXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgU0VTIHBlcm1pc3Npb25zIGZvciBzZW5kaW5nIGVtYWlsc1xuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdzZXM6U2VuZEVtYWlsJyxcbiAgICAgICAgICAnc2VzOlNlbmRSYXdFbWFpbCcsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sIC8vIFNFUyByZXF1aXJlcyAqIGZvciBlbWFpbCBzZW5kaW5nXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBQYXJhbWV0ZXIgU3RvcmUgcGVybWlzc2lvbnMgZm9yIFBBLUFQSSBjcmVkZW50aWFsc1xuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcbiAgICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpzc206JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnBhcmFtZXRlci9hbWF6b24tYWZmaWxpYXRlLypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgU05TIHBlcm1pc3Npb25zIGZvciBwcmljZSBzeW5jIGFsZXJ0c1xuICAgIHRoaXMucHJpY2VTeW5jQWxlcnRUb3BpYy5ncmFudFB1Ymxpc2gobGFtYmRhUm9sZSk7XG5cbiAgICAvLyBHcmFudCBDbG91ZFdhdGNoIHBlcm1pc3Npb25zIGZvciBjdXN0b20gbWV0cmljc1xuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdjbG91ZHdhdGNoOlB1dE1ldHJpY0RhdGEnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLCAvLyBDbG91ZFdhdGNoIG1ldHJpY3MgcmVxdWlyZSAqIHJlc291cmNlXG4gICAgICB9KVxuICAgICk7XG5cblxuXG4gICAgLy8gQ29tbW9uIExhbWJkYSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICBjb25zdCBjb21tb25FbnZpcm9ubWVudCA9IHtcbiAgICAgIFBST0RVQ1RTX1RBQkxFX05BTUU6IHByb2R1Y3RzVGFibGUudGFibGVOYW1lLFxuICAgICAgQ1JFQVRPUlNfVEFCTEVfTkFNRTogY3JlYXRvcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBBTkFMWVRJQ1NfRVZFTlRTX1RBQkxFX05BTUU6IGFuYWx5dGljc0V2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIEFOQUxZVElDU19TVU1NQVJJRVNfVEFCTEVfTkFNRTogYW5hbHl0aWNzU3VtbWFyaWVzVGFibGUudGFibGVOYW1lLFxuICAgICAgSU1BR0VTX0JVQ0tFVF9OQU1FOiBpbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgfTtcblxuICAgIC8vIENvbW1vbiBMYW1iZGEgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IGxhbWJkYUNvbmZpZyA9IHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9O1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbnMgLSB1c2luZyBjb21waWxlZCBkaXN0IGZvbGRlclxuICAgIGNvbnN0IGdldFByb2R1Y3RzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRQcm9kdWN0c0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1nZXRQcm9kdWN0cycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvZ2V0UHJvZHVjdHMvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBhbGwgcHJvZHVjdHMgd2l0aCBvcHRpb25hbCBjYXRlZ29yeSBmaWx0ZXJpbmcnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0UHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0UHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1nZXRQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9nZXRQcm9kdWN0L2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgYSBzaW5nbGUgcHJvZHVjdCBieSBJRCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBjcmVhdGVQcm9kdWN0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDcmVhdGVQcm9kdWN0RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWNyZWF0ZVByb2R1Y3QnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2NyZWF0ZVByb2R1Y3QvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NyZWF0ZSBhIG5ldyBwcm9kdWN0JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVwZGF0ZVByb2R1Y3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VwZGF0ZVByb2R1Y3RGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtdXBkYXRlUHJvZHVjdCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvdXBkYXRlUHJvZHVjdC9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXBkYXRlIGFuIGV4aXN0aW5nIHByb2R1Y3QnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGVsZXRlUHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRGVsZXRlUHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1kZWxldGVQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9kZWxldGVQcm9kdWN0L2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdEZWxldGUgYSBwcm9kdWN0JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVwbG9hZEltYWdlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVcGxvYWRJbWFnZUZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS11cGxvYWRJbWFnZScsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvdXBsb2FkSW1hZ2UvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dlbmVyYXRlIHByZXNpZ25lZCBVUkwgZm9yIGltYWdlIHVwbG9hZCcsXG4gICAgfSk7XG5cbiAgICAvLyBVc2VyIE1hbmFnZW1lbnQgTGFtYmRhIEZ1bmN0aW9uc1xuICAgIGNvbnN0IGNyZWF0ZVVzZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NyZWF0ZVVzZXJGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtY3JlYXRlVXNlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvY3JlYXRlVXNlci9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIGEgbmV3IGFkbWluIHVzZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbGlzdFVzZXJzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMaXN0VXNlcnNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtbGlzdFVzZXJzJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9saXN0VXNlcnMvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0xpc3QgYWxsIHVzZXJzJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRlbGV0ZVVzZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0RlbGV0ZVVzZXJGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtZGVsZXRlVXNlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvZGVsZXRlVXNlci9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGVsZXRlIGEgdXNlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNldFBhc3N3b3JkRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZXNldFBhc3N3b3JkRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXJlc2V0UGFzc3dvcmQnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL3Jlc2V0UGFzc3dvcmQvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Jlc2V0IHVzZXIgcGFzc3dvcmQnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYWRtaW5HZXRQcm9kdWN0c0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQWRtaW5HZXRQcm9kdWN0c0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1hZG1pbkdldFByb2R1Y3RzJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9hZG1pbkdldFByb2R1Y3RzL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgYWxsIHByb2R1Y3RzIGZvciBhZG1pbiAoaW5jbHVkaW5nIHVucHVibGlzaGVkKScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRDYXRlZ29yaWVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRDYXRlZ29yaWVzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWdldENhdGVnb3JpZXMnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2dldENhdGVnb3JpZXMvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBhbGwgcHJvZHVjdCBjYXRlZ29yaWVzJyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZFdhdGNoIExvZyBHcm91cCBmb3IgUHJpY2UgU3luYyBMYW1iZGFcbiAgICAvLyBSZXF1aXJlbWVudCA4LjQ6IEFkZCBDbG91ZFdhdGNoIGxvZyBncm91cFxuICAgIGNvbnN0IHByaWNlU3luY0xvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ1ByaWNlU3luY0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiAnL2F3cy9sYW1iZGEvcGludGVyZXN0LWFmZmlsaWF0ZS1zeW5jQW1hem9uUHJpY2VzJyxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBQcmljZSBTeW5jIExhbWJkYSBGdW5jdGlvblxuICAgIC8vIFJlcXVpcmVtZW50cyAzLjEsIDMuMjogU2NoZWR1bGVkIExhbWJkYSBmb3IgYXV0b21hdGljIHByaWNlIHN5bmNocm9uaXphdGlvblxuICAgIGNvbnN0IHN5bmNBbWF6b25QcmljZXNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N5bmNBbWF6b25QcmljZXNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtc3luY0FtYXpvblByaWNlcycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvc3luY0FtYXpvblByaWNlcy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3luY2hyb25pemUgcHJvZHVjdCBwcmljZXMgd2l0aCBBbWF6b24gUEEtQVBJJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDEwKSwgLy8gTG9uZ2VyIHRpbWVvdXQgZm9yIGJhdGNoIHByb2Nlc3NpbmdcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsIC8vIE1vcmUgbWVtb3J5IGZvciBwcm9jZXNzaW5nIG11bHRpcGxlIHByb2R1Y3RzXG4gICAgICBsb2dHcm91cDogcHJpY2VTeW5jTG9nR3JvdXAsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcbiAgICAgICAgU05TX1RPUElDX0FSTjogdGhpcy5wcmljZVN5bmNBbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBFdmVudEJyaWRnZSBydWxlIGZvciBzY2hlZHVsZWQgZXhlY3V0aW9uXG4gICAgLy8gUmVxdWlyZW1lbnQgMy4xOiBTY2hlZHVsZSB0byBydW4gZGFpbHkgYXQgMiBBTSBVVENcbiAgICBjb25zdCBwcmljZVN5bmNSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdQcmljZVN5bmNTY2hlZHVsZVJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtcHJpY2Utc3luYy1kYWlseScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHByaWNlIHN5bmMgTGFtYmRhIGRhaWx5IGF0IDIgQU0gVVRDJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnMicsXG4gICAgICAgIGRheTogJyonLFxuICAgICAgICBtb250aDogJyonLFxuICAgICAgICB5ZWFyOiAnKicsXG4gICAgICB9KSxcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgTGFtYmRhIGFzIHRhcmdldCB3aXRoIHJldHJ5IHBvbGljeVxuICAgIC8vIFJlcXVpcmVtZW50IDMuMjogQ29uZmlndXJlIHJldHJ5IHBvbGljeSAoMiByZXRyaWVzIHdpdGggZXhwb25lbnRpYWwgYmFja29mZilcbiAgICBwcmljZVN5bmNSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyBldmVudHNfdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihzeW5jQW1hem9uUHJpY2VzRnVuY3Rpb24sIHtcbiAgICAgICAgcmV0cnlBdHRlbXB0czogMixcbiAgICAgICAgbWF4RXZlbnRBZ2U6IGNkay5EdXJhdGlvbi5ob3VycygyKSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IEV2ZW50QnJpZGdlIHBlcm1pc3Npb24gdG8gaW52b2tlIHRoZSBMYW1iZGFcbiAgICBzeW5jQW1hem9uUHJpY2VzRnVuY3Rpb24uZ3JhbnRJbnZva2UobmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdldmVudHMuYW1hem9uYXdzLmNvbScpKTtcblxuICAgIC8vIENyZWF0ZSBNYW51YWwgUHJpY2UgU3luYyBUcmlnZ2VyIExhbWJkYSBGdW5jdGlvblxuICAgIC8vIFJlcXVpcmVtZW50IDMuNDogTWFudWFsIHN5bmMgdHJpZ2dlciBlbmRwb2ludCBmb3IgYWRtaW5pc3RyYXRvcnNcbiAgICBjb25zdCB0cmlnZ2VyUHJpY2VTeW5jRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdUcmlnZ2VyUHJpY2VTeW5jRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXRyaWdnZXJQcmljZVN5bmMnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL3RyaWdnZXJQcmljZVN5bmMvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ01hbnVhbGx5IHRyaWdnZXIgcHJpY2Ugc3luYyB3aXRoIEFtYXpvbiBQQS1BUEknLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXG4gICAgICAgIFBSSUNFX1NZTkNfTEFNQkRBX05BTUU6IHN5bmNBbWF6b25QcmljZXNGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbiB0byBpbnZva2UgdGhlIHByaWNlIHN5bmMgTGFtYmRhXG4gICAgLy8gTm90ZTogRHVlIHRvIGNpcmN1bGFyIGRlcGVuZGVuY3kgd2l0aCBzaGFyZWQgTGFtYmRhIHJvbGUsIHRoaXMgcGVybWlzc2lvblxuICAgIC8vIGlzIGFkZGVkIG1hbnVhbGx5IHZpYSBBV1MgQ0xJIGFmdGVyIGRlcGxveW1lbnRcbiAgICAvLyBDb21tYW5kOiBhd3MgaWFtIHB1dC1yb2xlLXBvbGljeSAtLXJvbGUtbmFtZSA8TGFtYmRhRXhlY3V0aW9uUm9sZT4gLS1wb2xpY3ktbmFtZSBJbnZva2VQcmljZVN5bmNMYW1iZGEgLS1wb2xpY3ktZG9jdW1lbnQgJ3tcIlZlcnNpb25cIjpcIjIwMTItMTAtMTdcIixcIlN0YXRlbWVudFwiOlt7XCJFZmZlY3RcIjpcIkFsbG93XCIsXCJBY3Rpb25cIjpcImxhbWJkYTpJbnZva2VGdW5jdGlvblwiLFwiUmVzb3VyY2VcIjpcImFybjphd3M6bGFtYmRhOlJFR0lPTjpBQ0NPVU5UOmZ1bmN0aW9uOnBpbnRlcmVzdC1hZmZpbGlhdGUtc3luY0FtYXpvblByaWNlc1wifV19J1xuXG4gICAgLy8gQ3JlYXRlIEdldCBTeW5jIEhpc3RvcnkgTGFtYmRhIEZ1bmN0aW9uXG4gICAgLy8gUmVxdWlyZW1lbnQgNi40OiBEaXNwbGF5IHN5bmMgZXhlY3V0aW9uIGxvZ3MgaW4gYWRtaW4gcGFuZWxcbiAgICBjb25zdCBnZXRTeW5jSGlzdG9yeUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0U3luY0hpc3RvcnlGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtZ2V0U3luY0hpc3RvcnknLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2dldFN5bmNIaXN0b3J5L2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdSZXRyaWV2ZSBwcmljZSBzeW5jIGV4ZWN1dGlvbiBoaXN0b3J5IGZyb20gQ2xvdWRXYXRjaCBMb2dzJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IENsb3VkV2F0Y2ggTG9ncyByZWFkIHBlcm1pc3Npb25zXG4gICAgZ2V0U3luY0hpc3RvcnlGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdsb2dzOkZpbHRlckxvZ0V2ZW50cycsXG4gICAgICAgICAgJ2xvZ3M6RGVzY3JpYmVMb2dTdHJlYW1zJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvbGFtYmRhL3N5bmNBbWF6b25QcmljZXM6KmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgQ29nbml0byBBdXRob3JpemVyIGZvciBBUEkgR2F0ZXdheVxuICAgIGNvbnN0IGF1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcih0aGlzLCAnQ29nbml0b0F1dGhvcml6ZXInLCB7XG4gICAgICBjb2duaXRvVXNlclBvb2xzOiBbdXNlclBvb2xdLFxuICAgICAgYXV0aG9yaXplck5hbWU6ICdBZG1pbkF1dGhvcml6ZXInLFxuICAgICAgaWRlbnRpdHlTb3VyY2U6ICdtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aG9yaXphdGlvbicsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXlcbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1BpbnRlcmVzdEFmZmlsaWF0ZUFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnUGludGVyZXN0IEFmZmlsaWF0ZSBBUEknLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIFBpbnRlcmVzdCBBZmZpbGlhdGUgUGxhdGZvcm0nLFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6ICdwcm9kJyxcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBhcGlnYXRld2F5Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgLy8gRGlzYWJsZSBjYWNoaW5nIGJ5IGRlZmF1bHQgKHdpbGwgZW5hYmxlIG9ubHkgZm9yIHB1YmxpYyBlbmRwb2ludHMpXG4gICAgICAgIGNhY2hpbmdFbmFibGVkOiBmYWxzZSxcbiAgICAgICAgLy8gRW5hYmxlIHRocm90dGxpbmcgYXQgdGhlIHN0YWdlIGxldmVsXG4gICAgICAgIHRocm90dGxpbmdCdXJzdExpbWl0OiA1MDAwLCAvLyBNYXhpbXVtIGNvbmN1cnJlbnQgcmVxdWVzdHNcbiAgICAgICAgdGhyb3R0bGluZ1JhdGVMaW1pdDogMTAwMDAsIC8vIE1heGltdW0gcmVxdWVzdHMgcGVyIHNlY29uZFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICdYLUFtei1EYXRlJyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQVBJIHJlc291cmNlcyBhbmQgbWV0aG9kc1xuICAgIGNvbnN0IGFwaVJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnYXBpJyk7XG5cbiAgICAvLyBQdWJsaWMgZW5kcG9pbnRzIHdpdGggY2FjaGluZ1xuICAgIGNvbnN0IHByb2R1Y3RzUmVzb3VyY2UgPSBhcGlSZXNvdXJjZS5hZGRSZXNvdXJjZSgncHJvZHVjdHMnKTtcbiAgICBwcm9kdWN0c1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZHVjdHNGdW5jdGlvbiwge1xuICAgICAgICBjYWNoZUtleVBhcmFtZXRlcnM6IFsnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuY2F0ZWdvcnknXSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5jYXRlZ29yeSc6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5DYWNoZS1Db250cm9sJzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgcHJvZHVjdFJlc291cmNlID0gcHJvZHVjdHNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xuICAgIHByb2R1Y3RSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFByb2R1Y3RGdW5jdGlvbiwge1xuICAgICAgICBjYWNoZUtleVBhcmFtZXRlcnM6IFsnbWV0aG9kLnJlcXVlc3QucGF0aC5pZCddLFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGguaWQnOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5DYWNoZS1Db250cm9sJzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ2F0ZWdvcmllcyBlbmRwb2ludFxuICAgIGNvbnN0IGNhdGVnb3JpZXNSZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFJlc291cmNlKCdjYXRlZ29yaWVzJyk7XG4gICAgY2F0ZWdvcmllc1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0Q2F0ZWdvcmllc0Z1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQ2FjaGUtQ29udHJvbCc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEFkbWluIGVuZHBvaW50cyAocHJvdGVjdGVkIGJ5IENvZ25pdG8pXG4gICAgY29uc3QgYWRtaW5SZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFJlc291cmNlKCdhZG1pbicpO1xuICAgIGNvbnN0IGFkbWluUHJvZHVjdHNSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Byb2R1Y3RzJyk7XG5cbiAgICAvLyBHRVQgYWxsIHByb2R1Y3RzIChhZG1pbiAtIGluY2x1ZGVzIHVucHVibGlzaGVkKVxuICAgIGFkbWluUHJvZHVjdHNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFkbWluR2V0UHJvZHVjdHNGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIGFkbWluUHJvZHVjdHNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUE9TVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVQcm9kdWN0RnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBhZG1pblByb2R1Y3RSZXNvdXJjZSA9IGFkbWluUHJvZHVjdHNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xuICAgIGFkbWluUHJvZHVjdFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQVVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXBkYXRlUHJvZHVjdEZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuICAgIGFkbWluUHJvZHVjdFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdERUxFVEUnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZGVsZXRlUHJvZHVjdEZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgdXBsb2FkSW1hZ2VSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3VwbG9hZC1pbWFnZScpO1xuICAgIHVwbG9hZEltYWdlUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXBsb2FkSW1hZ2VGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFVzZXIgTWFuYWdlbWVudCBlbmRwb2ludHMgKHByb3RlY3RlZCBieSBDb2duaXRvKVxuICAgIGNvbnN0IHVzZXJzUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCd1c2VycycpO1xuICAgIHVzZXJzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsaXN0VXNlcnNGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcbiAgICB1c2Vyc1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQT1NUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNyZWF0ZVVzZXJGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IHVzZXJSZXNvdXJjZSA9IHVzZXJzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3t1c2VybmFtZX0nKTtcbiAgICB1c2VyUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0RFTEVURScsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihkZWxldGVVc2VyRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCByZXNldFBhc3N3b3JkUmVzb3VyY2UgPSB1c2VyUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Jlc2V0LXBhc3N3b3JkJyk7XG4gICAgcmVzZXRQYXNzd29yZFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQT1NUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHJlc2V0UGFzc3dvcmRGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIE1hbnVhbCBQcmljZSBTeW5jIFRyaWdnZXIgZW5kcG9pbnQgKHByb3RlY3RlZCBieSBDb2duaXRvKVxuICAgIC8vIFJlcXVpcmVtZW50IDMuNDogUE9TVCAvYWRtaW4vc3luYy1wcmljZXMgQVBJIGVuZHBvaW50XG4gICAgY29uc3Qgc3luY1ByaWNlc1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3luYy1wcmljZXMnKTtcbiAgICBzeW5jUHJpY2VzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odHJpZ2dlclByaWNlU3luY0Z1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gU3luYyBIaXN0b3J5IGVuZHBvaW50IChwcm90ZWN0ZWQgYnkgQ29nbml0bylcbiAgICAvLyBSZXF1aXJlbWVudCA2LjQ6IEdFVCAvYWRtaW4vc3luYy1oaXN0b3J5IEFQSSBlbmRwb2ludFxuICAgIGNvbnN0IHN5bmNIaXN0b3J5UmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdzeW5jLWhpc3RvcnknKTtcbiAgICBzeW5jSGlzdG9yeVJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0U3luY0hpc3RvcnlGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBNdWx0aS1DcmVhdG9yIFBsYXRmb3JtIEFQSSBSb3V0ZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9ucyBmb3IgbXVsdGktY3JlYXRvciBwbGF0Zm9ybVxuICAgIGNvbnN0IGNyZWF0ZUNyZWF0b3JGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NyZWF0ZUNyZWF0b3JGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtY3JlYXRlQ3JlYXRvcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvY3JlYXRlQ3JlYXRvci9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIGEgbmV3IGNyZWF0b3IgcHJvZmlsZScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRDcmVhdG9yQnlTbHVnRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRDcmVhdG9yQnlTbHVnRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWdldENyZWF0b3JCeVNsdWcnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2dldENyZWF0b3JCeVNsdWcvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBjcmVhdG9yIHByb2ZpbGUgYnkgc2x1ZycsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGRhdGVDcmVhdG9yUHJvZmlsZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlQ3JlYXRvclByb2ZpbGVGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtdXBkYXRlQ3JlYXRvclByb2ZpbGUnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL3VwZGF0ZUNyZWF0b3JQcm9maWxlL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdVcGRhdGUgY3JlYXRvciBwcm9maWxlJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldENyZWF0b3JBbmFseXRpY3NGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldENyZWF0b3JBbmFseXRpY3NGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtZ2V0Q3JlYXRvckFuYWx5dGljcycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvZ2V0Q3JlYXRvckFuYWx5dGljcy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IGNyZWF0b3IgYW5hbHl0aWNzJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHRyYWNrUGFnZVZpZXdGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1RyYWNrUGFnZVZpZXdGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtdHJhY2tQYWdlVmlldycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvdHJhY2tQYWdlVmlldy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHJhY2sgcGFnZSB2aWV3IGV2ZW50JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHRyYWNrQWZmaWxpYXRlQ2xpY2tGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1RyYWNrQWZmaWxpYXRlQ2xpY2tGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtdHJhY2tBZmZpbGlhdGVDbGljaycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvdHJhY2tBZmZpbGlhdGVDbGljay9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHJhY2sgYWZmaWxpYXRlIGNsaWNrIGV2ZW50JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldFBlbmRpbmdQcm9kdWN0c0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0UGVuZGluZ1Byb2R1Y3RzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWdldFBlbmRpbmdQcm9kdWN0cycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvZ2V0UGVuZGluZ1Byb2R1Y3RzL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgYWxsIHBlbmRpbmcgcHJvZHVjdHMgZm9yIG1vZGVyYXRpb24nLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXBwcm92ZVByb2R1Y3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwcHJvdmVQcm9kdWN0RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWFwcHJvdmVQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9hcHByb3ZlUHJvZHVjdC9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXBwcm92ZSBhIHByb2R1Y3QnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVqZWN0UHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUmVqZWN0UHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1yZWplY3RQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9yZWplY3RQcm9kdWN0L2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWplY3QgYSBwcm9kdWN0JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGxpc3RBbGxDcmVhdG9yc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTGlzdEFsbENyZWF0b3JzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWxpc3RBbGxDcmVhdG9ycycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvbGlzdEFsbENyZWF0b3JzL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdMaXN0IGFsbCBjcmVhdG9ycyAoYWRtaW4pJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVwZGF0ZUNyZWF0b3JTdGF0dXNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VwZGF0ZUNyZWF0b3JTdGF0dXNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtdXBkYXRlQ3JlYXRvclN0YXR1cycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvdXBkYXRlQ3JlYXRvclN0YXR1cy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXBkYXRlIGNyZWF0b3Igc3RhdHVzIChhZG1pbiknLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFB1YmxpYyBDcmVhdG9yIFJvdXRlcyAoTm8gQXV0aCBSZXF1aXJlZClcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBHRVQgL2FwaS9jcmVhdG9ycy97c2x1Z31cbiAgICBjb25zdCBjcmVhdG9yc1Jlc291cmNlID0gYXBpUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2NyZWF0b3JzJyk7XG4gICAgY29uc3QgY3JlYXRvclNsdWdSZXNvdXJjZSA9IGNyZWF0b3JzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tzbHVnfScpO1xuICAgIGNyZWF0b3JTbHVnUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRDcmVhdG9yQnlTbHVnRnVuY3Rpb24sIHtcbiAgICAgICAgY2FjaGVLZXlQYXJhbWV0ZXJzOiBbJ21ldGhvZC5yZXF1ZXN0LnBhdGguc2x1ZyddLFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGguc2x1Zyc6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkNhY2hlLUNvbnRyb2wnOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHRVQgL2FwaS9jcmVhdG9ycy97c2x1Z30vcHJvZHVjdHNcbiAgICBjb25zdCBjcmVhdG9yUHJvZHVjdHNSZXNvdXJjZSA9IGNyZWF0b3JTbHVnUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Byb2R1Y3RzJyk7XG4gICAgY3JlYXRvclByb2R1Y3RzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRQcm9kdWN0c0Z1bmN0aW9uLCB7XG4gICAgICAgIGNhY2hlS2V5UGFyYW1ldGVyczogW1xuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5wYXRoLnNsdWcnLFxuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5jYXRlZ29yeScsXG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnNlYXJjaCcsXG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnNvcnQnLFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGguc2x1Zyc6IHRydWUsXG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmNhdGVnb3J5JzogZmFsc2UsXG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnNlYXJjaCc6IGZhbHNlLFxuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5zb3J0JzogZmFsc2UsXG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmxpbWl0JzogZmFsc2UsXG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLm9mZnNldCc6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5DYWNoZS1Db250cm9sJzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR0VUIC9hcGkvY3JlYXRvcnMve3NsdWd9L2ZlYXR1cmVkXG4gICAgY29uc3QgY3JlYXRvckZlYXR1cmVkUmVzb3VyY2UgPSBjcmVhdG9yU2x1Z1Jlc291cmNlLmFkZFJlc291cmNlKCdmZWF0dXJlZCcpO1xuICAgIGNyZWF0b3JGZWF0dXJlZFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZHVjdHNGdW5jdGlvbiwge1xuICAgICAgICBjYWNoZUtleVBhcmFtZXRlcnM6IFsnbWV0aG9kLnJlcXVlc3QucGF0aC5zbHVnJ10sXG4gICAgICB9KSxcbiAgICAgIHtcbiAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QucGF0aC5zbHVnJzogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQ2FjaGUtQ29udHJvbCc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDcmVhdG9yIFJvdXRlcyAoQ3JlYXRvciBBdXRoIFJlcXVpcmVkKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IGNyZWF0b3JSZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFJlc291cmNlKCdjcmVhdG9yJyk7XG5cbiAgICAvLyBHRVQgL2FwaS9jcmVhdG9yL3Byb2ZpbGVcbiAgICAvLyBQVVQgL2FwaS9jcmVhdG9yL3Byb2ZpbGVcbiAgICBjb25zdCBjcmVhdG9yUHJvZmlsZVJlc291cmNlID0gY3JlYXRvclJlc291cmNlLmFkZFJlc291cmNlKCdwcm9maWxlJyk7XG4gICAgY3JlYXRvclByb2ZpbGVSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldENyZWF0b3JCeVNsdWdGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcbiAgICBjcmVhdG9yUHJvZmlsZVJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQVVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXBkYXRlQ3JlYXRvclByb2ZpbGVGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEdFVCAvYXBpL2NyZWF0b3IvcHJvZHVjdHNcbiAgICAvLyBQT1NUIC9hcGkvY3JlYXRvci9wcm9kdWN0c1xuICAgIGNvbnN0IGNyZWF0b3JPd25Qcm9kdWN0c1Jlc291cmNlID0gY3JlYXRvclJlc291cmNlLmFkZFJlc291cmNlKCdwcm9kdWN0cycpO1xuICAgIGNyZWF0b3JPd25Qcm9kdWN0c1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZHVjdHNGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcbiAgICBjcmVhdG9yT3duUHJvZHVjdHNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUE9TVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVQcm9kdWN0RnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBQVVQgL2FwaS9jcmVhdG9yL3Byb2R1Y3RzL3tpZH1cbiAgICAvLyBERUxFVEUgL2FwaS9jcmVhdG9yL3Byb2R1Y3RzL3tpZH1cbiAgICBjb25zdCBjcmVhdG9yUHJvZHVjdFJlc291cmNlID0gY3JlYXRvck93blByb2R1Y3RzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICBjcmVhdG9yUHJvZHVjdFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQVVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXBkYXRlUHJvZHVjdEZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuICAgIGNyZWF0b3JQcm9kdWN0UmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0RFTEVURScsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihkZWxldGVQcm9kdWN0RnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHRVQgL2FwaS9jcmVhdG9yL2FuYWx5dGljc1xuICAgIGNvbnN0IGNyZWF0b3JBbmFseXRpY3NSZXNvdXJjZSA9IGNyZWF0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYW5hbHl0aWNzJyk7XG4gICAgY3JlYXRvckFuYWx5dGljc1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0Q3JlYXRvckFuYWx5dGljc0Z1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuc3RhcnREYXRlJzogZmFsc2UsXG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmVuZERhdGUnOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEFkbWluIENyZWF0b3IgTWFuYWdlbWVudCBSb3V0ZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBHRVQgL2FwaS9hZG1pbi9jcmVhdG9yc1xuICAgIGNvbnN0IGFkbWluQ3JlYXRvcnNSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2NyZWF0b3JzJyk7XG4gICAgYWRtaW5DcmVhdG9yc1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGlzdEFsbENyZWF0b3JzRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBQT1NUIC9hcGkvYWRtaW4vY3JlYXRvcnMgKGZvciBhZG1pbiB0byBjcmVhdGUgY3JlYXRvcnMpXG4gICAgYWRtaW5DcmVhdG9yc1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQT1NUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNyZWF0ZUNyZWF0b3JGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFBVVCAvYXBpL2FkbWluL2NyZWF0b3JzL3tpZH0vc3RhdHVzXG4gICAgY29uc3QgYWRtaW5DcmVhdG9ySWRSZXNvdXJjZSA9IGFkbWluQ3JlYXRvcnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xuICAgIGNvbnN0IGFkbWluQ3JlYXRvclN0YXR1c1Jlc291cmNlID0gYWRtaW5DcmVhdG9ySWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3RhdHVzJyk7XG4gICAgYWRtaW5DcmVhdG9yU3RhdHVzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BVVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVDcmVhdG9yU3RhdHVzRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHRVQgL2FwaS9hZG1pbi9wcm9kdWN0cy9wZW5kaW5nXG4gICAgY29uc3QgYWRtaW5QZW5kaW5nUmVzb3VyY2UgPSBhZG1pblByb2R1Y3RzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3BlbmRpbmcnKTtcbiAgICBhZG1pblBlbmRpbmdSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFBlbmRpbmdQcm9kdWN0c0Z1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gUFVUIC9hcGkvYWRtaW4vcHJvZHVjdHMve2lkfS9hcHByb3ZlXG4gICAgY29uc3QgYWRtaW5Qcm9kdWN0QXBwcm92ZVJlc291cmNlID0gYWRtaW5Qcm9kdWN0UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FwcHJvdmUnKTtcbiAgICBhZG1pblByb2R1Y3RBcHByb3ZlUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BVVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcHByb3ZlUHJvZHVjdEZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gUFVUIC9hcGkvYWRtaW4vcHJvZHVjdHMve2lkfS9yZWplY3RcbiAgICBjb25zdCBhZG1pblByb2R1Y3RSZWplY3RSZXNvdXJjZSA9IGFkbWluUHJvZHVjdFJlc291cmNlLmFkZFJlc291cmNlKCdyZWplY3QnKTtcbiAgICBhZG1pblByb2R1Y3RSZWplY3RSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUFVUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHJlamVjdFByb2R1Y3RGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBBbmFseXRpY3MgVHJhY2tpbmcgUm91dGVzIChQdWJsaWMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gUE9TVCAvYXBpL2FuYWx5dGljcy9wYWdlLXZpZXdcbiAgICBjb25zdCBhbmFseXRpY3NSZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFJlc291cmNlKCdhbmFseXRpY3MnKTtcbiAgICBjb25zdCBwYWdlVmlld1Jlc291cmNlID0gYW5hbHl0aWNzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3BhZ2UtdmlldycpO1xuICAgIHBhZ2VWaWV3UmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odHJhY2tQYWdlVmlld0Z1bmN0aW9uKVxuICAgICk7XG5cbiAgICAvLyBQT1NUIC9hcGkvYW5hbHl0aWNzL2FmZmlsaWF0ZS1jbGlja1xuICAgIGNvbnN0IGFmZmlsaWF0ZUNsaWNrUmVzb3VyY2UgPSBhbmFseXRpY3NSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYWZmaWxpYXRlLWNsaWNrJyk7XG4gICAgYWZmaWxpYXRlQ2xpY2tSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUE9TVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0cmFja0FmZmlsaWF0ZUNsaWNrRnVuY3Rpb24pXG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBSYXRlIExpbWl0aW5nIENvbmZpZ3VyYXRpb25cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBDcmVhdGUgVXNhZ2UgUGxhbnMgZm9yIGRpZmZlcmVudCB1c2VyIHR5cGVzXG4gICAgLy8gUmVxdWlyZW1lbnRzOiBQZXJmb3JtYW5jZSBhbmQgc2VjdXJpdHlcblxuICAgIC8vIFB1YmxpYyBVc2FnZSBQbGFuIC0gMTAwIHJlcXVlc3RzIHBlciBtaW51dGUgcGVyIElQXG4gICAgY29uc3QgcHVibGljVXNhZ2VQbGFuID0gdGhpcy5hcGkuYWRkVXNhZ2VQbGFuKCdQdWJsaWNVc2FnZVBsYW4nLCB7XG4gICAgICBuYW1lOiAnUHVibGljIEFQSSBVc2FnZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JhdGUgbGltaXRpbmcgZm9yIHB1YmxpYyBlbmRwb2ludHMnLFxuICAgICAgdGhyb3R0bGU6IHtcbiAgICAgICAgcmF0ZUxpbWl0OiAxMDAsIC8vIHJlcXVlc3RzIHBlciBzZWNvbmRcbiAgICAgICAgYnVyc3RMaW1pdDogMjAwLCAvLyBtYXhpbXVtIGNvbmN1cnJlbnQgcmVxdWVzdHNcbiAgICAgIH0sXG4gICAgICBxdW90YToge1xuICAgICAgICBsaW1pdDogMTAwMDAwLCAvLyByZXF1ZXN0cyBwZXIgbW9udGhcbiAgICAgICAgcGVyaW9kOiBhcGlnYXRld2F5LlBlcmlvZC5NT05USCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBc3NvY2lhdGUgcHVibGljIHVzYWdlIHBsYW4gd2l0aCB0aGUgQVBJIHN0YWdlXG4gICAgcHVibGljVXNhZ2VQbGFuLmFkZEFwaVN0YWdlKHtcbiAgICAgIHN0YWdlOiB0aGlzLmFwaS5kZXBsb3ltZW50U3RhZ2UsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdG9yIFVzYWdlIFBsYW4gLSAxMDAwIHJlcXVlc3RzIHBlciBtaW51dGUgcGVyIHVzZXJcbiAgICBjb25zdCBjcmVhdG9yVXNhZ2VQbGFuID0gdGhpcy5hcGkuYWRkVXNhZ2VQbGFuKCdDcmVhdG9yVXNhZ2VQbGFuJywge1xuICAgICAgbmFtZTogJ0NyZWF0b3IgQVBJIFVzYWdlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmF0ZSBsaW1pdGluZyBmb3IgY3JlYXRvciBlbmRwb2ludHMnLFxuICAgICAgdGhyb3R0bGU6IHtcbiAgICAgICAgcmF0ZUxpbWl0OiAxMDAwLCAvLyByZXF1ZXN0cyBwZXIgc2Vjb25kXG4gICAgICAgIGJ1cnN0TGltaXQ6IDIwMDAsIC8vIG1heGltdW0gY29uY3VycmVudCByZXF1ZXN0c1xuICAgICAgfSxcbiAgICAgIHF1b3RhOiB7XG4gICAgICAgIGxpbWl0OiAxMDAwMDAwLCAvLyByZXF1ZXN0cyBwZXIgbW9udGhcbiAgICAgICAgcGVyaW9kOiBhcGlnYXRld2F5LlBlcmlvZC5NT05USCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjcmVhdG9yVXNhZ2VQbGFuLmFkZEFwaVN0YWdlKHtcbiAgICAgIHN0YWdlOiB0aGlzLmFwaS5kZXBsb3ltZW50U3RhZ2UsXG4gICAgfSk7XG5cbiAgICAvLyBBZG1pbiBVc2FnZSBQbGFuIC0gMTAwMDAgcmVxdWVzdHMgcGVyIG1pbnV0ZSBwZXIgdXNlclxuICAgIGNvbnN0IGFkbWluVXNhZ2VQbGFuID0gdGhpcy5hcGkuYWRkVXNhZ2VQbGFuKCdBZG1pblVzYWdlUGxhbicsIHtcbiAgICAgIG5hbWU6ICdBZG1pbiBBUEkgVXNhZ2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdSYXRlIGxpbWl0aW5nIGZvciBhZG1pbiBlbmRwb2ludHMnLFxuICAgICAgdGhyb3R0bGU6IHtcbiAgICAgICAgcmF0ZUxpbWl0OiAxMDAwMCwgLy8gcmVxdWVzdHMgcGVyIHNlY29uZFxuICAgICAgICBidXJzdExpbWl0OiAyMDAwMCwgLy8gbWF4aW11bSBjb25jdXJyZW50IHJlcXVlc3RzXG4gICAgICB9LFxuICAgICAgcXVvdGE6IHtcbiAgICAgICAgbGltaXQ6IDEwMDAwMDAwLCAvLyByZXF1ZXN0cyBwZXIgbW9udGhcbiAgICAgICAgcGVyaW9kOiBhcGlnYXRld2F5LlBlcmlvZC5NT05USCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhZG1pblVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG4gICAgICBzdGFnZTogdGhpcy5hcGkuZGVwbG95bWVudFN0YWdlLFxuICAgIH0pO1xuXG4gICAgLy8gQ29uZmlndXJlIG1ldGhvZC1sZXZlbCB0aHJvdHRsaW5nIGZvciBzcGVjaWZpYyBlbmRwb2ludHNcbiAgICAvLyBUaGlzIHByb3ZpZGVzIG1vcmUgZ3JhbnVsYXIgY29udHJvbCBvdmVyIHJhdGUgbGltaXRzXG5cbiAgICAvLyBQdWJsaWMgZW5kcG9pbnRzIC0gMTAwIHJlcS9taW5cbiAgICBjb25zdCBwdWJsaWNUaHJvdHRsZSA9IHtcbiAgICAgIHRocm90dGxlOiB7XG4gICAgICAgIHJhdGVMaW1pdDogMTAwLFxuICAgICAgICBidXJzdExpbWl0OiAyMDAsXG4gICAgICB9LFxuICAgIH07XG5cbiAgICAvLyBDcmVhdG9yIGVuZHBvaW50cyAtIDEwMDAgcmVxL21pblxuICAgIGNvbnN0IGNyZWF0b3JUaHJvdHRsZSA9IHtcbiAgICAgIHRocm90dGxlOiB7XG4gICAgICAgIHJhdGVMaW1pdDogMTAwMCxcbiAgICAgICAgYnVyc3RMaW1pdDogMjAwMCxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIC8vIEFkbWluIGVuZHBvaW50cyAtIDEwMDAwIHJlcS9taW5cbiAgICBjb25zdCBhZG1pblRocm90dGxlID0ge1xuICAgICAgdGhyb3R0bGU6IHtcbiAgICAgICAgcmF0ZUxpbWl0OiAxMDAwMCxcbiAgICAgICAgYnVyc3RMaW1pdDogMjAwMDAsXG4gICAgICB9LFxuICAgIH07XG5cbiAgICAvLyBOb3RlOiBNZXRob2QtbGV2ZWwgdGhyb3R0bGluZyBpcyBhcHBsaWVkIHRocm91Z2ggdGhlIGRlcGxveW1lbnQgc3RhZ2Ugc2V0dGluZ3NcbiAgICAvLyBUaGUgdXNhZ2UgcGxhbnMgYWJvdmUgcHJvdmlkZSBhY2NvdW50LWxldmVsIHRocm90dGxpbmdcbiAgICAvLyBGb3IgSVAtYmFzZWQgdGhyb3R0bGluZyBvbiBwdWJsaWMgZW5kcG9pbnRzLCBBV1MgV0FGIHdvdWxkIGJlIHJlcXVpcmVkXG5cbiAgICAvLyBPdXRwdXQgdXNhZ2UgcGxhbiBJRHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHVibGljVXNhZ2VQbGFuSWQnLCB7XG4gICAgICB2YWx1ZTogcHVibGljVXNhZ2VQbGFuLnVzYWdlUGxhbklkLFxuICAgICAgZGVzY3JpcHRpb246ICdQdWJsaWMgQVBJIFVzYWdlIFBsYW4gSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NyZWF0b3JVc2FnZVBsYW5JZCcsIHtcbiAgICAgIHZhbHVlOiBjcmVhdG9yVXNhZ2VQbGFuLnVzYWdlUGxhbklkLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdG9yIEFQSSBVc2FnZSBQbGFuIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZG1pblVzYWdlUGxhbklkJywge1xuICAgICAgdmFsdWU6IGFkbWluVXNhZ2VQbGFuLnVzYWdlUGxhbklkLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbiBBUEkgVXNhZ2UgUGxhbiBJRCcsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRXYXRjaCBEYXNoYm9hcmQgZm9yIFByaWNlIFN5bmMgTW9uaXRvcmluZ1xuICAgIC8vIFJlcXVpcmVtZW50IDguMzogQ3JlYXRlIENsb3VkV2F0Y2ggZGFzaGJvYXJkIGZvciBwcmljZSBzeW5jIG1vbml0b3JpbmdcbiAgICBjb25zdCBwcmljZVN5bmNEYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ1ByaWNlU3luY0Rhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6ICdQaW50ZXJlc3RBZmZpbGlhdGUtUHJpY2VTeW5jJyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB3aWRnZXRzIHRvIHRoZSBkYXNoYm9hcmRcbiAgICBwcmljZVN5bmNEYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIC8vIFN1Y2Nlc3MgYW5kIEZhaWx1cmUgQ291bnRzXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUHJpY2UgU3luYyAtIFN1Y2Nlc3MgdnMgRmFpbHVyZScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdTdWNjZXNzQ291bnQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIGxhYmVsOiAnU3VjY2Vzc2Z1bCBVcGRhdGVzJyxcbiAgICAgICAgICAgIGNvbG9yOiBjbG91ZHdhdGNoLkNvbG9yLkdSRUVOLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0ZhaWx1cmVDb3VudCcsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgbGFiZWw6ICdGYWlsZWQgVXBkYXRlcycsXG4gICAgICAgICAgICBjb2xvcjogY2xvdWR3YXRjaC5Db2xvci5SRUQsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICAvLyBTdWNjZXNzIFJhdGVcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdQcmljZSBTeW5jIC0gU3VjY2VzcyBSYXRlJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1N1Y2Nlc3NSYXRlJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgICAgbGFiZWw6ICdTdWNjZXNzIFJhdGUgKCUpJyxcbiAgICAgICAgICAgIGNvbG9yOiBjbG91ZHdhdGNoLkNvbG9yLkJMVUUsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICBtaW46IDAsXG4gICAgICAgICAgbWF4OiAxMDAsXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBwcmljZVN5bmNEYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIC8vIEV4ZWN1dGlvbiBEdXJhdGlvblxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1ByaWNlIFN5bmMgLSBFeGVjdXRpb24gRHVyYXRpb24nLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnRHVyYXRpb24nLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgICBsYWJlbDogJ0F2ZyBEdXJhdGlvbiAobXMpJyxcbiAgICAgICAgICAgIGNvbG9yOiBjbG91ZHdhdGNoLkNvbG9yLlBVUlBMRSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdEdXJhdGlvbicsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdNYXhpbXVtJyxcbiAgICAgICAgICAgIGxhYmVsOiAnTWF4IER1cmF0aW9uIChtcyknLFxuICAgICAgICAgICAgY29sb3I6IGNsb3Vkd2F0Y2guQ29sb3IuT1JBTkdFLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgLy8gUHJvZHVjdHMgUHJvY2Vzc2VkXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUHJpY2UgU3luYyAtIFByb2R1Y3RzIFByb2Nlc3NlZCcsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdUb3RhbFByb2R1Y3RzJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBsYWJlbDogJ1RvdGFsIFByb2R1Y3RzJyxcbiAgICAgICAgICAgIGNvbG9yOiBjbG91ZHdhdGNoLkNvbG9yLkdSRVksXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUHJvY2Vzc2VkQ291bnQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIGxhYmVsOiAnUHJvY2Vzc2VkICh3aXRoIEFTSU4pJyxcbiAgICAgICAgICAgIGNvbG9yOiBjbG91ZHdhdGNoLkNvbG9yLkJMVUUsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnU2tpcHBlZENvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBsYWJlbDogJ1NraXBwZWQgKG5vIEFTSU4pJyxcbiAgICAgICAgICAgIGNvbG9yOiBjbG91ZHdhdGNoLkNvbG9yLkJST1dOLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIFJlcXVpcmVtZW50IDguNDogU2V0IHVwIGFsYXJtcyBmb3IgaGlnaCBmYWlsdXJlIHJhdGVzXG4gICAgY29uc3QgaGlnaEZhaWx1cmVSYXRlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaEZhaWx1cmVSYXRlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICdQcmljZVN5bmMtSGlnaEZhaWx1cmVSYXRlJyxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIHByaWNlIHN5bmMgZmFpbHVyZSByYXRlIGV4Y2VlZHMgNTAlJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0ZhaWx1cmVSYXRlJyxcbiAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogNTAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIFNOUyBhY3Rpb24gdG8gdGhlIGFsYXJtXG4gICAgaGlnaEZhaWx1cmVSYXRlQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLnByaWNlU3luY0FsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIC8vIFJlcXVpcmVtZW50IDguNDogU2V0IHVwIGFsYXJtcyBmb3IgYXV0aGVudGljYXRpb24gZXJyb3JzXG4gICAgLy8gVGhpcyBhbGFybSBtb25pdG9ycyBDbG91ZFdhdGNoIExvZ3MgZm9yIGF1dGhlbnRpY2F0aW9uIGVycm9yc1xuICAgIGNvbnN0IGF1dGhFcnJvck1ldHJpY0ZpbHRlciA9IG5ldyBsb2dzLk1ldHJpY0ZpbHRlcih0aGlzLCAnQXV0aEVycm9yTWV0cmljRmlsdGVyJywge1xuICAgICAgbG9nR3JvdXA6IHByaWNlU3luY0xvZ0dyb3VwLFxuICAgICAgbWV0cmljTmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgIG1ldHJpY05hbWU6ICdBdXRoZW50aWNhdGlvbkVycm9ycycsXG4gICAgICBmaWx0ZXJQYXR0ZXJuOiBsb2dzLkZpbHRlclBhdHRlcm4uYW55VGVybSgnNDAxJywgJ1VuYXV0aG9yaXplZCcsICdJbnZhbGlkU2lnbmF0dXJlJywgJ1NpZ25hdHVyZURvZXNOb3RNYXRjaCcpLFxuICAgICAgbWV0cmljVmFsdWU6ICcxJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogMCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGF1dGhFcnJvckFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0F1dGhFcnJvckFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAnUHJpY2VTeW5jLUF1dGhlbnRpY2F0aW9uRXJyb3InLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FsZXJ0IHdoZW4gUEEtQVBJIGF1dGhlbnRpY2F0aW9uIGVycm9ycyBvY2N1cicsXG4gICAgICBtZXRyaWM6IGF1dGhFcnJvck1ldHJpY0ZpbHRlci5tZXRyaWMoe1xuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDEsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuXG4gICAgYXV0aEVycm9yQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLnByaWNlU3luY0FsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIC8vIEFsYXJtIGZvciBleGVjdXRpb24gZHVyYXRpb24gZXhjZWVkaW5nIDUgbWludXRlc1xuICAgIGNvbnN0IGxvbmdFeGVjdXRpb25BbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdMb25nRXhlY3V0aW9uQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICdQcmljZVN5bmMtTG9uZ0V4ZWN1dGlvbicsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxlcnQgd2hlbiBwcmljZSBzeW5jIGV4ZWN1dGlvbiBleGNlZWRzIDUgbWludXRlcycsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdEdXJhdGlvbicsXG4gICAgICAgIHN0YXRpc3RpYzogJ01heGltdW0nLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDMwMDAwMCwgLy8gNSBtaW51dGVzIGluIG1pbGxpc2Vjb25kc1xuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIGxvbmdFeGVjdXRpb25BbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMucHJpY2VTeW5jQWxlcnRUb3BpYylcbiAgICApO1xuXG4gICAgLy8gT3V0cHV0IEFQSSBHYXRld2F5IFVSTFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogJ0FwaUdhdGV3YXlVcmwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogJ0FwaUdhdGV3YXlJZCcsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgU05TIHRvcGljIEFSTiBmb3IgcHJpY2Ugc3luYyBhbGVydHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJpY2VTeW5jQWxlcnRUb3BpY0FybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnByaWNlU3luY0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIFByaWNlIFN5bmMgQWxlcnRzJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdQcmljZVN5bmNBbGVydFRvcGljQXJuJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBQYXJhbWV0ZXIgU3RvcmUgcGFyYW1ldGVyIG5hbWVzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1BBQVBJUGFyYW1ldGVyc1ByZWZpeCcsIHtcbiAgICAgIHZhbHVlOiAnL2FtYXpvbi1hZmZpbGlhdGUvcGEtYXBpLycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BhcmFtZXRlciBTdG9yZSBwcmVmaXggZm9yIFBBLUFQSSBjcmVkZW50aWFscycsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ByaWNlU3luY0Rhc2hib2FyZFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly9jb25zb2xlLmF3cy5hbWF6b24uY29tL2Nsb3Vkd2F0Y2gvaG9tZT9yZWdpb249JHt0aGlzLnJlZ2lvbn0jZGFzaGJvYXJkczpuYW1lPSR7cHJpY2VTeW5jRGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMIGZvciBQcmljZSBTeW5jIE1vbml0b3JpbmcnLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IEFsYXJtIEFSTnNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSGlnaEZhaWx1cmVSYXRlQWxhcm1Bcm4nLCB7XG4gICAgICB2YWx1ZTogaGlnaEZhaWx1cmVSYXRlQWxhcm0uYWxhcm1Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0hpZ2ggRmFpbHVyZSBSYXRlIEFsYXJtIEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXV0aEVycm9yQWxhcm1Bcm4nLCB7XG4gICAgICB2YWx1ZTogYXV0aEVycm9yQWxhcm0uYWxhcm1Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1dGhlbnRpY2F0aW9uIEVycm9yIEFsYXJtIEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTG9uZ0V4ZWN1dGlvbkFsYXJtQXJuJywge1xuICAgICAgdmFsdWU6IGxvbmdFeGVjdXRpb25BbGFybS5hbGFybUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTG9uZyBFeGVjdXRpb24gQWxhcm0gQVJOJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBQcmljZSBTeW5jIExhbWJkYSBkZXRhaWxzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ByaWNlU3luY0xhbWJkYUFybicsIHtcbiAgICAgIHZhbHVlOiBzeW5jQW1hem9uUHJpY2VzRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByaWNlIFN5bmMgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXG4gICAgICBleHBvcnROYW1lOiAnUHJpY2VTeW5jTGFtYmRhQXJuJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcmljZVN5bmNMYW1iZGFOYW1lJywge1xuICAgICAgdmFsdWU6IHN5bmNBbWF6b25QcmljZXNGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByaWNlIFN5bmMgTGFtYmRhIEZ1bmN0aW9uIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogJ1ByaWNlU3luY0xhbWJkYU5hbWUnLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IEV2ZW50QnJpZGdlIHJ1bGUgZGV0YWlsc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcmljZVN5bmNSdWxlQXJuJywge1xuICAgICAgdmFsdWU6IHByaWNlU3luY1J1bGUucnVsZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnRXZlbnRCcmlkZ2UgUnVsZSBBUk4gZm9yIFByaWNlIFN5bmMnLFxuICAgICAgZXhwb3J0TmFtZTogJ1ByaWNlU3luY1J1bGVBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ByaWNlU3luY1J1bGVOYW1lJywge1xuICAgICAgdmFsdWU6IHByaWNlU3luY1J1bGUucnVsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0V2ZW50QnJpZGdlIFJ1bGUgTmFtZSBmb3IgUHJpY2UgU3luYycsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJpY2VTeW5jU2NoZWR1bGUnLCB7XG4gICAgICB2YWx1ZTogJ0RhaWx5IGF0IDI6MDAgQU0gVVRDIChjcm9uOiAwIDIgKiAqID8gKiknLFxuICAgICAgZGVzY3JpcHRpb246ICdQcmljZSBTeW5jIFNjaGVkdWxlJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBNYW51YWwgVHJpZ2dlciBMYW1iZGEgZGV0YWlsc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdUcmlnZ2VyUHJpY2VTeW5jTGFtYmRhQXJuJywge1xuICAgICAgdmFsdWU6IHRyaWdnZXJQcmljZVN5bmNGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWFudWFsIFByaWNlIFN5bmMgVHJpZ2dlciBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdUcmlnZ2VyUHJpY2VTeW5jTGFtYmRhQXJuJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdUcmlnZ2VyUHJpY2VTeW5jTGFtYmRhTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0cmlnZ2VyUHJpY2VTeW5jRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdNYW51YWwgUHJpY2UgU3luYyBUcmlnZ2VyIExhbWJkYSBGdW5jdGlvbiBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdUcmlnZ2VyUHJpY2VTeW5jTGFtYmRhTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTWFudWFsU3luY0VuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IGAke3RoaXMuYXBpLnVybH1hcGkvYWRtaW4vc3luYy1wcmljZXNgLFxuICAgICAgZGVzY3JpcHRpb246ICdNYW51YWwgUHJpY2UgU3luYyBBUEkgRW5kcG9pbnQgKFBPU1QpJyxcbiAgICB9KTtcbiAgfVxufVxuIl19