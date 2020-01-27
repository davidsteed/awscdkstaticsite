#!/usr/bin/env node
import cloudfront = require('@aws-cdk/aws-cloudfront');
import route53 = require('@aws-cdk/aws-route53');
import s3 = require('@aws-cdk/aws-s3');
import acm = require('@aws-cdk/aws-certificatemanager');
import cdk = require('@aws-cdk/core');
import targets = require('@aws-cdk/aws-route53-targets/lib');
import { Construct } from '@aws-cdk/core';

export interface RedirectSiteProps {
    domainName: string;
    redirectName: string;
}

export class Redirect extends Construct {
    constructor(parent: Construct, name: string, props: RedirectSiteProps) {
        super(parent, name);
        const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });

        // Content bucket
        const siteBucket = new s3.Bucket(this, 'SiteBucket', {
            bucketName: props.domainName,
            publicReadAccess: true,
            websiteRedirect: { hostName: props.redirectName, protocol: s3.RedirectProtocol.HTTPS },

            // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
            // the new bucket, and it will remain in your account until manually deleted. By setting the policy to
            // DESTROY, cdk destroy will attempt to delete the bucket, but will error if the bucket is not empty.
            removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
        });
        new cdk.CfnOutput(this, 'Bucket', { value: siteBucket.bucketName });

        // TLS certificate
        const certificateArn = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
            domainName: props.domainName,
            hostedZone: zone
        }).certificateArn;
        new cdk.CfnOutput(this, 'Certificate', { value: certificateArn });

        // CloudFront distribution that provides HTTPS
        const distribution = new cloudfront.CloudFrontWebDistribution(this, 'SiteDistribution', {
            aliasConfiguration: {
                acmCertRef: certificateArn,
                names: [props.domainName],
                sslMethod: cloudfront.SSLMethod.SNI,
                securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_1_2016,
            },
            errorConfigurations: [
                {
                    errorCode: 403,
                    responseCode: 200,
                    responsePagePath: '/index.html'
                },
                {
                    errorCode: 404,
                    responseCode: 200,
                    responsePagePath: '/index.html'
                }
            ],
            originConfigs: [
                {
                    s3OriginSource: {
                        s3BucketSource: siteBucket
                    },
                    behaviors: [{ isDefaultBehavior: true }],
                }
            ]
        });
        new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });

        // Route53 alias record for the CloudFront distribution
        new route53.ARecord(this, 'SiteAliasRecord', {
            recordName: props.domainName,
            target: route53.AddressRecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
            zone
        });

    }
}
