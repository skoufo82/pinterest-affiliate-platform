import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface BackendStackProps extends cdk.StackProps {
  productsTable: dynamodb.Table;
  imagesBucket: s3.Bucket;
}

export class BackendStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { productsTable, imagesBucket } = props;

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

    // Common Lambda environment variables
    const commonEnvironment = {
      PRODUCTS_TABLE_NAME: productsTable.tableName,
      IMAGES_BUCKET_NAME: imagesBucket.bucketName,
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

    // Create Lambda functions
    const getProductsFunction = new lambda.Function(this, 'GetProductsFunction', {
      ...lambdaConfig,
      functionName: 'pinterest-affiliate-getProducts',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/getProducts')),
      handler: 'index.handler',
      description: 'Get all products with optional category filtering',
    });

    const getProductFunction = new lambda.Function(this, 'GetProductFunction', {
      ...lambdaConfig,
      functionName: 'pinterest-affiliate-getProduct',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/getProduct')),
      handler: 'index.handler',
      description: 'Get a single product by ID',
    });

    const createProductFunction = new lambda.Function(this, 'CreateProductFunction', {
      ...lambdaConfig,
      functionName: 'pinterest-affiliate-createProduct',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/createProduct')),
      handler: 'index.handler',
      description: 'Create a new product',
    });

    const updateProductFunction = new lambda.Function(this, 'UpdateProductFunction', {
      ...lambdaConfig,
      functionName: 'pinterest-affiliate-updateProduct',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/updateProduct')),
      handler: 'index.handler',
      description: 'Update an existing product',
    });

    const deleteProductFunction = new lambda.Function(this, 'DeleteProductFunction', {
      ...lambdaConfig,
      functionName: 'pinterest-affiliate-deleteProduct',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/deleteProduct')),
      handler: 'index.handler',
      description: 'Delete a product',
    });

    const uploadImageFunction = new lambda.Function(this, 'UploadImageFunction', {
      ...lambdaConfig,
      functionName: 'pinterest-affiliate-uploadImage',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/uploadImage')),
      handler: 'index.handler',
      description: 'Generate presigned URL for image upload',
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
        // Enable caching for GET endpoints
        cachingEnabled: true,
        cacheClusterEnabled: true,
        cacheClusterSize: '0.5', // 0.5 GB cache
        cacheTtl: cdk.Duration.minutes(5), // 5 minute default TTL
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

    // Admin endpoints
    const adminResource = apiResource.addResource('admin');
    const adminProductsResource = adminResource.addResource('products');

    adminProductsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createProductFunction)
    );

    const adminProductResource = adminProductsResource.addResource('{id}');
    adminProductResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(updateProductFunction)
    );
    adminProductResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteProductFunction)
    );

    const uploadImageResource = adminResource.addResource('upload-image');
    uploadImageResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(uploadImageFunction)
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
