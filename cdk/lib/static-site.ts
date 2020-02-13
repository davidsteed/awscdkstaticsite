#!/usr/bin/env node
import cloudfront = require('@aws-cdk/aws-cloudfront');
import route53 = require('@aws-cdk/aws-route53');
import s3 = require('@aws-cdk/aws-s3');
import s3deploy = require('@aws-cdk/aws-s3-deployment');
import acm = require('@aws-cdk/aws-certificatemanager');
import cdk = require('@aws-cdk/core');
import targets = require('@aws-cdk/aws-route53-targets/lib');
import lambda = require('@aws-cdk/aws-lambda');
import { Redirect } from '../lib/redirect';

export interface StaticSiteProps extends cdk.StackProps {
    domainName: string;
    siteSubDomain: string;
    assets: string;
    headers: { key: string, value: string }[]
}

function sprintf(strings: TemplateStringsArray, ...indices: number[]) {
    return (...values: string[]) =>
        strings.reduce((total, part, index) =>
            total + part + (values[indices[index]] || ''), ''
        );
}

// create a simple code checksum so that each version is unique
function checksum(s: string): string {
    var strlen = s.length, i: number, c: number;
    var hash = 0;
    if (strlen === 0) {
        return '';
    }
    for (i = 0; i < strlen; i++) {
        c = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash = hash & hash; //Convert to 32 bit
    }
    return hash.toString();
};


export class StaticSite extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: StaticSiteProps) {
        super(scope, id, props);

        // To apply security headers a lambda needs to be generated

        const codeStart = `'use strict';
        exports.handler = (event, context, callback) => {
        const response = event.Records[0].cf.response;
        const headers = response.headers;
        `;

        const headerTemplate = sprintf`headers["${0}"]= [{key: "${0}",value: "${1}"}];
        `;

        const codeEnd = `callback(null, response);
        };`

        let code = codeStart

        props.headers.forEach(element => {
            code = code.concat(headerTemplate(element.key, element.value))
        })

        code = code.concat(codeEnd)
        const edgelambda = new lambda.Function(this, 'Headers', {
            code: lambda.Code.fromInline(code),
            handler: 'index.handler',
            runtime: lambda.Runtime.NODEJS_10_X,
            memorySize: 128,
        });


        // the code must have a checksum to identify it otherwise it is not possible to update the code 
        // when new headers are required
        const lversion = edgelambda.addVersion(checksum(code));


        const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
        const siteDomain = props.siteSubDomain + '.' + props.domainName;
        new cdk.CfnOutput(this, 'Site', { value: 'https://' + siteDomain });

        // Content bucket
        const siteBucket = new s3.Bucket(this, 'SiteBucket', {
            bucketName: siteDomain,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html',
            publicReadAccess: true,

            // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
            // the new bucket, and it will remain in your account until manually deleted. By setting the policy to
            // DESTROY, cdk destroy will attempt to delete the bucket, but will error if the bucket is not empty.
            removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
        });
        new cdk.CfnOutput(this, 'Bucket', { value: siteBucket.bucketName });

        //if siteSubDomain is www redirect from from domain to site subdomain

        if (props.siteSubDomain === 'www') {
            new Redirect(this, 'Redirect', {
                domainName: props.domainName,
                siteBucket: siteBucket
            });
        }
        // TLS certificate
        const certificateArn = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
            domainName: siteDomain,
            hostedZone: zone
        }).certificateArn;
        new cdk.CfnOutput(this, 'Certificate', { value: certificateArn });

        // CloudFront distribution that provides HTTPS
        const distribution = new cloudfront.CloudFrontWebDistribution(this, 'SiteDistribution', {
            aliasConfiguration: {
                acmCertRef: certificateArn,
                names: [siteDomain],
                sslMethod: cloudfront.SSLMethod.SNI,
                securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_1_2016,
            },
            errorConfigurations: [
                {
                    errorCode: 403,
                    responseCode: 403,
                    responsePagePath: '/index.html',
                    errorCachingMinTtl: 86400
                },
                {
                    errorCode: 404,
                    responseCode: 403,
                    responsePagePath: '/index.html',
                    errorCachingMinTtl: 86400
                }
            ],
            originConfigs: [
                {
                    s3OriginSource: {
                        s3BucketSource: siteBucket
                    },
                    behaviors: [{
                        isDefaultBehavior: true,

                        lambdaFunctionAssociations:
                            [{
                                eventType: cloudfront.LambdaEdgeEventType.VIEWER_RESPONSE,
                                lambdaFunction: lversion
                            }]


                    }],
                }
            ]
        });
        new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });

        // Route53 alias record for the CloudFront distribution
        new route53.ARecord(this, 'SiteAliasRecord', {
            recordName: siteDomain,
            target: route53.AddressRecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
            zone
        });

        // Deploy site contents to S3 bucket
        new s3deploy.BucketDeployment(this, 'DeployWithInvalidation', {
            sources: [s3deploy.Source.asset(props.assets)],
            destinationBucket: siteBucket,
            distribution,
            distributionPaths: ['/*'],
        });
    }
}

