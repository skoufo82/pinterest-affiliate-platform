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
        // POST /api/creators (public creator signup)
        creatorsResource.addMethod('POST', new apigateway.LambdaIntegration(createCreatorFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2VuZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhY2tlbmQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFHekQseURBQTJDO0FBQzNDLDJEQUE2QztBQUU3Qyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLHVFQUF5RDtBQUN6RCx1RkFBeUU7QUFDekUsK0RBQWlEO0FBQ2pELCtFQUFpRTtBQUVqRSwyQ0FBNkI7QUFXN0IsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFJekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBRSxvQkFBb0IsRUFBRSx1QkFBdUIsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXRILHlDQUF5QztRQUN6QyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNwRSxTQUFTLEVBQUUsdUNBQXVDO1lBQ2xELFdBQVcsRUFBRSwwQkFBMEI7U0FDeEMsQ0FBQyxDQUFDO1FBRUgsMkRBQTJEO1FBQzNELDJGQUEyRjtRQUMzRixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzlDLGFBQWEsRUFBRSxxQ0FBcUM7WUFDcEQsV0FBVyxFQUFFLHdCQUF3QjtZQUNyQyxXQUFXLEVBQUUsMkNBQTJDO1lBQ3hELElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVE7U0FDakMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUM5QyxhQUFhLEVBQUUscUNBQXFDO1lBQ3BELFdBQVcsRUFBRSx3QkFBd0I7WUFDckMsV0FBVyxFQUFFLDJDQUEyQztZQUN4RCxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQ2pDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDL0MsYUFBYSxFQUFFLHNDQUFzQztZQUNyRCxXQUFXLEVBQUUseUJBQXlCO1lBQ3RDLFdBQVcsRUFBRSwrQkFBK0I7WUFDNUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUTtTQUNqQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ2hELGFBQWEsRUFBRSxzQ0FBc0M7WUFDckQsV0FBVyxFQUFFLGdCQUFnQjtZQUM3QixXQUFXLEVBQUUsa0NBQWtDO1lBQy9DLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVE7U0FDakMsQ0FBQyxDQUFDO1FBRUgsdUNBQXVDO1FBQ3ZDLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0QsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBDQUEwQyxDQUFDO2FBQ3ZGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsNkJBQTZCO1FBQzdCLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUM3QyxhQUFhLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDN0Msb0JBQW9CLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDcEQsdUJBQXVCLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFdkQsdUJBQXVCO1FBQ3ZCLFlBQVksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFeEMsZ0RBQWdEO1FBQ2hELFVBQVUsQ0FBQyxXQUFXLENBQ3BCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCw2QkFBNkI7Z0JBQzdCLDZCQUE2QjtnQkFDN0IsMEJBQTBCO2dCQUMxQix1Q0FBdUM7Z0JBQ3ZDLGtDQUFrQztnQkFDbEMsaUNBQWlDO2dCQUNqQyxzQ0FBc0M7Z0JBQ3RDLG9DQUFvQztnQkFDcEMsdUJBQXVCO2dCQUN2Qiw4QkFBOEI7YUFDL0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO1NBQ2xDLENBQUMsQ0FDSCxDQUFDO1FBRUYsMkNBQTJDO1FBQzNDLFVBQVUsQ0FBQyxXQUFXLENBQ3BCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxlQUFlO2dCQUNmLGtCQUFrQjthQUNuQjtZQUNELFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLG1DQUFtQztTQUN0RCxDQUFDLENBQ0gsQ0FBQztRQUVGLDJEQUEyRDtRQUMzRCxVQUFVLENBQUMsV0FBVyxDQUNwQixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1Asa0JBQWtCO2dCQUNsQixtQkFBbUI7YUFDcEI7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsZUFBZSxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLCtCQUErQjthQUMxRTtTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYsOENBQThDO1FBQzlDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbEQsa0RBQWtEO1FBQ2xELFVBQVUsQ0FBQyxXQUFXLENBQ3BCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCwwQkFBMEI7YUFDM0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSx3Q0FBd0M7U0FDM0QsQ0FBQyxDQUNILENBQUM7UUFJRixzQ0FBc0M7UUFDdEMsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixtQkFBbUIsRUFBRSxhQUFhLENBQUMsU0FBUztZQUM1QyxtQkFBbUIsRUFBRSxhQUFhLENBQUMsU0FBUztZQUM1QywyQkFBMkIsRUFBRSxvQkFBb0IsQ0FBQyxTQUFTO1lBQzNELDhCQUE4QixFQUFFLHVCQUF1QixDQUFDLFNBQVM7WUFDakUsa0JBQWtCLEVBQUUsWUFBWSxDQUFDLFVBQVU7WUFDM0MsWUFBWSxFQUFFLFFBQVEsQ0FBQyxVQUFVO1lBQ2pDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsOEJBQThCO1FBQzlCLE1BQU0sWUFBWSxHQUFHO1lBQ25CLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsSUFBSSxFQUFFLFVBQVU7WUFDaEIsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1NBQ2hCLENBQUM7UUFFRix1REFBdUQ7UUFDdkQsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzNFLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxpQ0FBaUM7WUFDL0MsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLHFDQUFxQztZQUM5QyxXQUFXLEVBQUUsbURBQW1EO1NBQ2pFLENBQUMsQ0FBQztRQUVILE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUN6RSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsZ0NBQWdDO1lBQzlDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSxvQ0FBb0M7WUFDN0MsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxNQUFNLHFCQUFxQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0UsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLG1DQUFtQztZQUNqRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsdUNBQXVDO1lBQ2hELFdBQVcsRUFBRSxzQkFBc0I7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9FLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxtQ0FBbUM7WUFDakQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLHVDQUF1QztZQUNoRCxXQUFXLEVBQUUsNEJBQTRCO1NBQzFDLENBQUMsQ0FBQztRQUVILE1BQU0scUJBQXFCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsbUNBQW1DO1lBQ2pELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx1Q0FBdUM7WUFDaEQsV0FBVyxFQUFFLGtCQUFrQjtTQUNoQyxDQUFDLENBQUM7UUFFSCxNQUFNLG1CQUFtQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0UsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLGlDQUFpQztZQUMvQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUscUNBQXFDO1lBQzlDLFdBQVcsRUFBRSx5Q0FBeUM7U0FDdkQsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUN6RSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsZ0NBQWdDO1lBQzlDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSxvQ0FBb0M7WUFDN0MsV0FBVyxFQUFFLHlCQUF5QjtTQUN2QyxDQUFDLENBQUM7UUFFSCxNQUFNLGlCQUFpQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDdkUsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLCtCQUErQjtZQUM3QyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsbUNBQW1DO1lBQzVDLFdBQVcsRUFBRSxnQkFBZ0I7U0FDOUIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ3pFLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxnQ0FBZ0M7WUFDOUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLG9DQUFvQztZQUM3QyxXQUFXLEVBQUUsZUFBZTtTQUM3QixDQUFDLENBQUM7UUFFSCxNQUFNLHFCQUFxQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0UsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLG1DQUFtQztZQUNqRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsdUNBQXVDO1lBQ2hELFdBQVcsRUFBRSxxQkFBcUI7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsTUFBTSx3QkFBd0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ3JGLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxzQ0FBc0M7WUFDcEQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLDBDQUEwQztZQUNuRCxXQUFXLEVBQUUsb0RBQW9EO1NBQ2xFLENBQUMsQ0FBQztRQUVILE1BQU0scUJBQXFCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsbUNBQW1DO1lBQ2pELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx1Q0FBdUM7WUFDaEQsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxvREFBb0Q7UUFDcEQsNENBQTRDO1FBQzVDLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUNyRSxZQUFZLEVBQUUsa0RBQWtEO1lBQ2hFLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7WUFDdEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxvQ0FBb0M7UUFDcEMsOEVBQThFO1FBQzlFLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNyRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsc0NBQXNDO1lBQ3BELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSwwQ0FBMEM7WUFDbkQsV0FBVyxFQUFFLCtDQUErQztZQUM1RCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUUsc0NBQXNDO1lBQ3pFLFVBQVUsRUFBRSxJQUFJLEVBQUUsK0NBQStDO1lBQ2pFLFFBQVEsRUFBRSxpQkFBaUI7WUFDM0IsV0FBVyxFQUFFO2dCQUNYLEdBQUcsaUJBQWlCO2dCQUNwQixhQUFhLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVE7YUFDakQ7U0FDRixDQUFDLENBQUM7UUFFSCxrREFBa0Q7UUFDbEQscURBQXFEO1FBQ3JELE1BQU0sYUFBYSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDbkUsUUFBUSxFQUFFLHNDQUFzQztZQUNoRCxXQUFXLEVBQUUsOENBQThDO1lBQzNELFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztnQkFDN0IsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEdBQUc7Z0JBQ1QsR0FBRyxFQUFFLEdBQUc7Z0JBQ1IsS0FBSyxFQUFFLEdBQUc7Z0JBQ1YsSUFBSSxFQUFFLEdBQUc7YUFDVixDQUFDO1lBQ0YsT0FBTyxFQUFFLElBQUk7U0FDZCxDQUFDLENBQUM7UUFFSCx5Q0FBeUM7UUFDekMsK0VBQStFO1FBQy9FLGFBQWEsQ0FBQyxTQUFTLENBQ3JCLElBQUksY0FBYyxDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsRUFBRTtZQUMxRCxhQUFhLEVBQUUsQ0FBQztZQUNoQixXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQ25DLENBQUMsQ0FDSCxDQUFDO1FBRUYsb0RBQW9EO1FBQ3BELHdCQUF3QixDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7UUFFdkYsbURBQW1EO1FBQ25ELG1FQUFtRTtRQUNuRSxNQUFNLHdCQUF3QixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDckYsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLHNDQUFzQztZQUNwRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsMENBQTBDO1lBQ25ELFdBQVcsRUFBRSxnREFBZ0Q7WUFDN0QsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxVQUFVLEVBQUUsR0FBRztZQUNmLFdBQVcsRUFBRTtnQkFDWCxHQUFHLGlCQUFpQjtnQkFDcEIsc0JBQXNCLEVBQUUsd0JBQXdCLENBQUMsWUFBWTthQUM5RDtTQUNGLENBQUMsQ0FBQztRQUVILG1EQUFtRDtRQUNuRCw0RUFBNEU7UUFDNUUsaURBQWlEO1FBQ2pELGlUQUFpVDtRQUVqVCwwQ0FBMEM7UUFDMUMsOERBQThEO1FBQzlELE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUNqRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsb0NBQW9DO1lBQ2xELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx3Q0FBd0M7WUFDakQsV0FBVyxFQUFFLDREQUE0RDtZQUN6RSxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsV0FBVyxFQUFFO2dCQUNYLEdBQUcsaUJBQWlCO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgseUNBQXlDO1FBQ3pDLHNCQUFzQixDQUFDLGVBQWUsQ0FDcEMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLHNCQUFzQjtnQkFDdEIseUJBQXlCO2FBQzFCO1lBQ0QsU0FBUyxFQUFFO2dCQUNULGdCQUFnQixJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLDJDQUEyQzthQUN2RjtTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYsNENBQTRDO1FBQzVDLE1BQU0sVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLDBCQUEwQixDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUN0RixnQkFBZ0IsRUFBRSxDQUFDLFFBQVEsQ0FBQztZQUM1QixjQUFjLEVBQUUsaUJBQWlCO1lBQ2pDLGNBQWMsRUFBRSxxQ0FBcUM7U0FDdEQsQ0FBQyxDQUFDO1FBRUgscUJBQXFCO1FBQ3JCLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRCxXQUFXLEVBQUUseUJBQXlCO1lBQ3RDLFdBQVcsRUFBRSxzQ0FBc0M7WUFDbkQsYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxNQUFNO2dCQUNqQixZQUFZLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLElBQUk7Z0JBQ2hELGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLGNBQWMsRUFBRSxJQUFJO2dCQUNwQixxRUFBcUU7Z0JBQ3JFLGNBQWMsRUFBRSxLQUFLO2dCQUNyQix1Q0FBdUM7Z0JBQ3ZDLG9CQUFvQixFQUFFLElBQUksRUFBRSw4QkFBOEI7Z0JBQzFELG1CQUFtQixFQUFFLEtBQUssRUFBRSw4QkFBOEI7YUFDM0Q7WUFDRCwyQkFBMkIsRUFBRTtnQkFDM0IsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFO29CQUNaLGNBQWM7b0JBQ2QsWUFBWTtvQkFDWixlQUFlO29CQUNmLFdBQVc7b0JBQ1gsc0JBQXNCO2lCQUN2QjtnQkFDRCxnQkFBZ0IsRUFBRSxJQUFJO2FBQ3ZCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVyRCxnQ0FBZ0M7UUFDaEMsTUFBTSxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdELGdCQUFnQixDQUFDLFNBQVMsQ0FDeEIsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixFQUFFO1lBQ3BELGtCQUFrQixFQUFFLENBQUMscUNBQXFDLENBQUM7U0FDNUQsQ0FBQyxFQUNGO1lBQ0UsaUJBQWlCLEVBQUU7Z0JBQ2pCLHFDQUFxQyxFQUFFLEtBQUs7YUFDN0M7WUFDRCxlQUFlLEVBQUU7Z0JBQ2Y7b0JBQ0UsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLGtCQUFrQixFQUFFO3dCQUNsQixzQ0FBc0MsRUFBRSxJQUFJO3FCQUM3QztpQkFDRjthQUNGO1NBQ0YsQ0FDRixDQUFDO1FBRUYsTUFBTSxlQUFlLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzdELGVBQWUsQ0FBQyxTQUFTLENBQ3ZCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsRUFBRTtZQUNuRCxrQkFBa0IsRUFBRSxDQUFDLHdCQUF3QixDQUFDO1NBQy9DLENBQUMsRUFDRjtZQUNFLGlCQUFpQixFQUFFO2dCQUNqQix3QkFBd0IsRUFBRSxJQUFJO2FBQy9CO1lBQ0QsZUFBZSxFQUFFO2dCQUNmO29CQUNFLFVBQVUsRUFBRSxLQUFLO29CQUNqQixrQkFBa0IsRUFBRTt3QkFDbEIsc0NBQXNDLEVBQUUsSUFBSTtxQkFDN0M7aUJBQ0Y7YUFDRjtTQUNGLENBQ0YsQ0FBQztRQUVGLHNCQUFzQjtRQUN0QixNQUFNLGtCQUFrQixHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDakUsa0JBQWtCLENBQUMsU0FBUyxDQUMxQixLQUFLLEVBQ0wsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLENBQUMsRUFDdkQ7WUFDRSxlQUFlLEVBQUU7Z0JBQ2Y7b0JBQ0UsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLGtCQUFrQixFQUFFO3dCQUNsQixzQ0FBc0MsRUFBRSxJQUFJO3FCQUM3QztpQkFDRjthQUNGO1NBQ0YsQ0FDRixDQUFDO1FBRUYseUNBQXlDO1FBQ3pDLE1BQU0sYUFBYSxHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkQsTUFBTSxxQkFBcUIsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRXBFLGtEQUFrRDtRQUNsRCxxQkFBcUIsQ0FBQyxTQUFTLENBQzdCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyx3QkFBd0IsQ0FBQyxFQUMxRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixxQkFBcUIsQ0FBQyxTQUFTLENBQzdCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixNQUFNLG9CQUFvQixHQUFHLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2RSxvQkFBb0IsQ0FBQyxTQUFTLENBQzVCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFDRixvQkFBb0IsQ0FBQyxTQUFTLENBQzVCLFFBQVEsRUFDUixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixNQUFNLG1CQUFtQixHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDdEUsbUJBQW1CLENBQUMsU0FBUyxDQUMzQixNQUFNLEVBQ04sSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsRUFDckQ7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDeEQsQ0FDRixDQUFDO1FBRUYsbURBQW1EO1FBQ25ELE1BQU0sYUFBYSxHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDekQsYUFBYSxDQUFDLFNBQVMsQ0FDckIsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLGlCQUFpQixDQUFDLEVBQ25EO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUNGLGFBQWEsQ0FBQyxTQUFTLENBQ3JCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUNwRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixNQUFNLFlBQVksR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzdELFlBQVksQ0FBQyxTQUFTLENBQ3BCLFFBQVEsRUFDUixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUNwRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixNQUFNLHFCQUFxQixHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN6RSxxQkFBcUIsQ0FBQyxTQUFTLENBQzdCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRiw0REFBNEQ7UUFDNUQsd0RBQXdEO1FBQ3hELE1BQU0sa0JBQWtCLEdBQUcsYUFBYSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNwRSxrQkFBa0IsQ0FBQyxTQUFTLENBQzFCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyx3QkFBd0IsQ0FBQyxFQUMxRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRiwrQ0FBK0M7UUFDL0Msd0RBQXdEO1FBQ3hELE1BQU0sbUJBQW1CLEdBQUcsYUFBYSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN0RSxtQkFBbUIsQ0FBQyxTQUFTLENBQzNCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsQ0FBQyxFQUN4RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRiwyQ0FBMkM7UUFDM0Msb0NBQW9DO1FBQ3BDLDJDQUEyQztRQUUzQyxxREFBcUQ7UUFDckQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9FLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxtQ0FBbUM7WUFDakQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLHVDQUF1QztZQUNoRCxXQUFXLEVBQUUsOEJBQThCO1NBQzVDLENBQUMsQ0FBQztRQUVILE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNyRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsc0NBQXNDO1lBQ3BELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSwwQ0FBMEM7WUFDbkQsV0FBVyxFQUFFLDZCQUE2QjtTQUMzQyxDQUFDLENBQUM7UUFFSCxNQUFNLDRCQUE0QixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsOEJBQThCLEVBQUU7WUFDN0YsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLDBDQUEwQztZQUN4RCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsOENBQThDO1lBQ3ZELFdBQVcsRUFBRSx3QkFBd0I7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSwyQkFBMkIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDZCQUE2QixFQUFFO1lBQzNGLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSx5Q0FBeUM7WUFDdkQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLDZDQUE2QztZQUN0RCxXQUFXLEVBQUUsdUJBQXVCO1NBQ3JDLENBQUMsQ0FBQztRQUVILE1BQU0scUJBQXFCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvRSxHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsbUNBQW1DO1lBQ2pELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx1Q0FBdUM7WUFDaEQsV0FBVyxFQUFFLHVCQUF1QjtTQUNyQyxDQUFDLENBQUM7UUFFSCxNQUFNLDJCQUEyQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsNkJBQTZCLEVBQUU7WUFDM0YsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLHlDQUF5QztZQUN2RCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsNkNBQTZDO1lBQ3RELFdBQVcsRUFBRSw2QkFBNkI7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ3pGLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSx3Q0FBd0M7WUFDdEQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLDRDQUE0QztZQUNyRCxXQUFXLEVBQUUseUNBQXlDO1NBQ3ZELENBQUMsQ0FBQztRQUVILE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUNqRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUsb0NBQW9DO1lBQ2xELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSx3Q0FBd0M7WUFDakQsV0FBVyxFQUFFLG1CQUFtQjtTQUNqQyxDQUFDLENBQUM7UUFFSCxNQUFNLHFCQUFxQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0UsR0FBRyxZQUFZO1lBQ2YsWUFBWSxFQUFFLG1DQUFtQztZQUNqRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsdUNBQXVDO1lBQ2hELFdBQVcsRUFBRSxrQkFBa0I7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ25GLEdBQUcsWUFBWTtZQUNmLFlBQVksRUFBRSxxQ0FBcUM7WUFDbkQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLHlDQUF5QztZQUNsRCxXQUFXLEVBQUUsMkJBQTJCO1NBQ3pDLENBQUMsQ0FBQztRQUVILE1BQU0sMkJBQTJCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUMzRixHQUFHLFlBQVk7WUFDZixZQUFZLEVBQUUseUNBQXlDO1lBQ3ZELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSw2Q0FBNkM7WUFDdEQsV0FBVyxFQUFFLCtCQUErQjtTQUM3QyxDQUFDLENBQUM7UUFFSCwyQ0FBMkM7UUFDM0MsMkNBQTJDO1FBQzNDLDJDQUEyQztRQUUzQywyQkFBMkI7UUFDM0IsTUFBTSxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRTdELDZDQUE2QztRQUM3QyxnQkFBZ0IsQ0FBQyxTQUFTLENBQ3hCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixNQUFNLG1CQUFtQixHQUFHLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNuRSxtQkFBbUIsQ0FBQyxTQUFTLENBQzNCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyx3QkFBd0IsRUFBRTtZQUN6RCxrQkFBa0IsRUFBRSxDQUFDLDBCQUEwQixDQUFDO1NBQ2pELENBQUMsRUFDRjtZQUNFLGlCQUFpQixFQUFFO2dCQUNqQiwwQkFBMEIsRUFBRSxJQUFJO2FBQ2pDO1lBQ0QsZUFBZSxFQUFFO2dCQUNmO29CQUNFLFVBQVUsRUFBRSxLQUFLO29CQUNqQixrQkFBa0IsRUFBRTt3QkFDbEIsc0NBQXNDLEVBQUUsSUFBSTtxQkFDN0M7aUJBQ0Y7YUFDRjtTQUNGLENBQ0YsQ0FBQztRQUVGLG9DQUFvQztRQUNwQyxNQUFNLHVCQUF1QixHQUFHLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUM1RSx1QkFBdUIsQ0FBQyxTQUFTLENBQy9CLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsRUFBRTtZQUNwRCxrQkFBa0IsRUFBRTtnQkFDbEIsMEJBQTBCO2dCQUMxQixxQ0FBcUM7Z0JBQ3JDLG1DQUFtQztnQkFDbkMsaUNBQWlDO2FBQ2xDO1NBQ0YsQ0FBQyxFQUNGO1lBQ0UsaUJBQWlCLEVBQUU7Z0JBQ2pCLDBCQUEwQixFQUFFLElBQUk7Z0JBQ2hDLHFDQUFxQyxFQUFFLEtBQUs7Z0JBQzVDLG1DQUFtQyxFQUFFLEtBQUs7Z0JBQzFDLGlDQUFpQyxFQUFFLEtBQUs7Z0JBQ3hDLGtDQUFrQyxFQUFFLEtBQUs7Z0JBQ3pDLG1DQUFtQyxFQUFFLEtBQUs7YUFDM0M7WUFDRCxlQUFlLEVBQUU7Z0JBQ2Y7b0JBQ0UsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLGtCQUFrQixFQUFFO3dCQUNsQixzQ0FBc0MsRUFBRSxJQUFJO3FCQUM3QztpQkFDRjthQUNGO1NBQ0YsQ0FDRixDQUFDO1FBRUYsb0NBQW9DO1FBQ3BDLE1BQU0sdUJBQXVCLEdBQUcsbUJBQW1CLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzVFLHVCQUF1QixDQUFDLFNBQVMsQ0FDL0IsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixFQUFFO1lBQ3BELGtCQUFrQixFQUFFLENBQUMsMEJBQTBCLENBQUM7U0FDakQsQ0FBQyxFQUNGO1lBQ0UsaUJBQWlCLEVBQUU7Z0JBQ2pCLDBCQUEwQixFQUFFLElBQUk7YUFDakM7WUFDRCxlQUFlLEVBQUU7Z0JBQ2Y7b0JBQ0UsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLGtCQUFrQixFQUFFO3dCQUNsQixzQ0FBc0MsRUFBRSxJQUFJO3FCQUM3QztpQkFDRjthQUNGO1NBQ0YsQ0FDRixDQUFDO1FBRUYsMkNBQTJDO1FBQzNDLHlDQUF5QztRQUN6QywyQ0FBMkM7UUFFM0MsTUFBTSxlQUFlLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUUzRCwyQkFBMkI7UUFDM0IsMkJBQTJCO1FBQzNCLE1BQU0sc0JBQXNCLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN0RSxzQkFBc0IsQ0FBQyxTQUFTLENBQzlCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyx3QkFBd0IsQ0FBQyxFQUMxRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFDRixzQkFBc0IsQ0FBQyxTQUFTLENBQzlCLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyw0QkFBNEIsQ0FBQyxFQUM5RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRiw0QkFBNEI7UUFDNUIsNkJBQTZCO1FBQzdCLE1BQU0sMEJBQTBCLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMzRSwwQkFBMEIsQ0FBQyxTQUFTLENBQ2xDLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsQ0FBQyxFQUNyRDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFDRiwwQkFBMEIsQ0FBQyxTQUFTLENBQ2xDLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixpQ0FBaUM7UUFDakMsb0NBQW9DO1FBQ3BDLE1BQU0sc0JBQXNCLEdBQUcsMEJBQTBCLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlFLHNCQUFzQixDQUFDLFNBQVMsQ0FDOUIsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLEVBQ3ZEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUNGLHNCQUFzQixDQUFDLFNBQVMsQ0FDOUIsUUFBUSxFQUNSLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLEVBQ3ZEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUVGLDZCQUE2QjtRQUM3QixNQUFNLHdCQUF3QixHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDMUUsd0JBQXdCLENBQUMsU0FBUyxDQUNoQyxLQUFLLEVBQ0wsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsMkJBQTJCLENBQUMsRUFDN0Q7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87WUFDdkQsaUJBQWlCLEVBQUU7Z0JBQ2pCLHNDQUFzQyxFQUFFLEtBQUs7Z0JBQzdDLG9DQUFvQyxFQUFFLEtBQUs7YUFDNUM7U0FDRixDQUNGLENBQUM7UUFFRiwyQ0FBMkM7UUFDM0Msa0NBQWtDO1FBQ2xDLDJDQUEyQztRQUUzQywwQkFBMEI7UUFDMUIsTUFBTSxxQkFBcUIsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BFLHFCQUFxQixDQUFDLFNBQVMsQ0FDN0IsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHVCQUF1QixDQUFDLEVBQ3pEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUVGLDBEQUEwRDtRQUMxRCxxQkFBcUIsQ0FBQyxTQUFTLENBQzdCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN2RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixzQ0FBc0M7UUFDdEMsTUFBTSxzQkFBc0IsR0FBRyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekUsTUFBTSwwQkFBMEIsR0FBRyxzQkFBc0IsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDaEYsMEJBQTBCLENBQUMsU0FBUyxDQUNsQyxLQUFLLEVBQ0wsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsMkJBQTJCLENBQUMsRUFDN0Q7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDeEQsQ0FDRixDQUFDO1FBRUYsa0NBQWtDO1FBQ2xDLE1BQU0sb0JBQW9CLEdBQUcscUJBQXFCLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzFFLG9CQUFvQixDQUFDLFNBQVMsQ0FDNUIsS0FBSyxFQUNMLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLDBCQUEwQixDQUFDLEVBQzVEO1lBQ0UsVUFBVTtZQUNWLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ3hELENBQ0YsQ0FBQztRQUVGLHVDQUF1QztRQUN2QyxNQUFNLDJCQUEyQixHQUFHLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNoRiwyQkFBMkIsQ0FBQyxTQUFTLENBQ25DLEtBQUssRUFDTCxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsQ0FBQyxFQUN4RDtZQUNFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUN4RCxDQUNGLENBQUM7UUFFRixzQ0FBc0M7UUFDdEMsTUFBTSwwQkFBMEIsR0FBRyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDOUUsMEJBQTBCLENBQUMsU0FBUyxDQUNsQyxLQUFLLEVBQ0wsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLENBQUMsRUFDdkQ7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDeEQsQ0FDRixDQUFDO1FBRUYsMkNBQTJDO1FBQzNDLHFDQUFxQztRQUNyQywyQ0FBMkM7UUFFM0MsZ0NBQWdDO1FBQ2hDLE1BQU0saUJBQWlCLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMvRCxNQUFNLGdCQUFnQixHQUFHLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwRSxnQkFBZ0IsQ0FBQyxTQUFTLENBQ3hCLE1BQU0sRUFDTixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxDQUN4RCxDQUFDO1FBRUYsc0NBQXNDO1FBQ3RDLE1BQU0sc0JBQXNCLEdBQUcsaUJBQWlCLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDaEYsc0JBQXNCLENBQUMsU0FBUyxDQUM5QixNQUFNLEVBQ04sSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsMkJBQTJCLENBQUMsQ0FDOUQsQ0FBQztRQUVGLDJDQUEyQztRQUMzQyw4QkFBOEI7UUFDOUIsMkNBQTJDO1FBRTNDLDhDQUE4QztRQUM5Qyx5Q0FBeUM7UUFFekMscURBQXFEO1FBQ3JELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLGlCQUFpQixFQUFFO1lBQy9ELElBQUksRUFBRSxrQkFBa0I7WUFDeEIsV0FBVyxFQUFFLG9DQUFvQztZQUNqRCxRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFLEdBQUcsRUFBRSxzQkFBc0I7Z0JBQ3RDLFVBQVUsRUFBRSxHQUFHLEVBQUUsOEJBQThCO2FBQ2hEO1lBQ0QsS0FBSyxFQUFFO2dCQUNMLEtBQUssRUFBRSxNQUFNLEVBQUUscUJBQXFCO2dCQUNwQyxNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLO2FBQ2hDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsaURBQWlEO1FBQ2pELGVBQWUsQ0FBQyxXQUFXLENBQUM7WUFDMUIsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsZUFBZTtTQUNoQyxDQUFDLENBQUM7UUFFSCx5REFBeUQ7UUFDekQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsRUFBRTtZQUNqRSxJQUFJLEVBQUUsbUJBQW1CO1lBQ3pCLFdBQVcsRUFBRSxxQ0FBcUM7WUFDbEQsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRSxJQUFJLEVBQUUsc0JBQXNCO2dCQUN2QyxVQUFVLEVBQUUsSUFBSSxFQUFFLDhCQUE4QjthQUNqRDtZQUNELEtBQUssRUFBRTtnQkFDTCxLQUFLLEVBQUUsT0FBTyxFQUFFLHFCQUFxQjtnQkFDckMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSzthQUNoQztTQUNGLENBQUMsQ0FBQztRQUVILGdCQUFnQixDQUFDLFdBQVcsQ0FBQztZQUMzQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlO1NBQ2hDLENBQUMsQ0FBQztRQUVILHdEQUF3RDtRQUN4RCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRTtZQUM3RCxJQUFJLEVBQUUsaUJBQWlCO1lBQ3ZCLFdBQVcsRUFBRSxtQ0FBbUM7WUFDaEQsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRSxLQUFLLEVBQUUsc0JBQXNCO2dCQUN4QyxVQUFVLEVBQUUsS0FBSyxFQUFFLDhCQUE4QjthQUNsRDtZQUNELEtBQUssRUFBRTtnQkFDTCxLQUFLLEVBQUUsUUFBUSxFQUFFLHFCQUFxQjtnQkFDdEMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSzthQUNoQztTQUNGLENBQUMsQ0FBQztRQUVILGNBQWMsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsZUFBZTtTQUNoQyxDQUFDLENBQUM7UUFFSCwyREFBMkQ7UUFDM0QsdURBQXVEO1FBRXZELGlDQUFpQztRQUNqQyxNQUFNLGNBQWMsR0FBRztZQUNyQixRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFLEdBQUc7Z0JBQ2QsVUFBVSxFQUFFLEdBQUc7YUFDaEI7U0FDRixDQUFDO1FBRUYsbUNBQW1DO1FBQ25DLE1BQU0sZUFBZSxHQUFHO1lBQ3RCLFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUUsSUFBSTtnQkFDZixVQUFVLEVBQUUsSUFBSTthQUNqQjtTQUNGLENBQUM7UUFFRixrQ0FBa0M7UUFDbEMsTUFBTSxhQUFhLEdBQUc7WUFDcEIsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRSxLQUFLO2dCQUNoQixVQUFVLEVBQUUsS0FBSzthQUNsQjtTQUNGLENBQUM7UUFFRixpRkFBaUY7UUFDakYseURBQXlEO1FBQ3pELHlFQUF5RTtRQUV6RSx3QkFBd0I7UUFDeEIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsZUFBZSxDQUFDLFdBQVc7WUFDbEMsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxXQUFXO1lBQ25DLFdBQVcsRUFBRSwyQkFBMkI7U0FDekMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsY0FBYyxDQUFDLFdBQVc7WUFDakMsV0FBVyxFQUFFLHlCQUF5QjtTQUN2QyxDQUFDLENBQUM7UUFFSCx3REFBd0Q7UUFDeEQseUVBQXlFO1FBQ3pFLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM5RSxhQUFhLEVBQUUsOEJBQThCO1NBQzlDLENBQUMsQ0FBQztRQUVILCtCQUErQjtRQUMvQixrQkFBa0IsQ0FBQyxVQUFVO1FBQzNCLDZCQUE2QjtRQUM3QixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLGlDQUFpQztZQUN4QyxJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsV0FBVztvQkFDdEIsVUFBVSxFQUFFLGNBQWM7b0JBQzFCLFNBQVMsRUFBRSxLQUFLO29CQUNoQixLQUFLLEVBQUUsb0JBQW9CO29CQUMzQixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLO2lCQUM5QixDQUFDO2dCQUNGLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLFdBQVc7b0JBQ3RCLFVBQVUsRUFBRSxjQUFjO29CQUMxQixTQUFTLEVBQUUsS0FBSztvQkFDaEIsS0FBSyxFQUFFLGdCQUFnQjtvQkFDdkIsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRztpQkFDNUIsQ0FBQzthQUNIO1lBQ0QsS0FBSyxFQUFFLEVBQUU7WUFDVCxNQUFNLEVBQUUsQ0FBQztTQUNWLENBQUM7UUFDRixlQUFlO1FBQ2YsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO1lBQ3pCLEtBQUssRUFBRSwyQkFBMkI7WUFDbEMsSUFBSSxFQUFFO2dCQUNKLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLFdBQVc7b0JBQ3RCLFVBQVUsRUFBRSxhQUFhO29CQUN6QixTQUFTLEVBQUUsU0FBUztvQkFDcEIsS0FBSyxFQUFFLGtCQUFrQjtvQkFDekIsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSTtpQkFDN0IsQ0FBQzthQUNIO1lBQ0QsS0FBSyxFQUFFLEVBQUU7WUFDVCxNQUFNLEVBQUUsQ0FBQztZQUNULFNBQVMsRUFBRTtnQkFDVCxHQUFHLEVBQUUsQ0FBQztnQkFDTixHQUFHLEVBQUUsR0FBRzthQUNUO1NBQ0YsQ0FBQyxDQUNILENBQUM7UUFFRixrQkFBa0IsQ0FBQyxVQUFVO1FBQzNCLHFCQUFxQjtRQUNyQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLGlDQUFpQztZQUN4QyxJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsV0FBVztvQkFDdEIsVUFBVSxFQUFFLFVBQVU7b0JBQ3RCLFNBQVMsRUFBRSxTQUFTO29CQUNwQixLQUFLLEVBQUUsbUJBQW1CO29CQUMxQixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNO2lCQUMvQixDQUFDO2dCQUNGLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLFdBQVc7b0JBQ3RCLFVBQVUsRUFBRSxVQUFVO29CQUN0QixTQUFTLEVBQUUsU0FBUztvQkFDcEIsS0FBSyxFQUFFLG1CQUFtQjtvQkFDMUIsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTTtpQkFDL0IsQ0FBQzthQUNIO1lBQ0QsS0FBSyxFQUFFLEVBQUU7WUFDVCxNQUFNLEVBQUUsQ0FBQztTQUNWLENBQUM7UUFDRixxQkFBcUI7UUFDckIsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO1lBQ3pCLEtBQUssRUFBRSxpQ0FBaUM7WUFDeEMsSUFBSSxFQUFFO2dCQUNKLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLFdBQVc7b0JBQ3RCLFVBQVUsRUFBRSxlQUFlO29CQUMzQixTQUFTLEVBQUUsS0FBSztvQkFDaEIsS0FBSyxFQUFFLGdCQUFnQjtvQkFDdkIsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSTtpQkFDN0IsQ0FBQztnQkFDRixJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQ3BCLFNBQVMsRUFBRSxXQUFXO29CQUN0QixVQUFVLEVBQUUsZ0JBQWdCO29CQUM1QixTQUFTLEVBQUUsS0FBSztvQkFDaEIsS0FBSyxFQUFFLHVCQUF1QjtvQkFDOUIsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSTtpQkFDN0IsQ0FBQztnQkFDRixJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQ3BCLFNBQVMsRUFBRSxXQUFXO29CQUN0QixVQUFVLEVBQUUsY0FBYztvQkFDMUIsU0FBUyxFQUFFLEtBQUs7b0JBQ2hCLEtBQUssRUFBRSxtQkFBbUI7b0JBQzFCLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUs7aUJBQzlCLENBQUM7YUFDSDtZQUNELEtBQUssRUFBRSxFQUFFO1lBQ1QsTUFBTSxFQUFFLENBQUM7U0FDVixDQUFDLENBQ0gsQ0FBQztRQUVGLHdEQUF3RDtRQUN4RCxNQUFNLG9CQUFvQixHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUUsU0FBUyxFQUFFLDJCQUEyQjtZQUN0QyxnQkFBZ0IsRUFBRSxnREFBZ0Q7WUFDbEUsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsU0FBUyxFQUFFLFdBQVc7Z0JBQ3RCLFVBQVUsRUFBRSxhQUFhO2dCQUN6QixTQUFTLEVBQUUsU0FBUzthQUNyQixDQUFDO1lBQ0YsU0FBUyxFQUFFLEVBQUU7WUFDYixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxzQkFBc0I7WUFDeEUsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLGFBQWE7U0FDNUQsQ0FBQyxDQUFDO1FBRUgsOEJBQThCO1FBQzlCLG9CQUFvQixDQUFDLGNBQWMsQ0FDakMsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQzNELENBQUM7UUFFRiwyREFBMkQ7UUFDM0QsZ0VBQWdFO1FBQ2hFLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUNqRixRQUFRLEVBQUUsaUJBQWlCO1lBQzNCLGVBQWUsRUFBRSxXQUFXO1lBQzVCLFVBQVUsRUFBRSxzQkFBc0I7WUFDbEMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsdUJBQXVCLENBQUM7WUFDN0csV0FBVyxFQUFFLEdBQUc7WUFDaEIsWUFBWSxFQUFFLENBQUM7U0FDaEIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxjQUFjLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUNsRSxTQUFTLEVBQUUsK0JBQStCO1lBQzFDLGdCQUFnQixFQUFFLCtDQUErQztZQUNqRSxNQUFNLEVBQUUscUJBQXFCLENBQUMsTUFBTSxDQUFDO2dCQUNuQyxTQUFTLEVBQUUsS0FBSztnQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNoQyxDQUFDO1lBQ0YsU0FBUyxFQUFFLENBQUM7WUFDWixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxrQ0FBa0M7WUFDcEYsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLGFBQWE7U0FDNUQsQ0FBQyxDQUFDO1FBRUgsY0FBYyxDQUFDLGNBQWMsQ0FDM0IsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQzNELENBQUM7UUFFRixtREFBbUQ7UUFDbkQsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzFFLFNBQVMsRUFBRSx5QkFBeUI7WUFDcEMsZ0JBQWdCLEVBQUUsbURBQW1EO1lBQ3JFLE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzVCLFNBQVMsRUFBRSxXQUFXO2dCQUN0QixVQUFVLEVBQUUsVUFBVTtnQkFDdEIsU0FBUyxFQUFFLFNBQVM7YUFDckIsQ0FBQztZQUNGLFNBQVMsRUFBRSxNQUFNLEVBQUUsNEJBQTRCO1lBQy9DLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLHNCQUFzQjtZQUN4RSxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtTQUM1RCxDQUFDLENBQUM7UUFFSCxrQkFBa0IsQ0FBQyxjQUFjLENBQy9CLElBQUksa0JBQWtCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUMzRCxDQUFDO1FBRUYseUJBQXlCO1FBQ3pCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO1lBQ2hDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDbkIsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixVQUFVLEVBQUUsZUFBZTtTQUM1QixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRTtZQUMvQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTO1lBQ3pCLFdBQVcsRUFBRSxnQkFBZ0I7WUFDN0IsVUFBVSxFQUFFLGNBQWM7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsNkNBQTZDO1FBQzdDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7WUFDaEQsS0FBSyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRO1lBQ3hDLFdBQVcsRUFBRSxxQ0FBcUM7WUFDbEQsVUFBVSxFQUFFLHdCQUF3QjtTQUNyQyxDQUFDLENBQUM7UUFFSCx5Q0FBeUM7UUFDekMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsMkJBQTJCO1lBQ2xDLFdBQVcsRUFBRSwrQ0FBK0M7U0FDN0QsQ0FBQyxDQUFDO1FBRUgsa0NBQWtDO1FBQ2xDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0MsS0FBSyxFQUFFLHlEQUF5RCxJQUFJLENBQUMsTUFBTSxvQkFBb0Isa0JBQWtCLENBQUMsYUFBYSxFQUFFO1lBQ2pJLFdBQVcsRUFBRSxvREFBb0Q7U0FDbEUsQ0FBQyxDQUFDO1FBRUgsb0JBQW9CO1FBQ3BCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUseUJBQXlCLEVBQUU7WUFDakQsS0FBSyxFQUFFLG9CQUFvQixDQUFDLFFBQVE7WUFDcEMsV0FBVyxFQUFFLDZCQUE2QjtTQUMzQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxjQUFjLENBQUMsUUFBUTtZQUM5QixXQUFXLEVBQUUsZ0NBQWdDO1NBQzlDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0MsS0FBSyxFQUFFLGtCQUFrQixDQUFDLFFBQVE7WUFDbEMsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7UUFFSCxtQ0FBbUM7UUFDbkMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsd0JBQXdCLENBQUMsV0FBVztZQUMzQyxXQUFXLEVBQUUsZ0NBQWdDO1lBQzdDLFVBQVUsRUFBRSxvQkFBb0I7U0FDakMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3QyxLQUFLLEVBQUUsd0JBQXdCLENBQUMsWUFBWTtZQUM1QyxXQUFXLEVBQUUsaUNBQWlDO1lBQzlDLFVBQVUsRUFBRSxxQkFBcUI7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsa0NBQWtDO1FBQ2xDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxPQUFPO1lBQzVCLFdBQVcsRUFBRSxxQ0FBcUM7WUFDbEQsVUFBVSxFQUFFLGtCQUFrQjtTQUMvQixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxhQUFhLENBQUMsUUFBUTtZQUM3QixXQUFXLEVBQUUsc0NBQXNDO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLDBDQUEwQztZQUNqRCxXQUFXLEVBQUUscUJBQXFCO1NBQ25DLENBQUMsQ0FBQztRQUVILHVDQUF1QztRQUN2QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO1lBQ25ELEtBQUssRUFBRSx3QkFBd0IsQ0FBQyxXQUFXO1lBQzNDLFdBQVcsRUFBRSwrQ0FBK0M7WUFDNUQsVUFBVSxFQUFFLDJCQUEyQjtTQUN4QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ3BELEtBQUssRUFBRSx3QkFBd0IsQ0FBQyxZQUFZO1lBQzVDLFdBQVcsRUFBRSxnREFBZ0Q7WUFDN0QsVUFBVSxFQUFFLDRCQUE0QjtTQUN6QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyx1QkFBdUI7WUFDN0MsV0FBVyxFQUFFLHVDQUF1QztTQUNyRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6d0NELG9DQXl3Q0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBzc20gZnJvbSAnYXdzLWNkay1saWIvYXdzLXNzbSc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hfYWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIGV2ZW50c190YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmludGVyZmFjZSBCYWNrZW5kU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcHJvZHVjdHNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIGNyZWF0b3JzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBhbmFseXRpY3NFdmVudHNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIGFuYWx5dGljc1N1bW1hcmllc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgaW1hZ2VzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xufVxuXG5leHBvcnQgY2xhc3MgQmFja2VuZFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgcHJpY2VTeW5jQWxlcnRUb3BpYzogc25zLlRvcGljO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCYWNrZW5kU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBwcm9kdWN0c1RhYmxlLCBjcmVhdG9yc1RhYmxlLCBhbmFseXRpY3NFdmVudHNUYWJsZSwgYW5hbHl0aWNzU3VtbWFyaWVzVGFibGUsIGltYWdlc0J1Y2tldCwgdXNlclBvb2wgfSA9IHByb3BzO1xuXG4gICAgLy8gQ3JlYXRlIFNOUyB0b3BpYyBmb3IgcHJpY2Ugc3luYyBhbGVydHNcbiAgICB0aGlzLnByaWNlU3luY0FsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdQcmljZVN5bmNBbGVydFRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1wcmljZS1zeW5jLWFsZXJ0cycsXG4gICAgICBkaXNwbGF5TmFtZTogJ0FtYXpvbiBQcmljZSBTeW5jIEFsZXJ0cycsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgUGFyYW1ldGVyIFN0b3JlIHBhcmFtZXRlcnMgZm9yIFBBLUFQSSBjcmVkZW50aWFsc1xuICAgIC8vIE5vdGU6IFRoZXNlIGFyZSBwbGFjZWhvbGRlcnMgLSBhY3R1YWwgdmFsdWVzIG11c3QgYmUgc2V0IG1hbnVhbGx5IHZpYSBBV1MgQ29uc29sZSBvciBDTElcbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnUEFBUElBY2Nlc3NLZXknLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnL2FtYXpvbi1hZmZpbGlhdGUvcGEtYXBpL2FjY2Vzcy1rZXknLFxuICAgICAgc3RyaW5nVmFsdWU6ICdQTEFDRUhPTERFUl9BQ0NFU1NfS0VZJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW1hem9uIFByb2R1Y3QgQWR2ZXJ0aXNpbmcgQVBJIEFjY2VzcyBLZXknLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnUEFBUElTZWNyZXRLZXknLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnL2FtYXpvbi1hZmZpbGlhdGUvcGEtYXBpL3NlY3JldC1rZXknLFxuICAgICAgc3RyaW5nVmFsdWU6ICdQTEFDRUhPTERFUl9TRUNSRVRfS0VZJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW1hem9uIFByb2R1Y3QgQWR2ZXJ0aXNpbmcgQVBJIFNlY3JldCBLZXknLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnUEFBUElQYXJ0bmVyVGFnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogJy9hbWF6b24tYWZmaWxpYXRlL3BhLWFwaS9wYXJ0bmVyLXRhZycsXG4gICAgICBzdHJpbmdWYWx1ZTogJ1BMQUNFSE9MREVSX1BBUlRORVJfVEFHJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW1hem9uIEFzc29jaWF0ZXMgUGFydG5lciBUYWcnLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnUEFBUElNYXJrZXRwbGFjZScsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICcvYW1hem9uLWFmZmlsaWF0ZS9wYS1hcGkvbWFya2V0cGxhY2UnLFxuICAgICAgc3RyaW5nVmFsdWU6ICd3d3cuYW1hem9uLmNvbScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FtYXpvbiBNYXJrZXRwbGFjZSAoZGVmYXVsdDogVVMpJyxcbiAgICAgIHRpZXI6IHNzbS5QYXJhbWV0ZXJUaWVyLlNUQU5EQVJELFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIElBTSByb2xlIGZvciBMYW1iZGEgZnVuY3Rpb25zXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zXG4gICAgcHJvZHVjdHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG4gICAgY3JlYXRvcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG4gICAgYW5hbHl0aWNzRXZlbnRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuICAgIGFuYWx5dGljc1N1bW1hcmllc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFSb2xlKTtcblxuICAgIC8vIEdyYW50IFMzIHBlcm1pc3Npb25zXG4gICAgaW1hZ2VzQnVja2V0LmdyYW50UmVhZFdyaXRlKGxhbWJkYVJvbGUpO1xuXG4gICAgLy8gR3JhbnQgQ29nbml0byBwZXJtaXNzaW9ucyBmb3IgdXNlciBtYW5hZ2VtZW50XG4gICAgbGFtYmRhUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlcicsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluRGVsZXRlVXNlcicsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluR2V0VXNlcicsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluVXBkYXRlVXNlckF0dHJpYnV0ZXMnLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZCcsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQWRkVXNlclRvR3JvdXAnLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pblJlbW92ZVVzZXJGcm9tR3JvdXAnLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkxpc3RHcm91cHNGb3JVc2VyJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6TGlzdFVzZXJzJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6TGlzdFVzZXJzSW5Hcm91cCcsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW3VzZXJQb29sLnVzZXJQb29sQXJuXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IFNFUyBwZXJtaXNzaW9ucyBmb3Igc2VuZGluZyBlbWFpbHNcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnc2VzOlNlbmRFbWFpbCcsXG4gICAgICAgICAgJ3NlczpTZW5kUmF3RW1haWwnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLCAvLyBTRVMgcmVxdWlyZXMgKiBmb3IgZW1haWwgc2VuZGluZ1xuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgUGFyYW1ldGVyIFN0b3JlIHBlcm1pc3Npb25zIGZvciBQQS1BUEkgY3JlZGVudGlhbHNcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnc3NtOkdldFBhcmFtZXRlcicsXG4gICAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6c3NtOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpwYXJhbWV0ZXIvYW1hem9uLWFmZmlsaWF0ZS8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IFNOUyBwZXJtaXNzaW9ucyBmb3IgcHJpY2Ugc3luYyBhbGVydHNcbiAgICB0aGlzLnByaWNlU3luY0FsZXJ0VG9waWMuZ3JhbnRQdWJsaXNoKGxhbWJkYVJvbGUpO1xuXG4gICAgLy8gR3JhbnQgQ2xvdWRXYXRjaCBwZXJtaXNzaW9ucyBmb3IgY3VzdG9tIG1ldHJpY3NcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8gQ2xvdWRXYXRjaCBtZXRyaWNzIHJlcXVpcmUgKiByZXNvdXJjZVxuICAgICAgfSlcbiAgICApO1xuXG5cblxuICAgIC8vIENvbW1vbiBMYW1iZGEgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgY29uc3QgY29tbW9uRW52aXJvbm1lbnQgPSB7XG4gICAgICBQUk9EVUNUU19UQUJMRV9OQU1FOiBwcm9kdWN0c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIENSRUFUT1JTX1RBQkxFX05BTUU6IGNyZWF0b3JzVGFibGUudGFibGVOYW1lLFxuICAgICAgQU5BTFlUSUNTX0VWRU5UU19UQUJMRV9OQU1FOiBhbmFseXRpY3NFdmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBBTkFMWVRJQ1NfU1VNTUFSSUVTX1RBQkxFX05BTUU6IGFuYWx5dGljc1N1bW1hcmllc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIElNQUdFU19CVUNLRVRfTkFNRTogaW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBSRUdJT046IHRoaXMucmVnaW9uLFxuICAgIH07XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBsYW1iZGFDb25maWcgPSB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgfTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb25zIC0gdXNpbmcgY29tcGlsZWQgZGlzdCBmb2xkZXJcbiAgICBjb25zdCBnZXRQcm9kdWN0c0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0UHJvZHVjdHNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtZ2V0UHJvZHVjdHMnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2dldFByb2R1Y3RzL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgYWxsIHByb2R1Y3RzIHdpdGggb3B0aW9uYWwgY2F0ZWdvcnkgZmlsdGVyaW5nJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldFByb2R1Y3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldFByb2R1Y3RGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtZ2V0UHJvZHVjdCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvZ2V0UHJvZHVjdC9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IGEgc2luZ2xlIHByb2R1Y3QgYnkgSUQnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY3JlYXRlUHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ3JlYXRlUHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1jcmVhdGVQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9jcmVhdGVQcm9kdWN0L2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGUgYSBuZXcgcHJvZHVjdCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGRhdGVQcm9kdWN0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVcGRhdGVQcm9kdWN0RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXVwZGF0ZVByb2R1Y3QnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL3VwZGF0ZVByb2R1Y3QvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VwZGF0ZSBhbiBleGlzdGluZyBwcm9kdWN0JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRlbGV0ZVByb2R1Y3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0RlbGV0ZVByb2R1Y3RGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtZGVsZXRlUHJvZHVjdCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvZGVsZXRlUHJvZHVjdC9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGVsZXRlIGEgcHJvZHVjdCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGxvYWRJbWFnZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBsb2FkSW1hZ2VGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtdXBsb2FkSW1hZ2UnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL3VwbG9hZEltYWdlL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdHZW5lcmF0ZSBwcmVzaWduZWQgVVJMIGZvciBpbWFnZSB1cGxvYWQnLFxuICAgIH0pO1xuXG4gICAgLy8gVXNlciBNYW5hZ2VtZW50IExhbWJkYSBGdW5jdGlvbnNcbiAgICBjb25zdCBjcmVhdGVVc2VyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDcmVhdGVVc2VyRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWNyZWF0ZVVzZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2NyZWF0ZVVzZXIvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NyZWF0ZSBhIG5ldyBhZG1pbiB1c2VyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGxpc3RVc2Vyc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTGlzdFVzZXJzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWxpc3RVc2VycycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvbGlzdFVzZXJzL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdMaXN0IGFsbCB1c2VycycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkZWxldGVVc2VyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdEZWxldGVVc2VyRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWRlbGV0ZVVzZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2RlbGV0ZVVzZXIvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RlbGV0ZSBhIHVzZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVzZXRQYXNzd29yZEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUmVzZXRQYXNzd29yZEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1yZXNldFBhc3N3b3JkJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9yZXNldFBhc3N3b3JkL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdSZXNldCB1c2VyIHBhc3N3b3JkJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFkbWluR2V0UHJvZHVjdHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FkbWluR2V0UHJvZHVjdHNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtYWRtaW5HZXRQcm9kdWN0cycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvYWRtaW5HZXRQcm9kdWN0cy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IGFsbCBwcm9kdWN0cyBmb3IgYWRtaW4gKGluY2x1ZGluZyB1bnB1Ymxpc2hlZCknLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0Q2F0ZWdvcmllc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0Q2F0ZWdvcmllc0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1nZXRDYXRlZ29yaWVzJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9nZXRDYXRlZ29yaWVzL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgYWxsIHByb2R1Y3QgY2F0ZWdvcmllcycsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRXYXRjaCBMb2cgR3JvdXAgZm9yIFByaWNlIFN5bmMgTGFtYmRhXG4gICAgLy8gUmVxdWlyZW1lbnQgOC40OiBBZGQgQ2xvdWRXYXRjaCBsb2cgZ3JvdXBcbiAgICBjb25zdCBwcmljZVN5bmNMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdQcmljZVN5bmNMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9hd3MvbGFtYmRhL3BpbnRlcmVzdC1hZmZpbGlhdGUtc3luY0FtYXpvblByaWNlcycsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgUHJpY2UgU3luYyBMYW1iZGEgRnVuY3Rpb25cbiAgICAvLyBSZXF1aXJlbWVudHMgMy4xLCAzLjI6IFNjaGVkdWxlZCBMYW1iZGEgZm9yIGF1dG9tYXRpYyBwcmljZSBzeW5jaHJvbml6YXRpb25cbiAgICBjb25zdCBzeW5jQW1hem9uUHJpY2VzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTeW5jQW1hem9uUHJpY2VzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXN5bmNBbWF6b25QcmljZXMnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL3N5bmNBbWF6b25QcmljZXMvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1N5bmNocm9uaXplIHByb2R1Y3QgcHJpY2VzIHdpdGggQW1hem9uIFBBLUFQSScsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxMCksIC8vIExvbmdlciB0aW1lb3V0IGZvciBiYXRjaCBwcm9jZXNzaW5nXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LCAvLyBNb3JlIG1lbW9yeSBmb3IgcHJvY2Vzc2luZyBtdWx0aXBsZSBwcm9kdWN0c1xuICAgICAgbG9nR3JvdXA6IHByaWNlU3luY0xvZ0dyb3VwLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXG4gICAgICAgIFNOU19UT1BJQ19BUk46IHRoaXMucHJpY2VTeW5jQWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgRXZlbnRCcmlkZ2UgcnVsZSBmb3Igc2NoZWR1bGVkIGV4ZWN1dGlvblxuICAgIC8vIFJlcXVpcmVtZW50IDMuMTogU2NoZWR1bGUgdG8gcnVuIGRhaWx5IGF0IDIgQU0gVVRDXG4gICAgY29uc3QgcHJpY2VTeW5jUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnUHJpY2VTeW5jU2NoZWR1bGVSdWxlJywge1xuICAgICAgcnVsZU5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXByaWNlLXN5bmMtZGFpbHknLFxuICAgICAgZGVzY3JpcHRpb246ICdUcmlnZ2VycyBwcmljZSBzeW5jIExhbWJkYSBkYWlseSBhdCAyIEFNIFVUQycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzInLFxuICAgICAgICBkYXk6ICcqJyxcbiAgICAgICAgbW9udGg6ICcqJyxcbiAgICAgICAgeWVhcjogJyonLFxuICAgICAgfSksXG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIExhbWJkYSBhcyB0YXJnZXQgd2l0aCByZXRyeSBwb2xpY3lcbiAgICAvLyBSZXF1aXJlbWVudCAzLjI6IENvbmZpZ3VyZSByZXRyeSBwb2xpY3kgKDIgcmV0cmllcyB3aXRoIGV4cG9uZW50aWFsIGJhY2tvZmYpXG4gICAgcHJpY2VTeW5jUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgZXZlbnRzX3RhcmdldHMuTGFtYmRhRnVuY3Rpb24oc3luY0FtYXpvblByaWNlc0Z1bmN0aW9uLCB7XG4gICAgICAgIHJldHJ5QXR0ZW1wdHM6IDIsXG4gICAgICAgIG1heEV2ZW50QWdlOiBjZGsuRHVyYXRpb24uaG91cnMoMiksXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBFdmVudEJyaWRnZSBwZXJtaXNzaW9uIHRvIGludm9rZSB0aGUgTGFtYmRhXG4gICAgc3luY0FtYXpvblByaWNlc0Z1bmN0aW9uLmdyYW50SW52b2tlKG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZXZlbnRzLmFtYXpvbmF3cy5jb20nKSk7XG5cbiAgICAvLyBDcmVhdGUgTWFudWFsIFByaWNlIFN5bmMgVHJpZ2dlciBMYW1iZGEgRnVuY3Rpb25cbiAgICAvLyBSZXF1aXJlbWVudCAzLjQ6IE1hbnVhbCBzeW5jIHRyaWdnZXIgZW5kcG9pbnQgZm9yIGFkbWluaXN0cmF0b3JzXG4gICAgY29uc3QgdHJpZ2dlclByaWNlU3luY0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVHJpZ2dlclByaWNlU3luY0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS10cmlnZ2VyUHJpY2VTeW5jJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy90cmlnZ2VyUHJpY2VTeW5jL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdNYW51YWxseSB0cmlnZ2VyIHByaWNlIHN5bmMgd2l0aCBBbWF6b24gUEEtQVBJJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxuICAgICAgICBQUklDRV9TWU5DX0xBTUJEQV9OQU1FOiBzeW5jQW1hem9uUHJpY2VzRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb24gdG8gaW52b2tlIHRoZSBwcmljZSBzeW5jIExhbWJkYVxuICAgIC8vIE5vdGU6IER1ZSB0byBjaXJjdWxhciBkZXBlbmRlbmN5IHdpdGggc2hhcmVkIExhbWJkYSByb2xlLCB0aGlzIHBlcm1pc3Npb25cbiAgICAvLyBpcyBhZGRlZCBtYW51YWxseSB2aWEgQVdTIENMSSBhZnRlciBkZXBsb3ltZW50XG4gICAgLy8gQ29tbWFuZDogYXdzIGlhbSBwdXQtcm9sZS1wb2xpY3kgLS1yb2xlLW5hbWUgPExhbWJkYUV4ZWN1dGlvblJvbGU+IC0tcG9saWN5LW5hbWUgSW52b2tlUHJpY2VTeW5jTGFtYmRhIC0tcG9saWN5LWRvY3VtZW50ICd7XCJWZXJzaW9uXCI6XCIyMDEyLTEwLTE3XCIsXCJTdGF0ZW1lbnRcIjpbe1wiRWZmZWN0XCI6XCJBbGxvd1wiLFwiQWN0aW9uXCI6XCJsYW1iZGE6SW52b2tlRnVuY3Rpb25cIixcIlJlc291cmNlXCI6XCJhcm46YXdzOmxhbWJkYTpSRUdJT046QUNDT1VOVDpmdW5jdGlvbjpwaW50ZXJlc3QtYWZmaWxpYXRlLXN5bmNBbWF6b25QcmljZXNcIn1dfSdcblxuICAgIC8vIENyZWF0ZSBHZXQgU3luYyBIaXN0b3J5IExhbWJkYSBGdW5jdGlvblxuICAgIC8vIFJlcXVpcmVtZW50IDYuNDogRGlzcGxheSBzeW5jIGV4ZWN1dGlvbiBsb2dzIGluIGFkbWluIHBhbmVsXG4gICAgY29uc3QgZ2V0U3luY0hpc3RvcnlGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldFN5bmNIaXN0b3J5RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWdldFN5bmNIaXN0b3J5JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9nZXRTeW5jSGlzdG9yeS9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmV0cmlldmUgcHJpY2Ugc3luYyBleGVjdXRpb24gaGlzdG9yeSBmcm9tIENsb3VkV2F0Y2ggTG9ncycsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBDbG91ZFdhdGNoIExvZ3MgcmVhZCBwZXJtaXNzaW9uc1xuICAgIGdldFN5bmNIaXN0b3J5RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnbG9nczpGaWx0ZXJMb2dFdmVudHMnLFxuICAgICAgICAgICdsb2dzOkRlc2NyaWJlTG9nU3RyZWFtcycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmxvZ3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmxvZy1ncm91cDovYXdzL2xhbWJkYS9zeW5jQW1hem9uUHJpY2VzOipgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIENvZ25pdG8gQXV0aG9yaXplciBmb3IgQVBJIEdhdGV3YXlcbiAgICBjb25zdCBhdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIodGhpcywgJ0NvZ25pdG9BdXRob3JpemVyJywge1xuICAgICAgY29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcbiAgICAgIGF1dGhvcml6ZXJOYW1lOiAnQWRtaW5BdXRob3JpemVyJyxcbiAgICAgIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIEFQSSBHYXRld2F5XG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdQaW50ZXJlc3RBZmZpbGlhdGVBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ1BpbnRlcmVzdCBBZmZpbGlhdGUgQVBJJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIGZvciBQaW50ZXJlc3QgQWZmaWxpYXRlIFBsYXRmb3JtJyxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIC8vIERpc2FibGUgY2FjaGluZyBieSBkZWZhdWx0ICh3aWxsIGVuYWJsZSBvbmx5IGZvciBwdWJsaWMgZW5kcG9pbnRzKVxuICAgICAgICBjYWNoaW5nRW5hYmxlZDogZmFsc2UsXG4gICAgICAgIC8vIEVuYWJsZSB0aHJvdHRsaW5nIGF0IHRoZSBzdGFnZSBsZXZlbFxuICAgICAgICB0aHJvdHRsaW5nQnVyc3RMaW1pdDogNTAwMCwgLy8gTWF4aW11bSBjb25jdXJyZW50IHJlcXVlc3RzXG4gICAgICAgIHRocm90dGxpbmdSYXRlTGltaXQ6IDEwMDAwLCAvLyBNYXhpbXVtIHJlcXVlc3RzIHBlciBzZWNvbmRcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxuICAgICAgICAgICdYLUFwaS1LZXknLFxuICAgICAgICAgICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXG4gICAgICAgIF0sXG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIEFQSSByZXNvdXJjZXMgYW5kIG1ldGhvZHNcbiAgICBjb25zdCBhcGlSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2FwaScpO1xuXG4gICAgLy8gUHVibGljIGVuZHBvaW50cyB3aXRoIGNhY2hpbmdcbiAgICBjb25zdCBwcm9kdWN0c1Jlc291cmNlID0gYXBpUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Byb2R1Y3RzJyk7XG4gICAgcHJvZHVjdHNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFByb2R1Y3RzRnVuY3Rpb24sIHtcbiAgICAgICAgY2FjaGVLZXlQYXJhbWV0ZXJzOiBbJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmNhdGVnb3J5J10sXG4gICAgICB9KSxcbiAgICAgIHtcbiAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuY2F0ZWdvcnknOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQ2FjaGUtQ29udHJvbCc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IHByb2R1Y3RSZXNvdXJjZSA9IHByb2R1Y3RzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICBwcm9kdWN0UmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRQcm9kdWN0RnVuY3Rpb24sIHtcbiAgICAgICAgY2FjaGVLZXlQYXJhbWV0ZXJzOiBbJ21ldGhvZC5yZXF1ZXN0LnBhdGguaWQnXSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5wYXRoLmlkJzogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQ2FjaGUtQ29udHJvbCc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIENhdGVnb3JpZXMgZW5kcG9pbnRcbiAgICBjb25zdCBjYXRlZ29yaWVzUmVzb3VyY2UgPSBhcGlSZXNvdXJjZS5hZGRSZXNvdXJjZSgnY2F0ZWdvcmllcycpO1xuICAgIGNhdGVnb3JpZXNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldENhdGVnb3JpZXNGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkNhY2hlLUNvbnRyb2wnOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBBZG1pbiBlbmRwb2ludHMgKHByb3RlY3RlZCBieSBDb2duaXRvKVxuICAgIGNvbnN0IGFkbWluUmVzb3VyY2UgPSBhcGlSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYWRtaW4nKTtcbiAgICBjb25zdCBhZG1pblByb2R1Y3RzUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdwcm9kdWN0cycpO1xuXG4gICAgLy8gR0VUIGFsbCBwcm9kdWN0cyAoYWRtaW4gLSBpbmNsdWRlcyB1bnB1Ymxpc2hlZClcbiAgICBhZG1pblByb2R1Y3RzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhZG1pbkdldFByb2R1Y3RzRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBhZG1pblByb2R1Y3RzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY3JlYXRlUHJvZHVjdEZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgYWRtaW5Qcm9kdWN0UmVzb3VyY2UgPSBhZG1pblByb2R1Y3RzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICBhZG1pblByb2R1Y3RSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUFVUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVwZGF0ZVByb2R1Y3RGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcbiAgICBhZG1pblByb2R1Y3RSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnREVMRVRFJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGRlbGV0ZVByb2R1Y3RGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IHVwbG9hZEltYWdlUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCd1cGxvYWQtaW1hZ2UnKTtcbiAgICB1cGxvYWRJbWFnZVJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQT1NUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVwbG9hZEltYWdlRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBVc2VyIE1hbmFnZW1lbnQgZW5kcG9pbnRzIChwcm90ZWN0ZWQgYnkgQ29nbml0bylcbiAgICBjb25zdCB1c2Vyc1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgndXNlcnMnKTtcbiAgICB1c2Vyc1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGlzdFVzZXJzRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG4gICAgdXNlcnNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUE9TVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVVc2VyRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCB1c2VyUmVzb3VyY2UgPSB1c2Vyc1Jlc291cmNlLmFkZFJlc291cmNlKCd7dXNlcm5hbWV9Jyk7XG4gICAgdXNlclJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdERUxFVEUnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZGVsZXRlVXNlckZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgcmVzZXRQYXNzd29yZFJlc291cmNlID0gdXNlclJlc291cmNlLmFkZFJlc291cmNlKCdyZXNldC1wYXNzd29yZCcpO1xuICAgIHJlc2V0UGFzc3dvcmRSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUE9TVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihyZXNldFBhc3N3b3JkRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBNYW51YWwgUHJpY2UgU3luYyBUcmlnZ2VyIGVuZHBvaW50IChwcm90ZWN0ZWQgYnkgQ29nbml0bylcbiAgICAvLyBSZXF1aXJlbWVudCAzLjQ6IFBPU1QgL2FkbWluL3N5bmMtcHJpY2VzIEFQSSBlbmRwb2ludFxuICAgIGNvbnN0IHN5bmNQcmljZXNSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3N5bmMtcHJpY2VzJyk7XG4gICAgc3luY1ByaWNlc1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQT1NUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRyaWdnZXJQcmljZVN5bmNGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFN5bmMgSGlzdG9yeSBlbmRwb2ludCAocHJvdGVjdGVkIGJ5IENvZ25pdG8pXG4gICAgLy8gUmVxdWlyZW1lbnQgNi40OiBHRVQgL2FkbWluL3N5bmMtaGlzdG9yeSBBUEkgZW5kcG9pbnRcbiAgICBjb25zdCBzeW5jSGlzdG9yeVJlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3luYy1oaXN0b3J5Jyk7XG4gICAgc3luY0hpc3RvcnlSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFN5bmNIaXN0b3J5RnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gTXVsdGktQ3JlYXRvciBQbGF0Zm9ybSBBUEkgUm91dGVzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbnMgZm9yIG11bHRpLWNyZWF0b3IgcGxhdGZvcm1cbiAgICBjb25zdCBjcmVhdGVDcmVhdG9yRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDcmVhdGVDcmVhdG9yRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWNyZWF0ZUNyZWF0b3InLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2NyZWF0ZUNyZWF0b3IvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NyZWF0ZSBhIG5ldyBjcmVhdG9yIHByb2ZpbGUnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0Q3JlYXRvckJ5U2x1Z0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0Q3JlYXRvckJ5U2x1Z0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1nZXRDcmVhdG9yQnlTbHVnJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9nZXRDcmVhdG9yQnlTbHVnL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgY3JlYXRvciBwcm9maWxlIGJ5IHNsdWcnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXBkYXRlQ3JlYXRvclByb2ZpbGVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VwZGF0ZUNyZWF0b3JQcm9maWxlRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXVwZGF0ZUNyZWF0b3JQcm9maWxlJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy91cGRhdGVDcmVhdG9yUHJvZmlsZS9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXBkYXRlIGNyZWF0b3IgcHJvZmlsZScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRDcmVhdG9yQW5hbHl0aWNzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRDcmVhdG9yQW5hbHl0aWNzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWdldENyZWF0b3JBbmFseXRpY3MnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2dldENyZWF0b3JBbmFseXRpY3MvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBjcmVhdG9yIGFuYWx5dGljcycsXG4gICAgfSk7XG5cbiAgICBjb25zdCB0cmFja1BhZ2VWaWV3RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdUcmFja1BhZ2VWaWV3RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXRyYWNrUGFnZVZpZXcnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL3RyYWNrUGFnZVZpZXcvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyYWNrIHBhZ2UgdmlldyBldmVudCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCB0cmFja0FmZmlsaWF0ZUNsaWNrRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdUcmFja0FmZmlsaWF0ZUNsaWNrRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXRyYWNrQWZmaWxpYXRlQ2xpY2snLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL3RyYWNrQWZmaWxpYXRlQ2xpY2svaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyYWNrIGFmZmlsaWF0ZSBjbGljayBldmVudCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRQZW5kaW5nUHJvZHVjdHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldFBlbmRpbmdQcm9kdWN0c0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1nZXRQZW5kaW5nUHJvZHVjdHMnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2dldFBlbmRpbmdQcm9kdWN0cy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IGFsbCBwZW5kaW5nIHByb2R1Y3RzIGZvciBtb2RlcmF0aW9uJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwcHJvdmVQcm9kdWN0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcHByb3ZlUHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1hcHByb3ZlUHJvZHVjdCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvYXBwcm92ZVByb2R1Y3QvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FwcHJvdmUgYSBwcm9kdWN0JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlamVjdFByb2R1Y3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1JlamVjdFByb2R1Y3RGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtcmVqZWN0UHJvZHVjdCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvcmVqZWN0UHJvZHVjdC9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVqZWN0IGEgcHJvZHVjdCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBsaXN0QWxsQ3JlYXRvcnNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xpc3RBbGxDcmVhdG9yc0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1saXN0QWxsQ3JlYXRvcnMnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2xpc3RBbGxDcmVhdG9ycy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdCBhbGwgY3JlYXRvcnMgKGFkbWluKScsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGRhdGVDcmVhdG9yU3RhdHVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVcGRhdGVDcmVhdG9yU3RhdHVzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXVwZGF0ZUNyZWF0b3JTdGF0dXMnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL3VwZGF0ZUNyZWF0b3JTdGF0dXMvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VwZGF0ZSBjcmVhdG9yIHN0YXR1cyAoYWRtaW4pJyxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBQdWJsaWMgQ3JlYXRvciBSb3V0ZXMgKE5vIEF1dGggUmVxdWlyZWQpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gR0VUIC9hcGkvY3JlYXRvcnMve3NsdWd9XG4gICAgY29uc3QgY3JlYXRvcnNSZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFJlc291cmNlKCdjcmVhdG9ycycpO1xuICAgIFxuICAgIC8vIFBPU1QgL2FwaS9jcmVhdG9ycyAocHVibGljIGNyZWF0b3Igc2lnbnVwKVxuICAgIGNyZWF0b3JzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY3JlYXRlQ3JlYXRvckZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuICAgIFxuICAgIGNvbnN0IGNyZWF0b3JTbHVnUmVzb3VyY2UgPSBjcmVhdG9yc1Jlc291cmNlLmFkZFJlc291cmNlKCd7c2x1Z30nKTtcbiAgICBjcmVhdG9yU2x1Z1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0Q3JlYXRvckJ5U2x1Z0Z1bmN0aW9uLCB7XG4gICAgICAgIGNhY2hlS2V5UGFyYW1ldGVyczogWydtZXRob2QucmVxdWVzdC5wYXRoLnNsdWcnXSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5wYXRoLnNsdWcnOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5DYWNoZS1Db250cm9sJzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR0VUIC9hcGkvY3JlYXRvcnMve3NsdWd9L3Byb2R1Y3RzXG4gICAgY29uc3QgY3JlYXRvclByb2R1Y3RzUmVzb3VyY2UgPSBjcmVhdG9yU2x1Z1Jlc291cmNlLmFkZFJlc291cmNlKCdwcm9kdWN0cycpO1xuICAgIGNyZWF0b3JQcm9kdWN0c1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZHVjdHNGdW5jdGlvbiwge1xuICAgICAgICBjYWNoZUtleVBhcmFtZXRlcnM6IFtcbiAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QucGF0aC5zbHVnJyxcbiAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuY2F0ZWdvcnknLFxuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5zZWFyY2gnLFxuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5zb3J0JyxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5wYXRoLnNsdWcnOiB0cnVlLFxuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5jYXRlZ29yeSc6IGZhbHNlLFxuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5zZWFyY2gnOiBmYWxzZSxcbiAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuc29ydCc6IGZhbHNlLFxuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5saW1pdCc6IGZhbHNlLFxuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5vZmZzZXQnOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQ2FjaGUtQ29udHJvbCc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEdFVCAvYXBpL2NyZWF0b3JzL3tzbHVnfS9mZWF0dXJlZFxuICAgIGNvbnN0IGNyZWF0b3JGZWF0dXJlZFJlc291cmNlID0gY3JlYXRvclNsdWdSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZmVhdHVyZWQnKTtcbiAgICBjcmVhdG9yRmVhdHVyZWRSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFByb2R1Y3RzRnVuY3Rpb24sIHtcbiAgICAgICAgY2FjaGVLZXlQYXJhbWV0ZXJzOiBbJ21ldGhvZC5yZXF1ZXN0LnBhdGguc2x1ZyddLFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGguc2x1Zyc6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkNhY2hlLUNvbnRyb2wnOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ3JlYXRvciBSb3V0ZXMgKENyZWF0b3IgQXV0aCBSZXF1aXJlZClcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zdCBjcmVhdG9yUmVzb3VyY2UgPSBhcGlSZXNvdXJjZS5hZGRSZXNvdXJjZSgnY3JlYXRvcicpO1xuXG4gICAgLy8gR0VUIC9hcGkvY3JlYXRvci9wcm9maWxlXG4gICAgLy8gUFVUIC9hcGkvY3JlYXRvci9wcm9maWxlXG4gICAgY29uc3QgY3JlYXRvclByb2ZpbGVSZXNvdXJjZSA9IGNyZWF0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZSgncHJvZmlsZScpO1xuICAgIGNyZWF0b3JQcm9maWxlUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRDcmVhdG9yQnlTbHVnRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG4gICAgY3JlYXRvclByb2ZpbGVSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUFVUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVwZGF0ZUNyZWF0b3JQcm9maWxlRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHRVQgL2FwaS9jcmVhdG9yL3Byb2R1Y3RzXG4gICAgLy8gUE9TVCAvYXBpL2NyZWF0b3IvcHJvZHVjdHNcbiAgICBjb25zdCBjcmVhdG9yT3duUHJvZHVjdHNSZXNvdXJjZSA9IGNyZWF0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZSgncHJvZHVjdHMnKTtcbiAgICBjcmVhdG9yT3duUHJvZHVjdHNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFByb2R1Y3RzRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG4gICAgY3JlYXRvck93blByb2R1Y3RzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY3JlYXRlUHJvZHVjdEZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gUFVUIC9hcGkvY3JlYXRvci9wcm9kdWN0cy97aWR9XG4gICAgLy8gREVMRVRFIC9hcGkvY3JlYXRvci9wcm9kdWN0cy97aWR9XG4gICAgY29uc3QgY3JlYXRvclByb2R1Y3RSZXNvdXJjZSA9IGNyZWF0b3JPd25Qcm9kdWN0c1Jlc291cmNlLmFkZFJlc291cmNlKCd7aWR9Jyk7XG4gICAgY3JlYXRvclByb2R1Y3RSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUFVUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVwZGF0ZVByb2R1Y3RGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcbiAgICBjcmVhdG9yUHJvZHVjdFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdERUxFVEUnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZGVsZXRlUHJvZHVjdEZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR0VUIC9hcGkvY3JlYXRvci9hbmFseXRpY3NcbiAgICBjb25zdCBjcmVhdG9yQW5hbHl0aWNzUmVzb3VyY2UgPSBjcmVhdG9yUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FuYWx5dGljcycpO1xuICAgIGNyZWF0b3JBbmFseXRpY3NSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldENyZWF0b3JBbmFseXRpY3NGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnN0YXJ0RGF0ZSc6IGZhbHNlLFxuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5lbmREYXRlJzogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBBZG1pbiBDcmVhdG9yIE1hbmFnZW1lbnQgUm91dGVzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gR0VUIC9hcGkvYWRtaW4vY3JlYXRvcnNcbiAgICBjb25zdCBhZG1pbkNyZWF0b3JzUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdjcmVhdG9ycycpO1xuICAgIGFkbWluQ3JlYXRvcnNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxpc3RBbGxDcmVhdG9yc0Z1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gUE9TVCAvYXBpL2FkbWluL2NyZWF0b3JzIChmb3IgYWRtaW4gdG8gY3JlYXRlIGNyZWF0b3JzKVxuICAgIGFkbWluQ3JlYXRvcnNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUE9TVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVDcmVhdG9yRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBQVVQgL2FwaS9hZG1pbi9jcmVhdG9ycy97aWR9L3N0YXR1c1xuICAgIGNvbnN0IGFkbWluQ3JlYXRvcklkUmVzb3VyY2UgPSBhZG1pbkNyZWF0b3JzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICBjb25zdCBhZG1pbkNyZWF0b3JTdGF0dXNSZXNvdXJjZSA9IGFkbWluQ3JlYXRvcklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3N0YXR1cycpO1xuICAgIGFkbWluQ3JlYXRvclN0YXR1c1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQVVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXBkYXRlQ3JlYXRvclN0YXR1c0Z1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR0VUIC9hcGkvYWRtaW4vcHJvZHVjdHMvcGVuZGluZ1xuICAgIGNvbnN0IGFkbWluUGVuZGluZ1Jlc291cmNlID0gYWRtaW5Qcm9kdWN0c1Jlc291cmNlLmFkZFJlc291cmNlKCdwZW5kaW5nJyk7XG4gICAgYWRtaW5QZW5kaW5nUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRQZW5kaW5nUHJvZHVjdHNGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFBVVCAvYXBpL2FkbWluL3Byb2R1Y3RzL3tpZH0vYXBwcm92ZVxuICAgIGNvbnN0IGFkbWluUHJvZHVjdEFwcHJvdmVSZXNvdXJjZSA9IGFkbWluUHJvZHVjdFJlc291cmNlLmFkZFJlc291cmNlKCdhcHByb3ZlJyk7XG4gICAgYWRtaW5Qcm9kdWN0QXBwcm92ZVJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQVVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBwcm92ZVByb2R1Y3RGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFBVVCAvYXBpL2FkbWluL3Byb2R1Y3RzL3tpZH0vcmVqZWN0XG4gICAgY29uc3QgYWRtaW5Qcm9kdWN0UmVqZWN0UmVzb3VyY2UgPSBhZG1pblByb2R1Y3RSZXNvdXJjZS5hZGRSZXNvdXJjZSgncmVqZWN0Jyk7XG4gICAgYWRtaW5Qcm9kdWN0UmVqZWN0UmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BVVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihyZWplY3RQcm9kdWN0RnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQW5hbHl0aWNzIFRyYWNraW5nIFJvdXRlcyAoUHVibGljKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIFBPU1QgL2FwaS9hbmFseXRpY3MvcGFnZS12aWV3XG4gICAgY29uc3QgYW5hbHl0aWNzUmVzb3VyY2UgPSBhcGlSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYW5hbHl0aWNzJyk7XG4gICAgY29uc3QgcGFnZVZpZXdSZXNvdXJjZSA9IGFuYWx5dGljc1Jlc291cmNlLmFkZFJlc291cmNlKCdwYWdlLXZpZXcnKTtcbiAgICBwYWdlVmlld1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQT1NUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRyYWNrUGFnZVZpZXdGdW5jdGlvbilcbiAgICApO1xuXG4gICAgLy8gUE9TVCAvYXBpL2FuYWx5dGljcy9hZmZpbGlhdGUtY2xpY2tcbiAgICBjb25zdCBhZmZpbGlhdGVDbGlja1Jlc291cmNlID0gYW5hbHl0aWNzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FmZmlsaWF0ZS1jbGljaycpO1xuICAgIGFmZmlsaWF0ZUNsaWNrUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odHJhY2tBZmZpbGlhdGVDbGlja0Z1bmN0aW9uKVxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUmF0ZSBMaW1pdGluZyBDb25maWd1cmF0aW9uXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gQ3JlYXRlIFVzYWdlIFBsYW5zIGZvciBkaWZmZXJlbnQgdXNlciB0eXBlc1xuICAgIC8vIFJlcXVpcmVtZW50czogUGVyZm9ybWFuY2UgYW5kIHNlY3VyaXR5XG5cbiAgICAvLyBQdWJsaWMgVXNhZ2UgUGxhbiAtIDEwMCByZXF1ZXN0cyBwZXIgbWludXRlIHBlciBJUFxuICAgIGNvbnN0IHB1YmxpY1VzYWdlUGxhbiA9IHRoaXMuYXBpLmFkZFVzYWdlUGxhbignUHVibGljVXNhZ2VQbGFuJywge1xuICAgICAgbmFtZTogJ1B1YmxpYyBBUEkgVXNhZ2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdSYXRlIGxpbWl0aW5nIGZvciBwdWJsaWMgZW5kcG9pbnRzJyxcbiAgICAgIHRocm90dGxlOiB7XG4gICAgICAgIHJhdGVMaW1pdDogMTAwLCAvLyByZXF1ZXN0cyBwZXIgc2Vjb25kXG4gICAgICAgIGJ1cnN0TGltaXQ6IDIwMCwgLy8gbWF4aW11bSBjb25jdXJyZW50IHJlcXVlc3RzXG4gICAgICB9LFxuICAgICAgcXVvdGE6IHtcbiAgICAgICAgbGltaXQ6IDEwMDAwMCwgLy8gcmVxdWVzdHMgcGVyIG1vbnRoXG4gICAgICAgIHBlcmlvZDogYXBpZ2F0ZXdheS5QZXJpb2QuTU9OVEgsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQXNzb2NpYXRlIHB1YmxpYyB1c2FnZSBwbGFuIHdpdGggdGhlIEFQSSBzdGFnZVxuICAgIHB1YmxpY1VzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG4gICAgICBzdGFnZTogdGhpcy5hcGkuZGVwbG95bWVudFN0YWdlLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRvciBVc2FnZSBQbGFuIC0gMTAwMCByZXF1ZXN0cyBwZXIgbWludXRlIHBlciB1c2VyXG4gICAgY29uc3QgY3JlYXRvclVzYWdlUGxhbiA9IHRoaXMuYXBpLmFkZFVzYWdlUGxhbignQ3JlYXRvclVzYWdlUGxhbicsIHtcbiAgICAgIG5hbWU6ICdDcmVhdG9yIEFQSSBVc2FnZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JhdGUgbGltaXRpbmcgZm9yIGNyZWF0b3IgZW5kcG9pbnRzJyxcbiAgICAgIHRocm90dGxlOiB7XG4gICAgICAgIHJhdGVMaW1pdDogMTAwMCwgLy8gcmVxdWVzdHMgcGVyIHNlY29uZFxuICAgICAgICBidXJzdExpbWl0OiAyMDAwLCAvLyBtYXhpbXVtIGNvbmN1cnJlbnQgcmVxdWVzdHNcbiAgICAgIH0sXG4gICAgICBxdW90YToge1xuICAgICAgICBsaW1pdDogMTAwMDAwMCwgLy8gcmVxdWVzdHMgcGVyIG1vbnRoXG4gICAgICAgIHBlcmlvZDogYXBpZ2F0ZXdheS5QZXJpb2QuTU9OVEgsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY3JlYXRvclVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG4gICAgICBzdGFnZTogdGhpcy5hcGkuZGVwbG95bWVudFN0YWdlLFxuICAgIH0pO1xuXG4gICAgLy8gQWRtaW4gVXNhZ2UgUGxhbiAtIDEwMDAwIHJlcXVlc3RzIHBlciBtaW51dGUgcGVyIHVzZXJcbiAgICBjb25zdCBhZG1pblVzYWdlUGxhbiA9IHRoaXMuYXBpLmFkZFVzYWdlUGxhbignQWRtaW5Vc2FnZVBsYW4nLCB7XG4gICAgICBuYW1lOiAnQWRtaW4gQVBJIFVzYWdlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmF0ZSBsaW1pdGluZyBmb3IgYWRtaW4gZW5kcG9pbnRzJyxcbiAgICAgIHRocm90dGxlOiB7XG4gICAgICAgIHJhdGVMaW1pdDogMTAwMDAsIC8vIHJlcXVlc3RzIHBlciBzZWNvbmRcbiAgICAgICAgYnVyc3RMaW1pdDogMjAwMDAsIC8vIG1heGltdW0gY29uY3VycmVudCByZXF1ZXN0c1xuICAgICAgfSxcbiAgICAgIHF1b3RhOiB7XG4gICAgICAgIGxpbWl0OiAxMDAwMDAwMCwgLy8gcmVxdWVzdHMgcGVyIG1vbnRoXG4gICAgICAgIHBlcmlvZDogYXBpZ2F0ZXdheS5QZXJpb2QuTU9OVEgsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgYWRtaW5Vc2FnZVBsYW4uYWRkQXBpU3RhZ2Uoe1xuICAgICAgc3RhZ2U6IHRoaXMuYXBpLmRlcGxveW1lbnRTdGFnZSxcbiAgICB9KTtcblxuICAgIC8vIENvbmZpZ3VyZSBtZXRob2QtbGV2ZWwgdGhyb3R0bGluZyBmb3Igc3BlY2lmaWMgZW5kcG9pbnRzXG4gICAgLy8gVGhpcyBwcm92aWRlcyBtb3JlIGdyYW51bGFyIGNvbnRyb2wgb3ZlciByYXRlIGxpbWl0c1xuXG4gICAgLy8gUHVibGljIGVuZHBvaW50cyAtIDEwMCByZXEvbWluXG4gICAgY29uc3QgcHVibGljVGhyb3R0bGUgPSB7XG4gICAgICB0aHJvdHRsZToge1xuICAgICAgICByYXRlTGltaXQ6IDEwMCxcbiAgICAgICAgYnVyc3RMaW1pdDogMjAwLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8gQ3JlYXRvciBlbmRwb2ludHMgLSAxMDAwIHJlcS9taW5cbiAgICBjb25zdCBjcmVhdG9yVGhyb3R0bGUgPSB7XG4gICAgICB0aHJvdHRsZToge1xuICAgICAgICByYXRlTGltaXQ6IDEwMDAsXG4gICAgICAgIGJ1cnN0TGltaXQ6IDIwMDAsXG4gICAgICB9LFxuICAgIH07XG5cbiAgICAvLyBBZG1pbiBlbmRwb2ludHMgLSAxMDAwMCByZXEvbWluXG4gICAgY29uc3QgYWRtaW5UaHJvdHRsZSA9IHtcbiAgICAgIHRocm90dGxlOiB7XG4gICAgICAgIHJhdGVMaW1pdDogMTAwMDAsXG4gICAgICAgIGJ1cnN0TGltaXQ6IDIwMDAwLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8gTm90ZTogTWV0aG9kLWxldmVsIHRocm90dGxpbmcgaXMgYXBwbGllZCB0aHJvdWdoIHRoZSBkZXBsb3ltZW50IHN0YWdlIHNldHRpbmdzXG4gICAgLy8gVGhlIHVzYWdlIHBsYW5zIGFib3ZlIHByb3ZpZGUgYWNjb3VudC1sZXZlbCB0aHJvdHRsaW5nXG4gICAgLy8gRm9yIElQLWJhc2VkIHRocm90dGxpbmcgb24gcHVibGljIGVuZHBvaW50cywgQVdTIFdBRiB3b3VsZCBiZSByZXF1aXJlZFxuXG4gICAgLy8gT3V0cHV0IHVzYWdlIHBsYW4gSURzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1B1YmxpY1VzYWdlUGxhbklkJywge1xuICAgICAgdmFsdWU6IHB1YmxpY1VzYWdlUGxhbi51c2FnZVBsYW5JZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHVibGljIEFQSSBVc2FnZSBQbGFuIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDcmVhdG9yVXNhZ2VQbGFuSWQnLCB7XG4gICAgICB2YWx1ZTogY3JlYXRvclVzYWdlUGxhbi51c2FnZVBsYW5JZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRvciBBUEkgVXNhZ2UgUGxhbiBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWRtaW5Vc2FnZVBsYW5JZCcsIHtcbiAgICAgIHZhbHVlOiBhZG1pblVzYWdlUGxhbi51c2FnZVBsYW5JZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW4gQVBJIFVzYWdlIFBsYW4gSUQnLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggRGFzaGJvYXJkIGZvciBQcmljZSBTeW5jIE1vbml0b3JpbmdcbiAgICAvLyBSZXF1aXJlbWVudCA4LjM6IENyZWF0ZSBDbG91ZFdhdGNoIGRhc2hib2FyZCBmb3IgcHJpY2Ugc3luYyBtb25pdG9yaW5nXG4gICAgY29uc3QgcHJpY2VTeW5jRGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdQcmljZVN5bmNEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiAnUGludGVyZXN0QWZmaWxpYXRlLVByaWNlU3luYycsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgd2lkZ2V0cyB0byB0aGUgZGFzaGJvYXJkXG4gICAgcHJpY2VTeW5jRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAvLyBTdWNjZXNzIGFuZCBGYWlsdXJlIENvdW50c1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1ByaWNlIFN5bmMgLSBTdWNjZXNzIHZzIEZhaWx1cmUnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnU3VjY2Vzc0NvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBsYWJlbDogJ1N1Y2Nlc3NmdWwgVXBkYXRlcycsXG4gICAgICAgICAgICBjb2xvcjogY2xvdWR3YXRjaC5Db2xvci5HUkVFTixcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdGYWlsdXJlQ291bnQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIGxhYmVsOiAnRmFpbGVkIFVwZGF0ZXMnLFxuICAgICAgICAgICAgY29sb3I6IGNsb3Vkd2F0Y2guQ29sb3IuUkVELFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgLy8gU3VjY2VzcyBSYXRlXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUHJpY2UgU3luYyAtIFN1Y2Nlc3MgUmF0ZScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdTdWNjZXNzUmF0ZScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgIGxhYmVsOiAnU3VjY2VzcyBSYXRlICglKScsXG4gICAgICAgICAgICBjb2xvcjogY2xvdWR3YXRjaC5Db2xvci5CTFVFLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgICAgbWluOiAwLFxuICAgICAgICAgIG1heDogMTAwLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgcHJpY2VTeW5jRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAvLyBFeGVjdXRpb24gRHVyYXRpb25cbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdQcmljZSBTeW5jIC0gRXhlY3V0aW9uIER1cmF0aW9uJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0R1cmF0aW9uJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgICAgbGFiZWw6ICdBdmcgRHVyYXRpb24gKG1zKScsXG4gICAgICAgICAgICBjb2xvcjogY2xvdWR3YXRjaC5Db2xvci5QVVJQTEUsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnRHVyYXRpb24nLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICAgICAgICBsYWJlbDogJ01heCBEdXJhdGlvbiAobXMpJyxcbiAgICAgICAgICAgIGNvbG9yOiBjbG91ZHdhdGNoLkNvbG9yLk9SQU5HRSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIC8vIFByb2R1Y3RzIFByb2Nlc3NlZFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1ByaWNlIFN5bmMgLSBQcm9kdWN0cyBQcm9jZXNzZWQnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnVG90YWxQcm9kdWN0cycsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgbGFiZWw6ICdUb3RhbCBQcm9kdWN0cycsXG4gICAgICAgICAgICBjb2xvcjogY2xvdWR3YXRjaC5Db2xvci5HUkVZLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1Byb2Nlc3NlZENvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBsYWJlbDogJ1Byb2Nlc3NlZCAod2l0aCBBU0lOKScsXG4gICAgICAgICAgICBjb2xvcjogY2xvdWR3YXRjaC5Db2xvci5CTFVFLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1NraXBwZWRDb3VudCcsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgbGFiZWw6ICdTa2lwcGVkIChubyBBU0lOKScsXG4gICAgICAgICAgICBjb2xvcjogY2xvdWR3YXRjaC5Db2xvci5CUk9XTixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBSZXF1aXJlbWVudCA4LjQ6IFNldCB1cCBhbGFybXMgZm9yIGhpZ2ggZmFpbHVyZSByYXRlc1xuICAgIGNvbnN0IGhpZ2hGYWlsdXJlUmF0ZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0hpZ2hGYWlsdXJlUmF0ZUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAnUHJpY2VTeW5jLUhpZ2hGYWlsdXJlUmF0ZScsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxlcnQgd2hlbiBwcmljZSBzeW5jIGZhaWx1cmUgcmF0ZSBleGNlZWRzIDUwJScsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdGYWlsdXJlUmF0ZScsXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDUwLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBTTlMgYWN0aW9uIHRvIHRoZSBhbGFybVxuICAgIGhpZ2hGYWlsdXJlUmF0ZUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5wcmljZVN5bmNBbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyBSZXF1aXJlbWVudCA4LjQ6IFNldCB1cCBhbGFybXMgZm9yIGF1dGhlbnRpY2F0aW9uIGVycm9yc1xuICAgIC8vIFRoaXMgYWxhcm0gbW9uaXRvcnMgQ2xvdWRXYXRjaCBMb2dzIGZvciBhdXRoZW50aWNhdGlvbiBlcnJvcnNcbiAgICBjb25zdCBhdXRoRXJyb3JNZXRyaWNGaWx0ZXIgPSBuZXcgbG9ncy5NZXRyaWNGaWx0ZXIodGhpcywgJ0F1dGhFcnJvck1ldHJpY0ZpbHRlcicsIHtcbiAgICAgIGxvZ0dyb3VwOiBwcmljZVN5bmNMb2dHcm91cCxcbiAgICAgIG1ldHJpY05hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICBtZXRyaWNOYW1lOiAnQXV0aGVudGljYXRpb25FcnJvcnMnLFxuICAgICAgZmlsdGVyUGF0dGVybjogbG9ncy5GaWx0ZXJQYXR0ZXJuLmFueVRlcm0oJzQwMScsICdVbmF1dGhvcml6ZWQnLCAnSW52YWxpZFNpZ25hdHVyZScsICdTaWduYXR1cmVEb2VzTm90TWF0Y2gnKSxcbiAgICAgIG1ldHJpY1ZhbHVlOiAnMScsXG4gICAgICBkZWZhdWx0VmFsdWU6IDAsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhdXRoRXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdBdXRoRXJyb3JBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ1ByaWNlU3luYy1BdXRoZW50aWNhdGlvbkVycm9yJyxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIFBBLUFQSSBhdXRoZW50aWNhdGlvbiBlcnJvcnMgb2NjdXInLFxuICAgICAgbWV0cmljOiBhdXRoRXJyb3JNZXRyaWNGaWx0ZXIubWV0cmljKHtcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIGF1dGhFcnJvckFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5wcmljZVN5bmNBbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyBBbGFybSBmb3IgZXhlY3V0aW9uIGR1cmF0aW9uIGV4Y2VlZGluZyA1IG1pbnV0ZXNcbiAgICBjb25zdCBsb25nRXhlY3V0aW9uQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnTG9uZ0V4ZWN1dGlvbkFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAnUHJpY2VTeW5jLUxvbmdFeGVjdXRpb24nLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FsZXJ0IHdoZW4gcHJpY2Ugc3luYyBleGVjdXRpb24gZXhjZWVkcyA1IG1pbnV0ZXMnLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnRHVyYXRpb24nLFxuICAgICAgICBzdGF0aXN0aWM6ICdNYXhpbXVtJyxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAzMDAwMDAsIC8vIDUgbWludXRlcyBpbiBtaWxsaXNlY29uZHNcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICBsb25nRXhlY3V0aW9uQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLnByaWNlU3luY0FsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIC8vIE91dHB1dCBBUEkgR2F0ZXdheSBVUkxcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdBcGlHYXRld2F5VXJsJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS5yZXN0QXBpSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IElEJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdBcGlHYXRld2F5SWQnLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IFNOUyB0b3BpYyBBUk4gZm9yIHByaWNlIHN5bmMgYWxlcnRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ByaWNlU3luY0FsZXJ0VG9waWNBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wcmljZVN5bmNBbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTTlMgVG9waWMgQVJOIGZvciBQcmljZSBTeW5jIEFsZXJ0cycsXG4gICAgICBleHBvcnROYW1lOiAnUHJpY2VTeW5jQWxlcnRUb3BpY0FybicsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgUGFyYW1ldGVyIFN0b3JlIHBhcmFtZXRlciBuYW1lc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQQUFQSVBhcmFtZXRlcnNQcmVmaXgnLCB7XG4gICAgICB2YWx1ZTogJy9hbWF6b24tYWZmaWxpYXRlL3BhLWFwaS8nLFxuICAgICAgZGVzY3JpcHRpb246ICdQYXJhbWV0ZXIgU3RvcmUgcHJlZml4IGZvciBQQS1BUEkgY3JlZGVudGlhbHMnLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IENsb3VkV2F0Y2ggRGFzaGJvYXJkIFVSTFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcmljZVN5bmNEYXNoYm9hcmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT0ke3ByaWNlU3luY0Rhc2hib2FyZC5kYXNoYm9hcmROYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkV2F0Y2ggRGFzaGJvYXJkIFVSTCBmb3IgUHJpY2UgU3luYyBNb25pdG9yaW5nJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBBbGFybSBBUk5zXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0hpZ2hGYWlsdXJlUmF0ZUFsYXJtQXJuJywge1xuICAgICAgdmFsdWU6IGhpZ2hGYWlsdXJlUmF0ZUFsYXJtLmFsYXJtQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdIaWdoIEZhaWx1cmUgUmF0ZSBBbGFybSBBUk4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F1dGhFcnJvckFsYXJtQXJuJywge1xuICAgICAgdmFsdWU6IGF1dGhFcnJvckFsYXJtLmFsYXJtQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBdXRoZW50aWNhdGlvbiBFcnJvciBBbGFybSBBUk4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xvbmdFeGVjdXRpb25BbGFybUFybicsIHtcbiAgICAgIHZhbHVlOiBsb25nRXhlY3V0aW9uQWxhcm0uYWxhcm1Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xvbmcgRXhlY3V0aW9uIEFsYXJtIEFSTicsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgUHJpY2UgU3luYyBMYW1iZGEgZGV0YWlsc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcmljZVN5bmNMYW1iZGFBcm4nLCB7XG4gICAgICB2YWx1ZTogc3luY0FtYXpvblByaWNlc0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdQcmljZSBTeW5jIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogJ1ByaWNlU3luY0xhbWJkYUFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJpY2VTeW5jTGFtYmRhTmFtZScsIHtcbiAgICAgIHZhbHVlOiBzeW5jQW1hem9uUHJpY2VzRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQcmljZSBTeW5jIExhbWJkYSBGdW5jdGlvbiBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdQcmljZVN5bmNMYW1iZGFOYW1lJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBFdmVudEJyaWRnZSBydWxlIGRldGFpbHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJpY2VTeW5jUnVsZUFybicsIHtcbiAgICAgIHZhbHVlOiBwcmljZVN5bmNSdWxlLnJ1bGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0V2ZW50QnJpZGdlIFJ1bGUgQVJOIGZvciBQcmljZSBTeW5jJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdQcmljZVN5bmNSdWxlQXJuJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcmljZVN5bmNSdWxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBwcmljZVN5bmNSdWxlLnJ1bGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdFdmVudEJyaWRnZSBSdWxlIE5hbWUgZm9yIFByaWNlIFN5bmMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ByaWNlU3luY1NjaGVkdWxlJywge1xuICAgICAgdmFsdWU6ICdEYWlseSBhdCAyOjAwIEFNIFVUQyAoY3JvbjogMCAyICogKiA/ICopJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJpY2UgU3luYyBTY2hlZHVsZScsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgTWFudWFsIFRyaWdnZXIgTGFtYmRhIGRldGFpbHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVHJpZ2dlclByaWNlU3luY0xhbWJkYUFybicsIHtcbiAgICAgIHZhbHVlOiB0cmlnZ2VyUHJpY2VTeW5jRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ01hbnVhbCBQcmljZSBTeW5jIFRyaWdnZXIgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXG4gICAgICBleHBvcnROYW1lOiAnVHJpZ2dlclByaWNlU3luY0xhbWJkYUFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVHJpZ2dlclByaWNlU3luY0xhbWJkYU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdHJpZ2dlclByaWNlU3luY0Z1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWFudWFsIFByaWNlIFN5bmMgVHJpZ2dlciBMYW1iZGEgRnVuY3Rpb24gTmFtZScsXG4gICAgICBleHBvcnROYW1lOiAnVHJpZ2dlclByaWNlU3luY0xhbWJkYU5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ01hbnVhbFN5bmNFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiBgJHt0aGlzLmFwaS51cmx9YXBpL2FkbWluL3N5bmMtcHJpY2VzYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWFudWFsIFByaWNlIFN5bmMgQVBJIEVuZHBvaW50IChQT1NUKScsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==