import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly productsTable: dynamodb.Table;
  public readonly creatorsTable: dynamodb.Table;
  public readonly analyticsEventsTable: dynamodb.Table;
  public readonly analyticsSummariesTable: dynamodb.Table;
  public readonly imagesBucket: s3.Bucket;
  public readonly imagesCdn: cloudfront.Distribution;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
          headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
            'Origin',
            'Access-Control-Request-Method',
            'Access-Control-Request-Headers'
          ),
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
