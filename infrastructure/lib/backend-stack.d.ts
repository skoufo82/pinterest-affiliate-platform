import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
interface BackendStackProps extends cdk.StackProps {
    productsTable: dynamodb.Table;
    creatorsTable: dynamodb.Table;
    analyticsEventsTable: dynamodb.Table;
    analyticsSummariesTable: dynamodb.Table;
    imagesBucket: s3.Bucket;
    userPool: cognito.UserPool;
}
export declare class BackendStack extends cdk.Stack {
    readonly api: apigateway.RestApi;
    readonly priceSyncAlertTopic: sns.Topic;
    constructor(scope: Construct, id: string, props: BackendStackProps);
}
export {};
