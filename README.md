# AWS React Site Deployment with Security Headers

Deploying a react web site to AWS cloudfront with TLS, the correct security headers to prevent XSS scripting attacks, X-Frame options etc. and redirects from react-site.com to www.react-site.com should be easy, but is quite dificult.

This project provides scripts to enable this to be done using a single command that can be incorporated into a CI/CD pipeline.

Custom security headers can be specified in the file cdk/bin/cdk.ts. The example given allows inline scripts to be run. You can create a react web site without an inline script you can set You can set INLINE_RUNTIME_CHUNK environment variable to false or you could add the script to the headder - For more information see https://medium.com/@nrshahri/csp-cra-324dd83fe5ff

To test the scripts you can generate a react website using the following commands run from the project root directory

```
npx create-react-app react-site
cd react-site
npm run build
```

To deploy the site you need to have a domain registered in route53. You can either register one (\$12) or transfer an existing registered domain to route53 from another provider. If you transfer a domain you will need to create a hosted zone in Route53 before running this script.

These scripts use the AWS CDK framework. Instructions for installing this can be found at https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html. Use version 1.22.0 or higher.

The script can be used to deploy one or many sites. Once you have deployed your site you can check that your header settings are correct using the tool at https://securityheaders.com/

To deploy a site the following code needs to be put in cdk/bin/cdk.ts

```
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
```

The script takes account domainName and subDomain from command line arguments (eg. -c account=12345678)- You can hard code these in the script if required. The 'assets' parameter is the build directory of the react site you are deploying. Obviously the site needs to be built using 'npm run build' before it is deployed.

If the subDomain is 'www' a redirect from the domain without the www prefix is automatically generated.

This stack must be deployed to us-east-1 as cloudfront distributions can only be deployed from that region.

To deploy the website use

```
cd cdk
cdk deploy  -c account=<your AWS account number> -c domainName=<your domain name> -c subDomain=www
```

You will be prompted to accept the changes (if you want to remove this you can use the option --require-approval never). The site will be deployed. To deploy updates - just repeat.

These scripts are distributed under an MIT licence. If you do find any problems please provide feedback by raising an issue.
