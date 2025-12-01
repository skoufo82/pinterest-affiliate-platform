import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';

interface BackendStackProps extends cdk.StackProps {
  productsTable: dynamodb.Table;
  imagesBucket: s3.Bucket;
  userPool: cognito.UserPool;
}

export class BackendStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { productsTable, imagesBucket, userPool } = props;

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
      logRetention: logs.RetentionDays.ONE_WEEK,
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
  }
}
