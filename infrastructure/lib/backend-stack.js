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
        const { productsTable, imagesBucket, userPool } = props;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2VuZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhY2tlbmQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFHekQseURBQTJDO0FBQzNDLDJEQUE2QztBQUU3Qyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLHVFQUF5RDtBQUN6RCx1RkFBeUU7QUFDekUsK0RBQWlEO0FBQ2pELCtFQUFpRTtBQUVqRSwyQ0FBNkI7QUFRN0IsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFJekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFeEQseUNBQXlDO1FBQ3pDLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ3BFLFNBQVMsRUFBRSx1Q0FBdUM7WUFDbEQsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7UUFFSCwyREFBMkQ7UUFDM0QsMkZBQTJGO1FBQzNGLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDOUMsYUFBYSxFQUFFLHFDQUFxQztZQUNwRCxXQUFXLEVBQUUsd0JBQXdCO1lBQ3JDLFdBQVcsRUFBRSwyQ0FBMkM7WUFDeEQsSUFBSSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUTtTQUNqQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzlDLGFB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QUMsU0FBUyxDQUFDLElBQUksRUFBRSw0QkFBNEIsRUFBRTtZQUNwRCxLQUFLLEVBQUUsd0JBQXdCLENBQUMsWUFBWTtZQUM1QyxXQUFXLEVBQUUsZ0RBQWdEO1lBQzdELFVBQVUsRUFBRSw0QkFBNEI7U0FDekMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsdUJBQXVCO1lBQzdDLFdBQVcsRUFBRSx1Q0FBdUM7U0FDckQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBaHpCRCxvQ0FnekJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoX2FjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyBldmVudHNfdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5pbnRlcmZhY2UgQmFja2VuZFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHByb2R1Y3RzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBpbWFnZXNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG59XG5cbmV4cG9ydCBjbGFzcyBCYWNrZW5kU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBwcmljZVN5bmNBbGVydFRvcGljOiBzbnMuVG9waWM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJhY2tlbmRTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHByb2R1Y3RzVGFibGUsIGltYWdlc0J1Y2tldCwgdXNlclBvb2wgfSA9IHByb3BzO1xuXG4gICAgLy8gQ3JlYXRlIFNOUyB0b3BpYyBmb3IgcHJpY2Ugc3luYyBhbGVydHNcbiAgICB0aGlzLnByaWNlU3luY0FsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdQcmljZVN5bmNBbGVydFRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1wcmljZS1zeW5jLWFsZXJ0cycsXG4gICAgICBkaXNwbGF5TmFtZTogJ0FtYXpvbiBQcmljZSBTeW5jIEFsZXJ0cycsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgUGFyYW1ldGVyIFN0b3JlIHBhcmFtZXRlcnMgZm9yIFBBLUFQSSBjcmVkZW50aWFsc1xuICAgIC8vIE5vdGU6IFRoZXNlIGFyZSBwbGFjZWhvbGRlcnMgLSBhY3R1YWwgdmFsdWVzIG11c3QgYmUgc2V0IG1hbnVhbGx5IHZpYSBBV1MgQ29uc29sZSBvciBDTElcbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnUEFBUElBY2Nlc3NLZXknLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnL2FtYXpvbi1hZmZpbGlhdGUvcGEtYXBpL2FjY2Vzcy1rZXknLFxuICAgICAgc3RyaW5nVmFsdWU6ICdQTEFDRUhPTERFUl9BQ0NFU1NfS0VZJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW1hem9uIFByb2R1Y3QgQWR2ZXJ0aXNpbmcgQVBJIEFjY2VzcyBLZXknLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnUEFBUElTZWNyZXRLZXknLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnL2FtYXpvbi1hZmZpbGlhdGUvcGEtYXBpL3NlY3JldC1rZXknLFxuICAgICAgc3RyaW5nVmFsdWU6ICdQTEFDRUhPTERFUl9TRUNSRVRfS0VZJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW1hem9uIFByb2R1Y3QgQWR2ZXJ0aXNpbmcgQVBJIFNlY3JldCBLZXknLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnUEFBUElQYXJ0bmVyVGFnJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogJy9hbWF6b24tYWZmaWxpYXRlL3BhLWFwaS9wYXJ0bmVyLXRhZycsXG4gICAgICBzdHJpbmdWYWx1ZTogJ1BMQUNFSE9MREVSX1BBUlRORVJfVEFHJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW1hem9uIEFzc29jaWF0ZXMgUGFydG5lciBUYWcnLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnUEFBUElNYXJrZXRwbGFjZScsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICcvYW1hem9uLWFmZmlsaWF0ZS9wYS1hcGkvbWFya2V0cGxhY2UnLFxuICAgICAgc3RyaW5nVmFsdWU6ICd3d3cuYW1hem9uLmNvbScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FtYXpvbiBNYXJrZXRwbGFjZSAoZGVmYXVsdDogVVMpJyxcbiAgICAgIHRpZXI6IHNzbS5QYXJhbWV0ZXJUaWVyLlNUQU5EQVJELFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIElBTSByb2xlIGZvciBMYW1iZGEgZnVuY3Rpb25zXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zXG4gICAgcHJvZHVjdHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG5cbiAgICAvLyBHcmFudCBTMyBwZXJtaXNzaW9uc1xuICAgIGltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZShsYW1iZGFSb2xlKTtcblxuICAgIC8vIEdyYW50IENvZ25pdG8gcGVybWlzc2lvbnMgZm9yIHVzZXIgbWFuYWdlbWVudFxuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkNyZWF0ZVVzZXInLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkRlbGV0ZVVzZXInLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkdldFVzZXInLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pblVwZGF0ZVVzZXJBdHRyaWJ1dGVzJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5TZXRVc2VyUGFzc3dvcmQnLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkFkZFVzZXJUb0dyb3VwJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5SZW1vdmVVc2VyRnJvbUdyb3VwJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5MaXN0R3JvdXBzRm9yVXNlcicsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkxpc3RVc2VycycsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkxpc3RVc2Vyc0luR3JvdXAnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFt1c2VyUG9vbC51c2VyUG9vbEFybl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBTRVMgcGVybWlzc2lvbnMgZm9yIHNlbmRpbmcgZW1haWxzXG4gICAgbGFtYmRhUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3NlczpTZW5kRW1haWwnLFxuICAgICAgICAgICdzZXM6U2VuZFJhd0VtYWlsJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8gU0VTIHJlcXVpcmVzICogZm9yIGVtYWlsIHNlbmRpbmdcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IFBhcmFtZXRlciBTdG9yZSBwZXJtaXNzaW9ucyBmb3IgUEEtQVBJIGNyZWRlbnRpYWxzXG4gICAgbGFtYmRhUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXInLFxuICAgICAgICAgICdzc206R2V0UGFyYW1ldGVycycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOnNzbToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06cGFyYW1ldGVyL2FtYXpvbi1hZmZpbGlhdGUvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBTTlMgcGVybWlzc2lvbnMgZm9yIHByaWNlIHN5bmMgYWxlcnRzXG4gICAgdGhpcy5wcmljZVN5bmNBbGVydFRvcGljLmdyYW50UHVibGlzaChsYW1iZGFSb2xlKTtcblxuICAgIC8vIEdyYW50IENsb3VkV2F0Y2ggcGVybWlzc2lvbnMgZm9yIGN1c3RvbSBtZXRyaWNzXG4gICAgbGFtYmRhUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2Nsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YScsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sIC8vIENsb3VkV2F0Y2ggbWV0cmljcyByZXF1aXJlICogcmVzb3VyY2VcbiAgICAgIH0pXG4gICAgKTtcblxuXG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgIGNvbnN0IGNvbW1vbkVudmlyb25tZW50ID0ge1xuICAgICAgUFJPRFVDVFNfVEFCTEVfTkFNRTogcHJvZHVjdHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBJTUFHRVNfQlVDS0VUX05BTUU6IGltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICB9O1xuXG4gICAgLy8gQ29tbW9uIExhbWJkYSBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgbGFtYmRhQ29uZmlnID0ge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgIH07XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9ucyAtIHVzaW5nIGNvbXBpbGVkIGRpc3QgZm9sZGVyXG4gICAgY29uc3QgZ2V0UHJvZHVjdHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldFByb2R1Y3RzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWdldFByb2R1Y3RzJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9nZXRQcm9kdWN0cy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IGFsbCBwcm9kdWN0cyB3aXRoIG9wdGlvbmFsIGNhdGVnb3J5IGZpbHRlcmluZycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRQcm9kdWN0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRQcm9kdWN0RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWdldFByb2R1Y3QnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2dldFByb2R1Y3QvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBhIHNpbmdsZSBwcm9kdWN0IGJ5IElEJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNyZWF0ZVByb2R1Y3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NyZWF0ZVByb2R1Y3RGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtY3JlYXRlUHJvZHVjdCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvY3JlYXRlUHJvZHVjdC9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIGEgbmV3IHByb2R1Y3QnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXBkYXRlUHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlUHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS11cGRhdGVQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy91cGRhdGVQcm9kdWN0L2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdVcGRhdGUgYW4gZXhpc3RpbmcgcHJvZHVjdCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkZWxldGVQcm9kdWN0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdEZWxldGVQcm9kdWN0RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWRlbGV0ZVByb2R1Y3QnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2RlbGV0ZVByb2R1Y3QvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RlbGV0ZSBhIHByb2R1Y3QnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXBsb2FkSW1hZ2VGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VwbG9hZEltYWdlRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLXVwbG9hZEltYWdlJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy91cGxvYWRJbWFnZS9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2VuZXJhdGUgcHJlc2lnbmVkIFVSTCBmb3IgaW1hZ2UgdXBsb2FkJyxcbiAgICB9KTtcblxuICAgIC8vIFVzZXIgTWFuYWdlbWVudCBMYW1iZGEgRnVuY3Rpb25zXG4gICAgY29uc3QgY3JlYXRlVXNlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ3JlYXRlVXNlckZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1jcmVhdGVVc2VyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9jcmVhdGVVc2VyL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGUgYSBuZXcgYWRtaW4gdXNlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBsaXN0VXNlcnNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xpc3RVc2Vyc0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1saXN0VXNlcnMnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2xpc3RVc2Vycy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdCBhbGwgdXNlcnMnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGVsZXRlVXNlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRGVsZXRlVXNlckZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1kZWxldGVVc2VyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9kZWxldGVVc2VyL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdEZWxldGUgYSB1c2VyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc2V0UGFzc3dvcmRGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Jlc2V0UGFzc3dvcmRGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtcmVzZXRQYXNzd29yZCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvcmVzZXRQYXNzd29yZC9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVzZXQgdXNlciBwYXNzd29yZCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhZG1pbkdldFByb2R1Y3RzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBZG1pbkdldFByb2R1Y3RzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWFkbWluR2V0UHJvZHVjdHMnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXG4gICAgICBoYW5kbGVyOiAnZnVuY3Rpb25zL2FkbWluR2V0UHJvZHVjdHMvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBhbGwgcHJvZHVjdHMgZm9yIGFkbWluIChpbmNsdWRpbmcgdW5wdWJsaXNoZWQpJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldENhdGVnb3JpZXNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldENhdGVnb3JpZXNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtZ2V0Q2F0ZWdvcmllcycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvZ2V0Q2F0ZWdvcmllcy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IGFsbCBwcm9kdWN0IGNhdGVnb3JpZXMnLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggTG9nIEdyb3VwIGZvciBQcmljZSBTeW5jIExhbWJkYVxuICAgIC8vIFJlcXVpcmVtZW50IDguNDogQWRkIENsb3VkV2F0Y2ggbG9nIGdyb3VwXG4gICAgY29uc3QgcHJpY2VTeW5jTG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnUHJpY2VTeW5jTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6ICcvYXdzL2xhbWJkYS9waW50ZXJlc3QtYWZmaWxpYXRlLXN5bmNBbWF6b25QcmljZXMnLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFByaWNlIFN5bmMgTGFtYmRhIEZ1bmN0aW9uXG4gICAgLy8gUmVxdWlyZW1lbnRzIDMuMSwgMy4yOiBTY2hlZHVsZWQgTGFtYmRhIGZvciBhdXRvbWF0aWMgcHJpY2Ugc3luY2hyb25pemF0aW9uXG4gICAgY29uc3Qgc3luY0FtYXpvblByaWNlc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3luY0FtYXpvblByaWNlc0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1zeW5jQW1hem9uUHJpY2VzJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgaGFuZGxlcjogJ2Z1bmN0aW9ucy9zeW5jQW1hem9uUHJpY2VzL2luZGV4LmhhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdTeW5jaHJvbml6ZSBwcm9kdWN0IHByaWNlcyB3aXRoIEFtYXpvbiBQQS1BUEknLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApLCAvLyBMb25nZXIgdGltZW91dCBmb3IgYmF0Y2ggcHJvY2Vzc2luZ1xuICAgICAgbWVtb3J5U2l6ZTogMTAyNCwgLy8gTW9yZSBtZW1vcnkgZm9yIHByb2Nlc3NpbmcgbXVsdGlwbGUgcHJvZHVjdHNcbiAgICAgIGxvZ0dyb3VwOiBwcmljZVN5bmNMb2dHcm91cCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxuICAgICAgICBTTlNfVE9QSUNfQVJOOiB0aGlzLnByaWNlU3luY0FsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIEV2ZW50QnJpZGdlIHJ1bGUgZm9yIHNjaGVkdWxlZCBleGVjdXRpb25cbiAgICAvLyBSZXF1aXJlbWVudCAzLjE6IFNjaGVkdWxlIHRvIHJ1biBkYWlseSBhdCAyIEFNIFVUQ1xuICAgIGNvbnN0IHByaWNlU3luY1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1ByaWNlU3luY1NjaGVkdWxlUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1wcmljZS1zeW5jLWRhaWx5JyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHJpZ2dlcnMgcHJpY2Ugc3luYyBMYW1iZGEgZGFpbHkgYXQgMiBBTSBVVEMnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICcyJyxcbiAgICAgICAgZGF5OiAnKicsXG4gICAgICAgIG1vbnRoOiAnKicsXG4gICAgICAgIHllYXI6ICcqJyxcbiAgICAgIH0pLFxuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBMYW1iZGEgYXMgdGFyZ2V0IHdpdGggcmV0cnkgcG9saWN5XG4gICAgLy8gUmVxdWlyZW1lbnQgMy4yOiBDb25maWd1cmUgcmV0cnkgcG9saWN5ICgyIHJldHJpZXMgd2l0aCBleHBvbmVudGlhbCBiYWNrb2ZmKVxuICAgIHByaWNlU3luY1J1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IGV2ZW50c190YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHN5bmNBbWF6b25QcmljZXNGdW5jdGlvbiwge1xuICAgICAgICByZXRyeUF0dGVtcHRzOiAyLFxuICAgICAgICBtYXhFdmVudEFnZTogY2RrLkR1cmF0aW9uLmhvdXJzKDIpLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgRXZlbnRCcmlkZ2UgcGVybWlzc2lvbiB0byBpbnZva2UgdGhlIExhbWJkYVxuICAgIHN5bmNBbWF6b25QcmljZXNGdW5jdGlvbi5ncmFudEludm9rZShuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2V2ZW50cy5hbWF6b25hd3MuY29tJykpO1xuXG4gICAgLy8gQ3JlYXRlIE1hbnVhbCBQcmljZSBTeW5jIFRyaWdnZXIgTGFtYmRhIEZ1bmN0aW9uXG4gICAgLy8gUmVxdWlyZW1lbnQgMy40OiBNYW51YWwgc3luYyB0cmlnZ2VyIGVuZHBvaW50IGZvciBhZG1pbmlzdHJhdG9yc1xuICAgIGNvbnN0IHRyaWdnZXJQcmljZVN5bmNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1RyaWdnZXJQcmljZVN5bmNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtdHJpZ2dlclByaWNlU3luYycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvdHJpZ2dlclByaWNlU3luYy9pbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWFudWFsbHkgdHJpZ2dlciBwcmljZSBzeW5jIHdpdGggQW1hem9uIFBBLUFQSScsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcbiAgICAgICAgUFJJQ0VfU1lOQ19MQU1CREFfTkFNRTogc3luY0FtYXpvblByaWNlc0Z1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9uIHRvIGludm9rZSB0aGUgcHJpY2Ugc3luYyBMYW1iZGFcbiAgICAvLyBOb3RlOiBEdWUgdG8gY2lyY3VsYXIgZGVwZW5kZW5jeSB3aXRoIHNoYXJlZCBMYW1iZGEgcm9sZSwgdGhpcyBwZXJtaXNzaW9uXG4gICAgLy8gaXMgYWRkZWQgbWFudWFsbHkgdmlhIEFXUyBDTEkgYWZ0ZXIgZGVwbG95bWVudFxuICAgIC8vIENvbW1hbmQ6IGF3cyBpYW0gcHV0LXJvbGUtcG9saWN5IC0tcm9sZS1uYW1lIDxMYW1iZGFFeGVjdXRpb25Sb2xlPiAtLXBvbGljeS1uYW1lIEludm9rZVByaWNlU3luY0xhbWJkYSAtLXBvbGljeS1kb2N1bWVudCAne1wiVmVyc2lvblwiOlwiMjAxMi0xMC0xN1wiLFwiU3RhdGVtZW50XCI6W3tcIkVmZmVjdFwiOlwiQWxsb3dcIixcIkFjdGlvblwiOlwibGFtYmRhOkludm9rZUZ1bmN0aW9uXCIsXCJSZXNvdXJjZVwiOlwiYXJuOmF3czpsYW1iZGE6UkVHSU9OOkFDQ09VTlQ6ZnVuY3Rpb246cGludGVyZXN0LWFmZmlsaWF0ZS1zeW5jQW1hem9uUHJpY2VzXCJ9XX0nXG5cbiAgICAvLyBDcmVhdGUgR2V0IFN5bmMgSGlzdG9yeSBMYW1iZGEgRnVuY3Rpb25cbiAgICAvLyBSZXF1aXJlbWVudCA2LjQ6IERpc3BsYXkgc3luYyBleGVjdXRpb24gbG9ncyBpbiBhZG1pbiBwYW5lbFxuICAgIGNvbnN0IGdldFN5bmNIaXN0b3J5RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRTeW5jSGlzdG9yeUZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1nZXRTeW5jSGlzdG9yeScsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdmdW5jdGlvbnMvZ2V0U3luY0hpc3RvcnkvaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JldHJpZXZlIHByaWNlIHN5bmMgZXhlY3V0aW9uIGhpc3RvcnkgZnJvbSBDbG91ZFdhdGNoIExvZ3MnLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgQ2xvdWRXYXRjaCBMb2dzIHJlYWQgcGVybWlzc2lvbnNcbiAgICBnZXRTeW5jSGlzdG9yeUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2xvZ3M6RmlsdGVyTG9nRXZlbnRzJyxcbiAgICAgICAgICAnbG9nczpEZXNjcmliZUxvZ1N0cmVhbXMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpsb2dzOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpsb2ctZ3JvdXA6L2F3cy9sYW1iZGEvc3luY0FtYXpvblByaWNlczoqYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBDb2duaXRvIEF1dGhvcml6ZXIgZm9yIEFQSSBHYXRld2F5XG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvQXV0aG9yaXplcicsIHtcbiAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFt1c2VyUG9vbF0sXG4gICAgICBhdXRob3JpemVyTmFtZTogJ0FkbWluQXV0aG9yaXplcicsXG4gICAgICBpZGVudGl0eVNvdXJjZTogJ21ldGhvZC5yZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uJyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBBUEkgR2F0ZXdheVxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnUGludGVyZXN0QWZmaWxpYXRlQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6ICdQaW50ZXJlc3QgQWZmaWxpYXRlIEFQSScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBmb3IgUGludGVyZXN0IEFmZmlsaWF0ZSBQbGF0Zm9ybScsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAvLyBEaXNhYmxlIGNhY2hpbmcgYnkgZGVmYXVsdCAod2lsbCBlbmFibGUgb25seSBmb3IgcHVibGljIGVuZHBvaW50cylcbiAgICAgICAgY2FjaGluZ0VuYWJsZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICdYLUFtei1EYXRlJyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQVBJIHJlc291cmNlcyBhbmQgbWV0aG9kc1xuICAgIGNvbnN0IGFwaVJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnYXBpJyk7XG5cbiAgICAvLyBQdWJsaWMgZW5kcG9pbnRzIHdpdGggY2FjaGluZ1xuICAgIGNvbnN0IHByb2R1Y3RzUmVzb3VyY2UgPSBhcGlSZXNvdXJjZS5hZGRSZXNvdXJjZSgncHJvZHVjdHMnKTtcbiAgICBwcm9kdWN0c1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZHVjdHNGdW5jdGlvbiwge1xuICAgICAgICBjYWNoZUtleVBhcmFtZXRlcnM6IFsnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuY2F0ZWdvcnknXSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5jYXRlZ29yeSc6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5DYWNoZS1Db250cm9sJzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgcHJvZHVjdFJlc291cmNlID0gcHJvZHVjdHNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xuICAgIHByb2R1Y3RSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFByb2R1Y3RGdW5jdGlvbiwge1xuICAgICAgICBjYWNoZUtleVBhcmFtZXRlcnM6IFsnbWV0aG9kLnJlcXVlc3QucGF0aC5pZCddLFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGguaWQnOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5DYWNoZS1Db250cm9sJzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ2F0ZWdvcmllcyBlbmRwb2ludFxuICAgIGNvbnN0IGNhdGVnb3JpZXNSZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFJlc291cmNlKCdjYXRlZ29yaWVzJyk7XG4gICAgY2F0ZWdvcmllc1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0Q2F0ZWdvcmllc0Z1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQ2FjaGUtQ29udHJvbCc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEFkbWluIGVuZHBvaW50cyAocHJvdGVjdGVkIGJ5IENvZ25pdG8pXG4gICAgY29uc3QgYWRtaW5SZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFJlc291cmNlKCdhZG1pbicpO1xuICAgIGNvbnN0IGFkbWluUHJvZHVjdHNSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Byb2R1Y3RzJyk7XG5cbiAgICAvLyBHRVQgYWxsIHByb2R1Y3RzIChhZG1pbiAtIGluY2x1ZGVzIHVucHVibGlzaGVkKVxuICAgIGFkbWluUHJvZHVjdHNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFkbWluR2V0UHJvZHVjdHNGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIGFkbWluUHJvZHVjdHNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUE9TVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVQcm9kdWN0RnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBhZG1pblByb2R1Y3RSZXNvdXJjZSA9IGFkbWluUHJvZHVjdHNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xuICAgIGFkbWluUHJvZHVjdFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQVVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXBkYXRlUHJvZHVjdEZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuICAgIGFkbWluUHJvZHVjdFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdERUxFVEUnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZGVsZXRlUHJvZHVjdEZ1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgdXBsb2FkSW1hZ2VSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3VwbG9hZC1pbWFnZScpO1xuICAgIHVwbG9hZEltYWdlUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXBsb2FkSW1hZ2VGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIFVzZXIgTWFuYWdlbWVudCBlbmRwb2ludHMgKHByb3RlY3RlZCBieSBDb2duaXRvKVxuICAgIGNvbnN0IHVzZXJzUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCd1c2VycycpO1xuICAgIHVzZXJzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsaXN0VXNlcnNGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcbiAgICB1c2Vyc1Jlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQT1NUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNyZWF0ZVVzZXJGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IHVzZXJSZXNvdXJjZSA9IHVzZXJzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3t1c2VybmFtZX0nKTtcbiAgICB1c2VyUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0RFTEVURScsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihkZWxldGVVc2VyRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCByZXNldFBhc3N3b3JkUmVzb3VyY2UgPSB1c2VyUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Jlc2V0LXBhc3N3b3JkJyk7XG4gICAgcmVzZXRQYXNzd29yZFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdQT1NUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHJlc2V0UGFzc3dvcmRGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIE1hbnVhbCBQcmljZSBTeW5jIFRyaWdnZXIgZW5kcG9pbnQgKHByb3RlY3RlZCBieSBDb2duaXRvKVxuICAgIC8vIFJlcXVpcmVtZW50IDMuNDogUE9TVCAvYWRtaW4vc3luYy1wcmljZXMgQVBJIGVuZHBvaW50XG4gICAgY29uc3Qgc3luY1ByaWNlc1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3luYy1wcmljZXMnKTtcbiAgICBzeW5jUHJpY2VzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odHJpZ2dlclByaWNlU3luY0Z1bmN0aW9uKSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gU3luYyBIaXN0b3J5IGVuZHBvaW50IChwcm90ZWN0ZWQgYnkgQ29nbml0bylcbiAgICAvLyBSZXF1aXJlbWVudCA2LjQ6IEdFVCAvYWRtaW4vc3luYy1oaXN0b3J5IEFQSSBlbmRwb2ludFxuICAgIGNvbnN0IHN5bmNIaXN0b3J5UmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdzeW5jLWhpc3RvcnknKTtcbiAgICBzeW5jSGlzdG9yeVJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0U3luY0hpc3RvcnlGdW5jdGlvbiksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZFdhdGNoIERhc2hib2FyZCBmb3IgUHJpY2UgU3luYyBNb25pdG9yaW5nXG4gICAgLy8gUmVxdWlyZW1lbnQgOC4zOiBDcmVhdGUgQ2xvdWRXYXRjaCBkYXNoYm9hcmQgZm9yIHByaWNlIHN5bmMgbW9uaXRvcmluZ1xuICAgIGNvbnN0IHByaWNlU3luY0Rhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnUHJpY2VTeW5jRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ1BpbnRlcmVzdEFmZmlsaWF0ZS1QcmljZVN5bmMnLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHdpZGdldHMgdG8gdGhlIGRhc2hib2FyZFxuICAgIHByaWNlU3luY0Rhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgLy8gU3VjY2VzcyBhbmQgRmFpbHVyZSBDb3VudHNcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdQcmljZSBTeW5jIC0gU3VjY2VzcyB2cyBGYWlsdXJlJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1N1Y2Nlc3NDb3VudCcsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgbGFiZWw6ICdTdWNjZXNzZnVsIFVwZGF0ZXMnLFxuICAgICAgICAgICAgY29sb3I6IGNsb3Vkd2F0Y2guQ29sb3IuR1JFRU4sXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnRmFpbHVyZUNvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBsYWJlbDogJ0ZhaWxlZCBVcGRhdGVzJyxcbiAgICAgICAgICAgIGNvbG9yOiBjbG91ZHdhdGNoLkNvbG9yLlJFRCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIC8vIFN1Y2Nlc3MgUmF0ZVxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1ByaWNlIFN5bmMgLSBTdWNjZXNzIFJhdGUnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1ByaWNlU3luYycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnU3VjY2Vzc1JhdGUnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgICBsYWJlbDogJ1N1Y2Nlc3MgUmF0ZSAoJSknLFxuICAgICAgICAgICAgY29sb3I6IGNsb3Vkd2F0Y2guQ29sb3IuQkxVRSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICAgIG1pbjogMCxcbiAgICAgICAgICBtYXg6IDEwMCxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHByaWNlU3luY0Rhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgLy8gRXhlY3V0aW9uIER1cmF0aW9uXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUHJpY2UgU3luYyAtIEV4ZWN1dGlvbiBEdXJhdGlvbicsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdEdXJhdGlvbicsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgIGxhYmVsOiAnQXZnIER1cmF0aW9uIChtcyknLFxuICAgICAgICAgICAgY29sb3I6IGNsb3Vkd2F0Y2guQ29sb3IuUFVSUExFLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0R1cmF0aW9uJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ01heGltdW0nLFxuICAgICAgICAgICAgbGFiZWw6ICdNYXggRHVyYXRpb24gKG1zKScsXG4gICAgICAgICAgICBjb2xvcjogY2xvdWR3YXRjaC5Db2xvci5PUkFOR0UsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICAvLyBQcm9kdWN0cyBQcm9jZXNzZWRcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdQcmljZSBTeW5jIC0gUHJvZHVjdHMgUHJvY2Vzc2VkJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1RvdGFsUHJvZHVjdHMnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIGxhYmVsOiAnVG90YWwgUHJvZHVjdHMnLFxuICAgICAgICAgICAgY29sb3I6IGNsb3Vkd2F0Y2guQ29sb3IuR1JFWSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdQcm9jZXNzZWRDb3VudCcsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgbGFiZWw6ICdQcm9jZXNzZWQgKHdpdGggQVNJTiknLFxuICAgICAgICAgICAgY29sb3I6IGNsb3Vkd2F0Y2guQ29sb3IuQkxVRSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdTa2lwcGVkQ291bnQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIGxhYmVsOiAnU2tpcHBlZCAobm8gQVNJTiknLFxuICAgICAgICAgICAgY29sb3I6IGNsb3Vkd2F0Y2guQ29sb3IuQlJPV04sXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gUmVxdWlyZW1lbnQgOC40OiBTZXQgdXAgYWxhcm1zIGZvciBoaWdoIGZhaWx1cmUgcmF0ZXNcbiAgICBjb25zdCBoaWdoRmFpbHVyZVJhdGVBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoRmFpbHVyZVJhdGVBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ1ByaWNlU3luYy1IaWdoRmFpbHVyZVJhdGUnLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FsZXJ0IHdoZW4gcHJpY2Ugc3luYyBmYWlsdXJlIHJhdGUgZXhjZWVkcyA1MCUnLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnRmFpbHVyZVJhdGUnLFxuICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiA1MCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgU05TIGFjdGlvbiB0byB0aGUgYWxhcm1cbiAgICBoaWdoRmFpbHVyZVJhdGVBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMucHJpY2VTeW5jQWxlcnRUb3BpYylcbiAgICApO1xuXG4gICAgLy8gUmVxdWlyZW1lbnQgOC40OiBTZXQgdXAgYWxhcm1zIGZvciBhdXRoZW50aWNhdGlvbiBlcnJvcnNcbiAgICAvLyBUaGlzIGFsYXJtIG1vbml0b3JzIENsb3VkV2F0Y2ggTG9ncyBmb3IgYXV0aGVudGljYXRpb24gZXJyb3JzXG4gICAgY29uc3QgYXV0aEVycm9yTWV0cmljRmlsdGVyID0gbmV3IGxvZ3MuTWV0cmljRmlsdGVyKHRoaXMsICdBdXRoRXJyb3JNZXRyaWNGaWx0ZXInLCB7XG4gICAgICBsb2dHcm91cDogcHJpY2VTeW5jTG9nR3JvdXAsXG4gICAgICBtZXRyaWNOYW1lc3BhY2U6ICdQcmljZVN5bmMnLFxuICAgICAgbWV0cmljTmFtZTogJ0F1dGhlbnRpY2F0aW9uRXJyb3JzJyxcbiAgICAgIGZpbHRlclBhdHRlcm46IGxvZ3MuRmlsdGVyUGF0dGVybi5hbnlUZXJtKCc0MDEnLCAnVW5hdXRob3JpemVkJywgJ0ludmFsaWRTaWduYXR1cmUnLCAnU2lnbmF0dXJlRG9lc05vdE1hdGNoJyksXG4gICAgICBtZXRyaWNWYWx1ZTogJzEnLFxuICAgICAgZGVmYXVsdFZhbHVlOiAwLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXV0aEVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQXV0aEVycm9yQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICdQcmljZVN5bmMtQXV0aGVudGljYXRpb25FcnJvcicsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxlcnQgd2hlbiBQQS1BUEkgYXV0aGVudGljYXRpb24gZXJyb3JzIG9jY3VyJyxcbiAgICAgIG1ldHJpYzogYXV0aEVycm9yTWV0cmljRmlsdGVyLm1ldHJpYyh7XG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fT1JfRVFVQUxfVE9fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICBhdXRoRXJyb3JBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMucHJpY2VTeW5jQWxlcnRUb3BpYylcbiAgICApO1xuXG4gICAgLy8gQWxhcm0gZm9yIGV4ZWN1dGlvbiBkdXJhdGlvbiBleGNlZWRpbmcgNSBtaW51dGVzXG4gICAgY29uc3QgbG9uZ0V4ZWN1dGlvbkFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0xvbmdFeGVjdXRpb25BbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ1ByaWNlU3luYy1Mb25nRXhlY3V0aW9uJyxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIHByaWNlIHN5bmMgZXhlY3V0aW9uIGV4Y2VlZHMgNSBtaW51dGVzJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnUHJpY2VTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0R1cmF0aW9uJyxcbiAgICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMzAwMDAwLCAvLyA1IG1pbnV0ZXMgaW4gbWlsbGlzZWNvbmRzXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuXG4gICAgbG9uZ0V4ZWN1dGlvbkFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5wcmljZVN5bmNBbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyBPdXRwdXQgQVBJIEdhdGV3YXkgVVJMXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFVSTCcsXG4gICAgICBleHBvcnROYW1lOiAnQXBpR2F0ZXdheVVybCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkucmVzdEFwaUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBJRCcsXG4gICAgICBleHBvcnROYW1lOiAnQXBpR2F0ZXdheUlkJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBTTlMgdG9waWMgQVJOIGZvciBwcmljZSBzeW5jIGFsZXJ0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcmljZVN5bmNBbGVydFRvcGljQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJpY2VTeW5jQWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU05TIFRvcGljIEFSTiBmb3IgUHJpY2UgU3luYyBBbGVydHMnLFxuICAgICAgZXhwb3J0TmFtZTogJ1ByaWNlU3luY0FsZXJ0VG9waWNBcm4nLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IFBhcmFtZXRlciBTdG9yZSBwYXJhbWV0ZXIgbmFtZXNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUEFBUElQYXJhbWV0ZXJzUHJlZml4Jywge1xuICAgICAgdmFsdWU6ICcvYW1hem9uLWFmZmlsaWF0ZS9wYS1hcGkvJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGFyYW1ldGVyIFN0b3JlIHByZWZpeCBmb3IgUEEtQVBJIGNyZWRlbnRpYWxzJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBDbG91ZFdhdGNoIERhc2hib2FyZCBVUkxcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJpY2VTeW5jRGFzaGJvYXJkVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovL2NvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHtwcmljZVN5bmNEYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZFdhdGNoIERhc2hib2FyZCBVUkwgZm9yIFByaWNlIFN5bmMgTW9uaXRvcmluZycsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgQWxhcm0gQVJOc1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdIaWdoRmFpbHVyZVJhdGVBbGFybUFybicsIHtcbiAgICAgIHZhbHVlOiBoaWdoRmFpbHVyZVJhdGVBbGFybS5hbGFybUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnSGlnaCBGYWlsdXJlIFJhdGUgQWxhcm0gQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdXRoRXJyb3JBbGFybUFybicsIHtcbiAgICAgIHZhbHVlOiBhdXRoRXJyb3JBbGFybS5hbGFybUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXV0aGVudGljYXRpb24gRXJyb3IgQWxhcm0gQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMb25nRXhlY3V0aW9uQWxhcm1Bcm4nLCB7XG4gICAgICB2YWx1ZTogbG9uZ0V4ZWN1dGlvbkFsYXJtLmFsYXJtQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdMb25nIEV4ZWN1dGlvbiBBbGFybSBBUk4nLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IFByaWNlIFN5bmMgTGFtYmRhIGRldGFpbHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJpY2VTeW5jTGFtYmRhQXJuJywge1xuICAgICAgdmFsdWU6IHN5bmNBbWF6b25QcmljZXNGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJpY2UgU3luYyBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdQcmljZVN5bmNMYW1iZGFBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ByaWNlU3luY0xhbWJkYU5hbWUnLCB7XG4gICAgICB2YWx1ZTogc3luY0FtYXpvblByaWNlc0Z1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJpY2UgU3luYyBMYW1iZGEgRnVuY3Rpb24gTmFtZScsXG4gICAgICBleHBvcnROYW1lOiAnUHJpY2VTeW5jTGFtYmRhTmFtZScsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXQgRXZlbnRCcmlkZ2UgcnVsZSBkZXRhaWxzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ByaWNlU3luY1J1bGVBcm4nLCB7XG4gICAgICB2YWx1ZTogcHJpY2VTeW5jUnVsZS5ydWxlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdFdmVudEJyaWRnZSBSdWxlIEFSTiBmb3IgUHJpY2UgU3luYycsXG4gICAgICBleHBvcnROYW1lOiAnUHJpY2VTeW5jUnVsZUFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJpY2VTeW5jUnVsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogcHJpY2VTeW5jUnVsZS5ydWxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRXZlbnRCcmlkZ2UgUnVsZSBOYW1lIGZvciBQcmljZSBTeW5jJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcmljZVN5bmNTY2hlZHVsZScsIHtcbiAgICAgIHZhbHVlOiAnRGFpbHkgYXQgMjowMCBBTSBVVEMgKGNyb246IDAgMiAqICogPyAqKScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByaWNlIFN5bmMgU2NoZWR1bGUnLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IE1hbnVhbCBUcmlnZ2VyIExhbWJkYSBkZXRhaWxzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RyaWdnZXJQcmljZVN5bmNMYW1iZGFBcm4nLCB7XG4gICAgICB2YWx1ZTogdHJpZ2dlclByaWNlU3luY0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdNYW51YWwgUHJpY2UgU3luYyBUcmlnZ2VyIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogJ1RyaWdnZXJQcmljZVN5bmNMYW1iZGFBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RyaWdnZXJQcmljZVN5bmNMYW1iZGFOYW1lJywge1xuICAgICAgdmFsdWU6IHRyaWdnZXJQcmljZVN5bmNGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ01hbnVhbCBQcmljZSBTeW5jIFRyaWdnZXIgTGFtYmRhIEZ1bmN0aW9uIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogJ1RyaWdnZXJQcmljZVN5bmNMYW1iZGFOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdNYW51YWxTeW5jRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogYCR7dGhpcy5hcGkudXJsfWFwaS9hZG1pbi9zeW5jLXByaWNlc2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ01hbnVhbCBQcmljZSBTeW5jIEFQSSBFbmRwb2ludCAoUE9TVCknLFxuICAgIH0pO1xuICB9XG59XG4iXX0=