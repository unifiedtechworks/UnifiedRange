# Task 006: AWS Backend Planning

## Goal

Prepare for AWS-native backend integration without wiring it prematurely.

## Requirements

1. Draft an Amplify Gen 2 backend plan based on `docs/DATA_MODEL.md`.
2. Plan Amazon Cognito authentication and user identity boundaries.
3. Plan AWS AppSync GraphQL schema, queries, mutations, and authorization rules.
4. Plan DynamoDB table or access-pattern strategy for private app data and public discovery snapshots.
5. Plan S3 buckets for private target photos, setup images, and sanitized public media.
6. Plan Lambda workflows for public passport sanitization and image metadata stripping before public images are saved/displayed.
7. Do not implement a live backend until UI/model structure stabilizes.

## Acceptance Criteria

- Create `docs/AWS_BACKEND_PLAN.md`.
- Include Cognito auth and AppSync authorization notes.
- Include DynamoDB access-pattern notes.
- Include private/public S3 storage strategy.
- Include Lambda workflow notes for sanitization and metadata stripping.
