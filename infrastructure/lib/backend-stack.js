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
const path = __importStar(require("path"));
class BackendStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        // Admin endpoints
        const adminResource = apiResource.addResource('admin');
        const adminProductsResource = adminResource.addResource('products');
        adminProductsResource.addMethod('POST', new apigateway.LambdaIntegration(createProductFunction));
        const adminProductResource = adminProductsResource.addResource('{id}');
        adminProductResource.addMethod('PUT', new apigateway.LambdaIntegration(updateProductFunction));
        adminProductResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteProductFunction));
        const uploadImageResource = adminResource.addResource('upload-image');
        uploadImageResource.addMethod('POST', new apigateway.LambdaIntegration(uploadImageFunction));
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
exports.BackendStack = BackendStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2VuZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhY2tlbmQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFHekQseURBQTJDO0FBQzNDLDJEQUE2QztBQUU3QywyQ0FBNkI7QUFPN0IsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFHekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztRQUU5Qyx1Q0FBdUM7UUFDdkMsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUMzRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsZUFBZSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMENBQTBDLENBQUM7YUFDdkY7U0FDRixDQUFDLENBQUM7UUFFSCw2QkFBNkI7UUFDN0IsYUFBYSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRTdDLHVCQUF1QjtRQUN2QixZQUFZLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRXhDLHNDQUFzQztRQUN0QyxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLG1CQUFtQixFQUFFLGFBQWEsQ0FBQyxTQUFTO1lBQzVDLGtCQUFrQixFQUFFLFlBQVksQ0FBQyxVQUFVO1lBQzNDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsOEJBQThCO1FBQzlCLE1BQU0sWUFB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Q0FDeEQsQ0FBQztRQUNGLG9CQUFvQixDQUFDLFNBQVMsQ0FDNUIsUUFBUSxFQUNSLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLENBQ3hELENBQUM7UUFFRixNQUFNLG1CQUFtQixHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDdEUsbUJBQW1CLENBQUMsU0FBUyxDQUMzQixNQUFNLEVBQ04sSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsQ0FDdEQsQ0FBQztRQUVGLHlCQUF5QjtRQUN6QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUNoQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHO1lBQ25CLFdBQVcsRUFBRSxpQkFBaUI7WUFDOUIsVUFBVSxFQUFFLGVBQWU7U0FDNUIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7WUFDL0IsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUztZQUN6QixXQUFXLEVBQUUsZ0JBQWdCO1lBQzdCLFVBQVUsRUFBRSxjQUFjO1NBQzNCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXpNRCxvQ0F5TUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5pbnRlcmZhY2UgQmFja2VuZFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHByb2R1Y3RzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBpbWFnZXNCdWNrZXQ6IHMzLkJ1Y2tldDtcbn1cblxuZXhwb3J0IGNsYXNzIEJhY2tlbmRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmFja2VuZFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgcHJvZHVjdHNUYWJsZSwgaW1hZ2VzQnVja2V0IH0gPSBwcm9wcztcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZSBmb3IgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0xhbWJkYUV4ZWN1dGlvblJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIHByb2R1Y3RzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuXG4gICAgLy8gR3JhbnQgUzMgcGVybWlzc2lvbnNcbiAgICBpbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUobGFtYmRhUm9sZSk7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgIGNvbnN0IGNvbW1vbkVudmlyb25tZW50ID0ge1xuICAgICAgUFJPRFVDVFNfVEFCTEVfTkFNRTogcHJvZHVjdHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBJTUFHRVNfQlVDS0VUX05BTUU6IGltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICB9O1xuXG4gICAgLy8gQ29tbW9uIExhbWJkYSBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgbGFtYmRhQ29uZmlnID0ge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb25zXG4gICAgY29uc3QgZ2V0UHJvZHVjdHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldFByb2R1Y3RzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6ICdwaW50ZXJlc3QtYWZmaWxpYXRlLWdldFByb2R1Y3RzJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9mdW5jdGlvbnMvZ2V0UHJvZHVjdHMnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBhbGwgcHJvZHVjdHMgd2l0aCBvcHRpb25hbCBjYXRlZ29yeSBmaWx0ZXJpbmcnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0UHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0UHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1nZXRQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9mdW5jdGlvbnMvZ2V0UHJvZHVjdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IGEgc2luZ2xlIHByb2R1Y3QgYnkgSUQnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY3JlYXRlUHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ3JlYXRlUHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1jcmVhdGVQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9mdW5jdGlvbnMvY3JlYXRlUHJvZHVjdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIGEgbmV3IHByb2R1Y3QnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXBkYXRlUHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlUHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS11cGRhdGVQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9mdW5jdGlvbnMvdXBkYXRlUHJvZHVjdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXBkYXRlIGFuIGV4aXN0aW5nIHByb2R1Y3QnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGVsZXRlUHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRGVsZXRlUHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiAncGludGVyZXN0LWFmZmlsaWF0ZS1kZWxldGVQcm9kdWN0JyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9mdW5jdGlvbnMvZGVsZXRlUHJvZHVjdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGVsZXRlIGEgcHJvZHVjdCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGxvYWRJbWFnZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBsb2FkSW1hZ2VGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3BpbnRlcmVzdC1hZmZpbGlhdGUtdXBsb2FkSW1hZ2UnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Z1bmN0aW9ucy91cGxvYWRJbWFnZScpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2VuZXJhdGUgcHJlc2lnbmVkIFVSTCBmb3IgaW1hZ2UgdXBsb2FkJyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBBUEkgR2F0ZXdheVxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnUGludGVyZXN0QWZmaWxpYXRlQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6ICdQaW50ZXJlc3QgQWZmaWxpYXRlIEFQSScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBmb3IgUGludGVyZXN0IEFmZmlsaWF0ZSBQbGF0Zm9ybScsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAvLyBFbmFibGUgY2FjaGluZyBmb3IgR0VUIGVuZHBvaW50c1xuICAgICAgICBjYWNoaW5nRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgY2FjaGVDbHVzdGVyRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgY2FjaGVDbHVzdGVyU2l6ZTogJzAuNScsIC8vIDAuNSBHQiBjYWNoZVxuICAgICAgICBjYWNoZVR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksIC8vIDUgbWludXRlIGRlZmF1bHQgVFRMXG4gICAgICB9LFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAnWC1BcGktS2V5JyxcbiAgICAgICAgICAnWC1BbXotU2VjdXJpdHktVG9rZW4nLFxuICAgICAgICBdLFxuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBBUEkgcmVzb3VyY2VzIGFuZCBtZXRob2RzXG4gICAgY29uc3QgYXBpUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdhcGknKTtcblxuICAgIC8vIFB1YmxpYyBlbmRwb2ludHMgd2l0aCBjYWNoaW5nXG4gICAgY29uc3QgcHJvZHVjdHNSZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFJlc291cmNlKCdwcm9kdWN0cycpO1xuICAgIHByb2R1Y3RzUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRQcm9kdWN0c0Z1bmN0aW9uLCB7XG4gICAgICAgIGNhY2hlS2V5UGFyYW1ldGVyczogWydtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5jYXRlZ29yeSddLFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmNhdGVnb3J5JzogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkNhY2hlLUNvbnRyb2wnOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBwcm9kdWN0UmVzb3VyY2UgPSBwcm9kdWN0c1Jlc291cmNlLmFkZFJlc291cmNlKCd7aWR9Jyk7XG4gICAgcHJvZHVjdFJlc291cmNlLmFkZE1ldGhvZChcbiAgICAgICdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZHVjdEZ1bmN0aW9uLCB7XG4gICAgICAgIGNhY2hlS2V5UGFyYW1ldGVyczogWydtZXRob2QucmVxdWVzdC5wYXRoLmlkJ10sXG4gICAgICB9KSxcbiAgICAgIHtcbiAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QucGF0aC5pZCc6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkNhY2hlLUNvbnRyb2wnOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBBZG1pbiBlbmRwb2ludHNcbiAgICBjb25zdCBhZG1pblJlc291cmNlID0gYXBpUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FkbWluJyk7XG4gICAgY29uc3QgYWRtaW5Qcm9kdWN0c1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgncHJvZHVjdHMnKTtcblxuICAgIGFkbWluUHJvZHVjdHNSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnUE9TVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVQcm9kdWN0RnVuY3Rpb24pXG4gICAgKTtcblxuICAgIGNvbnN0IGFkbWluUHJvZHVjdFJlc291cmNlID0gYWRtaW5Qcm9kdWN0c1Jlc291cmNlLmFkZFJlc291cmNlKCd7aWR9Jyk7XG4gICAgYWRtaW5Qcm9kdWN0UmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BVVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVQcm9kdWN0RnVuY3Rpb24pXG4gICAgKTtcbiAgICBhZG1pblByb2R1Y3RSZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICAnREVMRVRFJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGRlbGV0ZVByb2R1Y3RGdW5jdGlvbilcbiAgICApO1xuXG4gICAgY29uc3QgdXBsb2FkSW1hZ2VSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3VwbG9hZC1pbWFnZScpO1xuICAgIHVwbG9hZEltYWdlUmVzb3VyY2UuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXBsb2FkSW1hZ2VGdW5jdGlvbilcbiAgICApO1xuXG4gICAgLy8gT3V0cHV0IEFQSSBHYXRld2F5IFVSTFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogJ0FwaUdhdGV3YXlVcmwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogJ0FwaUdhdGV3YXlJZCcsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==