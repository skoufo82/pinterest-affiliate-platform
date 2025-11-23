import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
interface BackendStackProps extends cdk.StackProps {
    productsTable: dynamodb.Table;
    imagesBucket: s3.Bucket;
}
export declare class BackendStack extends cdk.Stack {
    readonly api: apigateway.RestApi;
    constructor(scope: Construct, id: string, props: BackendStackProps);
}
export {};
