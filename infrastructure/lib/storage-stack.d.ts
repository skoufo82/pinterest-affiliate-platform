import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
export declare class StorageStack extends cdk.Stack {
    readonly productsTable: dynamodb.Table;
    readonly imagesBucket: s3.Bucket;
    readonly imagesCdn: cloudfront.Distribution;
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
