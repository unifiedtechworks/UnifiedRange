# UnifiedRange

UnifiedRange is a privacy-first range logbook, setup passport, and outdoor readiness app for target shooters, hunters, and later archery users.

The product is centered on:

- Setup documentation
- Range-session logging
- Target photo history
- Ammo and gear tracking
- Maintenance records
- Hunting readiness
- Optional public setup discovery
- Community knowledge around real-world setups

## Important Safety Boundary

UnifiedRange is **not** a firing-solution calculator.

The app must not provide:

- Scope adjustment instructions
- Holdover/hold-under recommendations
- Wind hold recommendations
- Live shot guidance
- Zeroing instructions
- Tactical targeting guidance
- Instructions for manufacturing firearms, ammunition, explosives, or restricted accessories

The app may store user-entered logs, setup details, target photos, range notes, and historical performance records.

## Suggested MVP Stack

- Next.js
- TypeScript
- Tailwind CSS
- AWS Amplify Gen 2 for full-stack app structure
- Amazon Cognito for authentication
- AWS AppSync GraphQL for the API layer
- DynamoDB for app data
- S3 for target photos and setup images
- Lambda for public passport sanitization and image metadata stripping
- Amplify Hosting for deployment

A mobile app can come later using Expo/React Native against the same AWS backend.

## Local Development

Install dependencies and run the Next.js development server:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run build
```

## Amplify Gen 2 Foundation

The repository includes a minimal AWS Amplify Gen 2 backend draft in `amplify/`. The mock MVP still works without a deployed backend.

Declared AWS packages:

- `aws-amplify`
- `@aws-amplify/backend`
- `@aws-amplify/backend-cli`

Local setup for the backend foundation:

```bash
npm install
npm run amplify:typecheck
npm run amplify:sandbox
```

`npm run amplify:typecheck` validates the backend TypeScript contract without deploying anything. `npm run amplify:sandbox` uses the AWS profile from your shell or `.env` and generates `amplify_outputs.json` for local client configuration. You will need AWS credentials with permission to create the sandbox resources. No AWS Console work is required by the app itself, but you may need to configure an AWS profile before running the sandbox.

Current backend draft:

- Amazon Cognito email/password auth
- AWS AppSync GraphQL data layer
- DynamoDB-backed app models
- Publicly readable sanitized Public Passport snapshots
- Signed-in-only comments, reactions, and reports
- Owner-scoped private records for passports, projectiles/ammo, optics/sights, sessions, maintenance, and hunting checklists

The frontend keeps using mock data until the generated Amplify outputs are wired into live data flows. Do not gate the app behind Cognito or replace mock screens until the data boundary is implemented deliberately.

### Manual Auth Test

Start the app after the sandbox has generated `amplify_outputs.json`:

```bash
npm run dev
```

Then test Cognito auth:

1. Open `http://localhost:3000/auth/sign-in`.
2. Choose **Sign up** and create an account with an email and password that satisfies the Cognito password policy.
3. If Cognito sends an email code, enter it in the confirmation form.
4. Sign in with the confirmed email and password.
5. Verify the Auth Status card shows the signed-in email or username.
6. Use **Sign out** and verify the Auth Status card returns to signed-out state.

Dashboard and product screens continue to use mock data for signed-out and signed-in users.

## MVP App Structure

The initial web app uses:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Mock data in `src/data`
- Domain types in `src/types`
- Responsive app navigation for dashboard, passports, projectiles/ammo, optics/sights, range sessions, maintenance, hunting readiness, discovery, and settings

AWS backend integration is intentionally staged. Private records, AppSync authorization, DynamoDB access patterns, S3 image storage, Lambda metadata cleanup, and sanitized public setup snapshots should be connected at the data boundary before replacing mock data.

## Project Docs

Start here:

1. `docs/PRODUCT_VISION.md`
2. `docs/MVP_SCOPE.md`
3. `docs/SAFETY_AND_COMPLIANCE_BOUNDARIES.md`
4. `docs/DATA_MODEL.md`
5. `docs/USER_FLOWS.md`
6. `docs/SOCIAL_FEATURES.md`
7. `docs/MODERATION_POLICY.md`
8. `tasks/001-project-bootstrap.md`
