#!/usr/bin/env node
import cloudfront = require('@aws-cdk/aws-cloudfront');
import route53 = require('@aws-cdk/aws-route53');
import s3 = require('@aws-cdk/aws-s3');
import acm = require('@aws-cdk/aws-certificatemanager');
import cdk = require('@aws-cdk/core');
import targets = require('@aws-cdk/aws-route53-targets/lib');
import { Construct } from '@aws-cdk/core';
import lambda = require('@aws-cdk/aws-lambda');

export interface DeploySiteProps {
    domainName: string;
    siteName: string;
    siteBucket: s3.Bucket;
    lversion: lambda.Version;
}

export class DeploySite extends Construct {
    readonly distribution: cloudfront.CloudFrontWebDistribution;

    constructor(parent: Construct, name: string, props: DeploySiteProps) {
        super(parent, name);

        const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });

        // TLS certificate
        const certificateArn = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
            domainName: props.siteName,
            hostedZone: zone
        }).certificateArn;
        new cdk.CfnOutput(this, 'Certificate', { value: certificateArn });

        // CloudFront distribution that provides HTTPS
        this.distribution = new cloudfront.CloudFrontWebDistribution(this, 'SiteDistribution', {
            aliasConfiguration: {
                acmCertRef: certificateArn,
                names: [props.siteName],
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
                        s3BucketSource: props.siteBucket
                    },
                    behaviors: [{
                        isDefaultBehavior: true,

                        lambdaFunctionAssociations:
                            [{
                                eventType: cloudfront.LambdaEdgeEventType.VIEWER_RESPONSE,
                                lambdaFunction: props.lversion
                            }]


                    }],
                }
            ]
        });
        new cdk.CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });

        // Route53 alias record for the CloudFront distribution
        new route53.ARecord(this, 'SiteAliasRecord', {
            recordName: props.siteName,
            target: route53.AddressRecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
            zone
        });

    }
}
