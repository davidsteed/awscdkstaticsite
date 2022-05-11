#!/usr/bin/env node
import cdk = require("aws-cdk-lib");
import { Construct } from "constructs";
import { aws_route53 as route53 } from "aws-cdk-lib";
import { aws_s3 as s3 } from "aws-cdk-lib";
import { aws_lambda as lambda } from "aws-cdk-lib";
import { aws_s3_deployment as s3deploy } from "aws-cdk-lib";
import { DeploySite } from "./deploy-site";
import { aws_route53_patterns as route53patterns } from "aws-cdk-lib";

export interface StaticSiteProps extends cdk.StackProps {
  domainName: string;
  siteSubDomain: string;
  assets: string;
  headers: { key: string; value: string }[];
}

function sprintf(strings: TemplateStringsArray, ...indices: number[]) {
  return (...values: string[]) =>
    strings.reduce(
      (total, part, index) => total + part + (values[indices[index]] || ""),
      ""
    );
}

// create a simple code checksum so that each version is unique
function checksum(s: string): string {
  var strlen = s.length,
    i: number,
    c: number;
  var hash = 0;
  if (strlen === 0) {
    return "";
  }
  for (i = 0; i < strlen; i++) {
    c = s.charCodeAt(i);
    hash = (hash << 5) - hash + c;
    hash = hash & hash; //Convert to 32 bit
  }
  return hash.toString();
}

export class StaticSite extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StaticSiteProps) {
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
        };`;

    let code = codeStart;

    props.headers.forEach((element) => {
      code = code.concat(headerTemplate(element.key, element.value));
    });

    code = code.concat(codeEnd);
    const edgelambda = new lambda.Function(this, "Headers", {
      code: lambda.Code.fromInline(code),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 128,
    });

    // the code must have a checksum to identify it otherwise it is not possible to update the code
    // when new headers are required
    const lversion = edgelambda.currentVersion;

    const siteDomain = props.siteSubDomain + "." + props.domainName;
    new cdk.CfnOutput(this, "Site", { value: "https://" + siteDomain });

    // Content bucket
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: siteDomain,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    new cdk.CfnOutput(this, "Bucket", { value: siteBucket.bucketName });

    if (props.siteSubDomain === "www") {
      new route53patterns.HttpsRedirect(this, "Redirect", {
        recordNames: [props.domainName],
        targetDomain: siteDomain,
        zone: route53.HostedZone.fromLookup(this, "Zone", {
          domainName: props.domainName,
        }),
      });
    }

    const website = new DeploySite(this, "Website", {
      domainName: props.domainName,
      siteName: siteDomain,
      siteBucket: siteBucket,
      lversion: lversion,
    });

    // Deploy site contents to S3 bucket
    new s3deploy.BucketDeployment(this, "DeployWithInvalidation", {
      sources: [s3deploy.Source.asset(props.assets)],
      destinationBucket: siteBucket,
      distribution: website.distribution,
      distributionPaths: ["/*"],
    });
  }
}
