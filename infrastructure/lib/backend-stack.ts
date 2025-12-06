import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import * as path from 'path';

interface BackendStackProps extends cdk.StackProps {
  productsTable: dynamodb.Table;
  creatorsTable: dynamodb.Table;
  analyticsEventsTable: dynamodb.Table;
  analyticsSummariesTable: dynamodb.Table;
  imagesBucket: s3.Bucket;
  userPool: cognito.UserPool;
}

export class BackendStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly priceSyncAlertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
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
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

    // Grant SES permissions for sending emails
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ses:SendEmail',
          'ses:SendRawEmail',
        ],
        resources: ['*'], // SES requires * for email sending
      })
    );

    // Grant Parameter Store permissions for PA-API credentials
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ssm:GetParameter',
          'ssm:GetParameters',
        ],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/amazon-affiliate/*`,
        ],
      })
    );

    // Grant SNS permissions for price sync alerts
    this.priceSyncAlertTopic.grantPublish(lambdaRole);

    // Grant CloudWatch permissions for custom metrics
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudwatch:PutMetricData',
        ],
        resources: ['*'], // CloudWatch metrics require * resource
      })
    );



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
    priceSyncRule.addTarget(
      new events_targets.LambdaFunction(syncAmazonPricesFunction, {
        retryAttempts: 2,
        maxEventAge: cdk.Duration.hours(2),
      })
    );

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
    getSyncHistoryFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:FilterLogEvents',
          'logs:DescribeLogStreams',
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/syncAmazonPrices:*`,
        ],
      })
    );

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
    productsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getProductsFunction, {
        cacheKeyParameters: ['method.request.querystring.category'],
      }),
      {
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
      }
    );

    const productResource = productsResource.addResource('{id}');
    productResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getProductFunction, {
        cacheKeyParameters: ['method.request.path.id'],
      }),
      {
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
      }
    );

    // Categories endpoint
    const categoriesResource = apiResource.addResource('categories');
    categoriesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getCategoriesFunction),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Cache-Control': true,
            },
          },
        ],
      }
    );

    // Admin endpoints (protected by Cognito)
    const adminResource = apiResource.addResource('admin');
    const adminProductsResource = adminResource.addResource('products');

    // GET all products (admin - includes unpublished)
    adminProductsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(adminGetProductsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    adminProductsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createProductFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    const adminProductResource = adminProductsResource.addResource('{id}');
    adminProductResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(updateProductFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
    adminProductResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteProductFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    const uploadImageResource = adminResource.addResource('upload-image');
    uploadImageResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(uploadImageFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // User Management endpoints (protected by Cognito)
    const usersResource = adminResource.addResource('users');
    usersResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listUsersFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
    usersResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createUserFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    const userResource = usersResource.addResource('{username}');
    userResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteUserFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    const resetPasswordResource = userResource.addResource('reset-password');
    resetPasswordResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(resetPasswordFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Manual Price Sync Trigger endpoint (protected by Cognito)
    // Requirement 3.4: POST /admin/sync-prices API endpoint
    const syncPricesResource = adminResource.addResource('sync-prices');
    syncPricesResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(triggerPriceSyncFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Sync History endpoint (protected by Cognito)
    // Requirement 6.4: GET /admin/sync-history API endpoint
    const syncHistoryResource = adminResource.addResource('sync-history');
    syncHistoryResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getSyncHistoryFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

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

    // GET /api/creators (list all active creators - public)
    const creatorsResource = apiResource.addResource('creators');
    creatorsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listAllCreatorsFunction),
      {
        requestParameters: {
          'method.request.querystring.limit': false,
          'method.request.querystring.search': false,
          'method.request.querystring.offset': false,
        },
      }
    );
    
    // POST /api/creators (public creator signup)
    creatorsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createCreatorFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
    
    // GET /api/creators/{slug}
    const creatorSlugResource = creatorsResource.addResource('{slug}');
    creatorSlugResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getCreatorBySlugFunction, {
        cacheKeyParameters: ['method.request.path.slug'],
      }),
      {
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
      }
    );

    // GET /api/creators/{slug}/products
    const creatorProductsResource = creatorSlugResource.addResource('products');
    creatorProductsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getProductsFunction, {
        cacheKeyParameters: [
          'method.request.path.slug',
          'method.request.querystring.category',
          'method.request.querystring.search',
          'method.request.querystring.sort',
        ],
      }),
      {
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
      }
    );

    // GET /api/creators/{slug}/featured
    const creatorFeaturedResource = creatorSlugResource.addResource('featured');
    creatorFeaturedResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getProductsFunction, {
        cacheKeyParameters: ['method.request.path.slug'],
      }),
      {
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
      }
    );

    // ========================================
    // Creator Routes (Creator Auth Required)
    // ========================================

    const creatorResource = apiResource.addResource('creator');

    // GET /api/creator/profile
    // PUT /api/creator/profile
    const creatorProfileResource = creatorResource.addResource('profile');
    creatorProfileResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getCreatorBySlugFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
    creatorProfileResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(updateCreatorProfileFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // GET /api/creator/products
    // POST /api/creator/products
    const creatorOwnProductsResource = creatorResource.addResource('products');
    creatorOwnProductsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getProductsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
    creatorOwnProductsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createProductFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // PUT /api/creator/products/{id}
    // DELETE /api/creator/products/{id}
    const creatorProductResource = creatorOwnProductsResource.addResource('{id}');
    creatorProductResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(updateProductFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
    creatorProductResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteProductFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // GET /api/creator/analytics
    const creatorAnalyticsResource = creatorResource.addResource('analytics');
    creatorAnalyticsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getCreatorAnalyticsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          'method.request.querystring.startDate': false,
          'method.request.querystring.endDate': false,
        },
      }
    );

    // ========================================
    // Admin Creator Management Routes
    // ========================================

    // GET /api/admin/creators
    const adminCreatorsResource = adminResource.addResource('creators');
    adminCreatorsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listAllCreatorsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // POST /api/admin/creators (for admin to create creators)
    adminCreatorsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createCreatorFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // PUT /api/admin/creators/{id}/status
    const adminCreatorIdResource = adminCreatorsResource.addResource('{id}');
    const adminCreatorStatusResource = adminCreatorIdResource.addResource('status');
    adminCreatorStatusResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(updateCreatorStatusFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // GET /api/admin/products/pending
    const adminPendingResource = adminProductsResource.addResource('pending');
    adminPendingResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getPendingProductsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // PUT /api/admin/products/{id}/approve
    const adminProductApproveResource = adminProductResource.addResource('approve');
    adminProductApproveResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(approveProductFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // PUT /api/admin/products/{id}/reject
    const adminProductRejectResource = adminProductResource.addResource('reject');
    adminProductRejectResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(rejectProductFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // ========================================
    // Analytics Tracking Routes (Public)
    // ========================================

    // POST /api/analytics/page-view
    const analyticsResource = apiResource.addResource('analytics');
    const pageViewResource = analyticsResource.addResource('page-view');
    pageViewResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(trackPageViewFunction)
    );

    // POST /api/analytics/affiliate-click
    const affiliateClickResource = analyticsResource.addResource('affiliate-click');
    affiliateClickResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(trackAffiliateClickFunction)
    );

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
      })
    );

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
      })
    );

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
    highFailureRateAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.priceSyncAlertTopic)
    );

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

    authErrorAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.priceSyncAlertTopic)
    );

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

    longExecutionAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.priceSyncAlertTopic)
    );

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
