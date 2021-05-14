#!/usr/bin/env node
import cdk = require("aws-cdk-lib");
import { Construct } from "constructs";
import {aws_cloudfront as cloudfront}from "aws-cdk-lib";
import {aws_route53 as route53}from "aws-cdk-lib";
import {aws_s3 as s3}from "aws-cdk-lib";
import {aws_certificatemanager as acm}from "aws-cdk-lib";
import {aws_route53_targets as targets}from "aws-cdk-lib";
import {aws_lambda as lambda}from "aws-cdk-lib";

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
            viewerCertificate: {
                aliases: [props.siteName],
                props: {
                  acmCertificateArn: certificateArn,
                  sslSupportMethod: cloudfront.SSLMethod.SNI,
                  minimumProtocolVersion:cloudfront.SecurityPolicyProtocol.TLS_V1_2_2019,
                },
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
            target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
            zone
        });

    }
}
