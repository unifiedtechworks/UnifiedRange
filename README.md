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

### Manual UserProfile Test

With the Amplify sandbox and dev server running:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Open `http://localhost:3000/settings`.
3. In the **UserProfile** card, create a profile with display name, username, bio, and privacy default.
4. Refresh the page and confirm the profile loads from AppSync.
5. Edit the profile and save.
6. Sign out and confirm the profile controls are hidden or disabled while mock product screens remain available.

### Manual Equipment Passport CRUD Test

With the Amplify sandbox and dev server running, restart or rerun the sandbox after pulling this change so AppSync includes the latest `EquipmentPassport` fields:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Open `http://localhost:3000/passports`.
3. Use **New passport** to create a saved Equipment Passport.
4. Refresh the passport list and confirm the saved account record persists above the demo data.
5. Open the saved passport detail page.
6. Use **Edit passport**, update the record, and save.
7. Refresh the detail page and confirm the edits persist.
8. Sign out and confirm the Equipment Passports area still shows clearly labeled demo data.

### Manual Projectiles / Ammo CRUD Test

With the Amplify sandbox and dev server running:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Open `http://localhost:3000/projectiles`.
3. Use **Add projectile / ammo** to create a saved Projectile / Ammo profile.
4. Refresh the projectile list and confirm the saved account record persists above the demo data.
5. Open the saved projectile detail page.
6. Use **Edit profile**, update the record, and save.
7. Refresh the detail page and confirm the edits persist.
8. Sign out and confirm the Projectiles / Ammo area still shows clearly labeled demo data.

### Manual Optics / Sights CRUD Test

With the Amplify sandbox and dev server running:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Open `http://localhost:3000/optics`.
3. Use **Add optic / sight** to create a saved Optic / Sight profile.
4. Refresh the optics list and confirm the saved account record persists above the demo data.
5. Open the saved optic detail page.
6. Use **Edit sight**, update the record, and save.
7. Refresh the detail page and confirm the edits persist.
8. Sign out and confirm the Optics / Sights area still shows clearly labeled demo data.

### Manual Range Sessions CRUD Test

With the Amplify sandbox and dev server running, restart or rerun the sandbox after pulling this change so AppSync includes `RangeSession.opticSightProfileId`:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Confirm you have at least one saved Equipment Passport, Projectile / Ammo profile, and Optic / Sight profile.
3. Open `http://localhost:3000/sessions`.
4. Use **Log range session** to create a saved Range Session linked to saved records.
5. Refresh the session list and confirm the saved account record persists above the demo data.
6. Open the saved session detail page.
7. Use **Edit session**, update the record, and save.
8. Refresh the detail page and confirm the edits persist.
9. Sign out and confirm the Range Sessions area still shows clearly labeled demo data.

### Manual Maintenance CRUD Test

With the Amplify sandbox and dev server running:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Confirm you have at least one saved Equipment Passport.
3. Open `http://localhost:3000/maintenance`.
4. Use **Add maintenance** to create a saved Maintenance record linked to a saved Equipment Passport.
5. Refresh the maintenance list and confirm the saved account record persists above the demo data.
6. Open the saved Maintenance detail page.
7. Use **Edit record**, update the record, and save.
8. Refresh the detail page and confirm the edits persist.
9. Sign out and confirm the Maintenance area still shows clearly labeled demo data.

### Manual Hunting Readiness CRUD Test

With the Amplify sandbox and dev server running:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Confirm you have at least one saved Equipment Passport.
3. Open `http://localhost:3000/readiness`.
4. Use **Create checklist** to create a saved Hunting Readiness checklist linked to a saved Equipment Passport.
5. Refresh the readiness list and confirm the saved account record persists above the demo data.
6. Open the saved Hunting Readiness detail page.
7. Use **Edit checklist**, update checklist items, and save.
8. Refresh the detail page and confirm the checked/unchecked state persists.
9. Sign out and confirm the Hunting Readiness area still shows clearly labeled demo data.

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
