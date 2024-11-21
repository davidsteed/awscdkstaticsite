#!/usr/bin/env node
import cdk = require("aws-cdk-lib");
import "source-map-support/register";
import { StaticSite } from "../lib/static-site";

const app = new cdk.App();

// This code takes domainName subDomain and AWS account from the command line.  You can replace this
// with hard coded values if required

const domainName = app.node.tryGetContext("domainName");
const subDomain = app.node.tryGetContext("subDomain");
const account = app.node.tryGetContext("account");

if (account === undefined) {
  console.log("Account not set.  Use -c account=<your AWS account number>");
  process.exit(-1);
}

if (domainName === undefined) {
  console.log("domainName not set.  Use -c domainName=yoursite.com");
  process.exit(-1);
}
if (subDomain === undefined) {
  console.log("subDomain not set.  Use -c subDomain=www");
  process.exit(-1);
}

// This is an example set of headers.  Please modify this to the headers you require, then rebuild the
// project using npm run build
const headers = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubdomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: "script-src 'self';",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
];

new StaticSite(app, "WebSite", {
  env: {
    account: account,
    region: "us-east-1",
  },
  domainName: domainName,
  siteSubDomain: subDomain,
  assets: "../react-site/dist",
  headers: headers,
});
