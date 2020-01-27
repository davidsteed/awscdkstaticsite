#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { StaticSite } from '../lib/static-site';


const app = new cdk.App();

const domainName = app.node.tryGetContext('domainName');
const subDomain = app.node.tryGetContext('subDomain');
const account = app.node.tryGetContext('account');

const headers = [
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubdomains; preload' },
    { key: 'Content-Security-Policy', value: "script-src 'self' 'unsafe-inline';" },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-XSS-Protection', value: '1; mode=block' },
    { key: 'Referrer-Policy', value: 'same-origin' },
    { key: 'Feature-Policy', value: "accelerometer 'none'; ambient-light-sensor 'none'; autoplay 'none'; camera 'none'; encrypted-media 'none'; fullscreen 'none'; geolocation 'none'; gyroscope 'none'; magnetometer 'none'; microphone 'none'; midi 'none';  picture-in-picture 'none'; speaker 'none'; sync-xhr 'none'; usb  'none'; vr 'none'" }
]


new StaticSite(app, 'WebSite', {
    env: {
        account: account,
        region: 'us-east-1'
    },
    domainName: domainName,
    siteSubDomain: subDomain,
    assets: '../react-site/build',
    headers: headers
});
