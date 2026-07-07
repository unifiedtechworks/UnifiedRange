# Tech Stack Recommendation

## Recommended MVP Stack

- Next.js
- TypeScript
- Tailwind CSS
- AWS Amplify Gen 2
- Amazon Cognito
- AWS AppSync GraphQL
- DynamoDB
- S3
- Lambda
- Amplify Hosting

## Why This Stack

### Next.js

Good for fast web app development, routing, server components, API routes, and eventual SEO-friendly public pages.

### TypeScript

Strong typing will help keep data models clean as the app expands from rifles to pistols and archery.

### Tailwind CSS

Fast UI styling and responsive layout.

### AWS Amplify Gen 2

Provides an AWS-native full-stack workflow for defining auth, APIs, data, storage, functions, and hosting alongside the app.

### Amazon Cognito

Handles sign-up, sign-in, user identity, and account-level access controls.

### AWS AppSync GraphQL

Provides the API layer for app screens, mobile clients, and future public discovery queries.

### DynamoDB

Stores app records such as equipment passports, projectile profiles, range sessions, maintenance logs, readiness checklists, comments, reactions, and reports.

### S3

Stores private target photos, setup images, and sanitized public media assets.

### Lambda

Runs custom workflows such as public passport sanitization, image metadata stripping, report handling, and other backend jobs that should not live in the client.

### Amplify Hosting

Deploys the Next.js web app with an AWS-native hosting path.

## Architecture Direction

Start as a web app.

Later, build a mobile app with Expo/React Native using the same AWS backend.

## Suggested App Structure

```txt
src/
  app/
    dashboard/
    passports/
    projectiles/
    optics/
    sessions/
    maintenance/
    readiness/
    discover/
    settings/
  components/
  lib/
  types/
  data/
  styles/
```

## First Implementation Principle

Build the UI with mock data first.

After screens and data models feel right, wire up Cognito auth, AppSync GraphQL operations, DynamoDB tables, S3 storage, Lambda workflows, and Amplify Hosting.
