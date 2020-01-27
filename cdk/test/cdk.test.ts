import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import { StaticSite } from '../lib/static-site';

test('Empty Stack', () => {
  const app = new cdk.App();
  // WHEN
  new StaticSite(app, 'MyTestStack', {
    domainName: 'www',
    siteSubDomain: 'example.com',
    assets: '../react-site/build',
    headers: []
  });
  // THEN

});
