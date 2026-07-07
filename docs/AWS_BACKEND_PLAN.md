# AWS Backend Plan

## Goal

Plan an AWS-native backend for UnifiedRange without implementing it yet. The app remains mock-data-only until a later task.

## Services

- AWS Amplify Gen 2: full-stack project definition and deployment workflow.
- Amazon Cognito: sign-up, sign-in, identity, and user groups.
- AWS AppSync GraphQL: API layer for web and future mobile clients.
- DynamoDB: private app data and public sanitized discovery records.
- S3: images and file storage.
- Lambda: sanitization, metadata stripping, moderation helpers, and custom workflows.
- Amplify Hosting: deploy the Next.js web app.

## Data Ownership

Private data is user-owned and scoped by Cognito identity. Equipment Passports, Projectiles / Ammo, Optics / Sights, Range Sessions, Maintenance, Hunting Readiness, target photos, private notes, and inventory details are readable and writable only by their owner.

Public data is a separate sanitized snapshot. Public Passport records should never directly expose private records. A public snapshot stores only allowlisted fields for Setup Discovery.

## Public Sharing Flow

1. User creates a private Equipment Passport.
2. User opens public preview.
3. App generates a sanitized public snapshot.
4. User confirms publish.
5. Public snapshot is discoverable.
6. Private data remains private.

## Authorization Plan

- Users can read/write their own private data.
- Public snapshots are readable by everyone.
- Only owners can publish/unpublish their own snapshots.
- Comments and reactions require signed-in users.
- Reports require signed-in users.
- Admin moderation is future work.

## Safety Boundary

The backend must support logging, documentation, readiness, and setup discovery only. It must not compute firing solutions, output instructions for equipment adjustment, or provide aiming guidance.
