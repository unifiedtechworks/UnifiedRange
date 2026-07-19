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
- UserProfile onboarding with permanent usernames and optional profile location fields
- UsernameReservation records for global username uniqueness without exposing private profiles
- UserProfile-backed account/privacy settings for public-sharing defaults
- Publicly readable sanitized Public Passport snapshots
- Publicly readable reaction counts, with signed-in-only reaction actions
- Signed-in-only comments and reports
- Owner-scoped private records for passports, projectiles/ammo, optics/sights, sessions, maintenance, and hunting checklists
- Private S3 storage paths for signed-in user equipment/setup images and target photos

The frontend now uses AppSync-backed saved account data for the main private record slices while keeping clearly labeled demo data available for signed-out browsing. Do not gate the full app behind Cognito unless that product decision is made deliberately.

Useful local commands:

```bash
npm run amplify:typecheck
npm run lint
npm run build
npm run amplify:sandbox
npm run dev
```

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

Restart or redeploy the Amplify backend after pulling this change so AppSync includes the latest `UserProfile` fields.

With the Amplify sandbox and dev server running:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. If no profile exists, confirm the app guides you to `http://localhost:3000/profile/setup`.
3. Create a profile with permanent username, display name, optional first/last name, city, state, bio, and privacy default.
4. Refresh the page and confirm the profile loads from AppSync.
5. Open `http://localhost:3000/profile/edit` and confirm username is read-only.
6. Edit display name, city, state, bio, and privacy default, then save.
7. If testing first/last name changes, confirm the UI prevents another legal-name change for about 30 days.
8. Sign out and confirm public/demo screens remain available.

Username uniqueness is enforced through `UsernameReservation` records keyed by normalized username. The reservation stores no private profile details. If a reservation succeeds but profile creation fails, return to setup with the same username to recover.

### Manual Username Reservation Test

Restart or redeploy the Amplify backend after pulling this change so AppSync includes the new `UsernameReservation` model.

With the Amplify sandbox and dev server running:

1. Sign in as a new user.
2. Open `http://localhost:3000/profile/setup`.
3. Try an invalid username and confirm format validation blocks it.
4. Try an available username and confirm the form shows **Username available**.
5. Complete profile setup and confirm the username persists.
6. Sign out and sign in as a second user.
7. Try the first user's username and confirm **That username is already taken**.
8. Open `/profile/edit` and confirm username is read-only.

### Manual Privacy Settings Test

Restart or redeploy the Amplify backend after pulling this change so AppSync includes the latest `UserProfile` privacy preference fields.

With the Amplify sandbox and dev server running:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Complete profile setup if prompted.
3. Open `http://localhost:3000/settings/privacy`.
4. Change account visibility, default passport visibility, and public-sharing privacy toggles.
5. Save and confirm the success message.
6. Refresh the page and confirm the settings persist from AppSync.
7. Sign out and confirm private settings are not visible; the page should show an explanation and sign-in prompt.

Privacy settings remain owner-scoped account data. Public publishing still creates sanitized snapshots and must not expose private notes, exact locations, ammo lot numbers, purchase details, private images, or image metadata.

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

### Manual Private Image Upload Test

Restart or rerun the Amplify sandbox after pulling this change so the sandbox includes the new Storage resource and image-key schema fields.

Private image storage uses Amplify-valid owner-scoped prefixes:

- `private/equipment/{identityId}/{equipmentPassportId}/`
- `private/targets/{identityId}/{rangeSessionId}/`

With the Amplify sandbox and dev server running:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Open a saved Equipment Passport detail page.
3. Upload a private setup photo using JPG, JPEG, PNG, or WEBP under 8MB.
4. Refresh and confirm the private setup photo still displays.
5. Open a saved Range Session detail page.
6. Upload a private target photo.
7. Refresh and confirm the private target photo still displays.
8. Sign out and confirm private upload controls are not available.
9. Confirm demo records still use demo image or placeholder behavior.

Private images are private by default. Public sharing will require a separate sanitized publishing step later. Do not upload images containing serial numbers, exact locations, license plates, or sensitive personal info unless you intend to keep them private. Metadata stripping is not implemented in this slice and is required before public publishing.

### Manual Public Passport Publishing Test

With the Amplify sandbox and dev server running:

1. Sign in at `http://localhost:3000/auth/sign-in`.
2. Open a saved Equipment Passport.
3. Use **Public preview**.
4. Confirm the sanitized preview excludes private notes, private image keys, private setup photos, purchase details, exact locations, and sensitive personal info.
5. Publish the public snapshot.
6. Open `http://localhost:3000/discover` and confirm the public snapshot appears.
7. Open the public detail page and confirm only sanitized setup fields display.
8. Sign out and confirm Discover and the public detail page still work.
9. If testing unpublish, return to the signed-in preview page, unpublish, and confirm the snapshot disappears from Discover.

This public publishing slice publishes sanitized text/setup data only. Private S3 images are not exposed publicly.

### Manual Public Social Interaction Test

Restart or rerun the Amplify sandbox after pulling this change so AppSync includes public reaction reads and comment report targets.

With the Amplify sandbox and dev server running:

1. Sign in and publish or confirm a public passport snapshot exists.
2. Open `http://localhost:3000/discover/passports/[publicPassportId]` while signed out and confirm the public page and reaction counts load.
3. Sign in and add a reaction.
4. Refresh and confirm the reaction count persists.
5. Add a comment and refresh to confirm it persists.
6. Report the public passport snapshot and confirm the success message.
7. Report a comment and confirm the success message.
8. Sign out and confirm signed-out users can still view the public page but are prompted to sign in before reacting, commenting, or reporting.

Comments, reactions, and reports are scoped to sanitized public passport snapshots. This slice does not add public images, feeds, follows, notifications, direct messages, marketplaces, or a moderation dashboard.

### Production-Readiness Manual Checklist

Run this checklist before promoting a sandbox or production environment:

1. Auth: sign up, confirm if required, sign in, refresh, and sign out.
2. Profile: open `/profile/setup` for a new user, create UserProfile, verify username reservation blocks duplicates, verify username is permanent on `/profile/edit`, then verify edits persist after refresh.
3. Privacy settings: open `/settings/privacy`, change settings, save, refresh, and confirm they persist.
4. Equipment Passports: create, view, edit, refresh, and confirm signed-out demo behavior.
5. Projectiles / Ammo: create, view, edit, refresh, and confirm signed-out demo behavior.
6. Optics / Sights: create, view, edit, refresh, and confirm signed-out demo behavior.
7. Range Sessions: create a session linked to saved passport/projectile/optic records, edit, refresh, and confirm demo fallback.
8. Maintenance: create an entry linked to a saved Equipment Passport, edit, refresh, and confirm demo fallback.
9. Hunting Readiness: create a checklist linked to a saved Equipment Passport, edit checked items, refresh, and confirm demo fallback.
10. Private images: upload a private equipment photo and private target photo, refresh, and confirm signed-out users cannot access upload controls.
11. Public publishing: preview, publish, view in Discover, update, and unpublish a sanitized Public Passport snapshot.
12. Discover: confirm signed-out and signed-in users can view sanitized public snapshots only.
13. Reactions/comments/reports: confirm reaction counts load or gracefully show unavailable, signed-in users can react/comment/report, and signed-out users see sign-in prompts for actions.
14. Public/private boundary: confirm public pages do not show private notes, private S3 keys, target photos, maintenance records, readiness records, ammo lot numbers, purchase info, exact locations, owner private details, or image metadata.
15. Demo behavior: sign out and confirm mock/demo data remains clearly labeled across Dashboard and all major sections.

### Hosted Dev Smoke Test Checklist

Use this checklist against the Amplify Hosting dev URL after each hosted deployment:

1. Auth: open `/auth/sign-in`, sign up or sign in, refresh, and sign out.
2. Dashboard: confirm signed-in users see saved account counts and signed-out users see clearly labeled demo data.
3. Profile: open `/profile/setup` for new users or `/profile/edit` for existing users, refresh, and confirm UserProfile persists with username reservation and username read-only after setup.
4. Privacy settings: open `/settings/privacy`, change settings, save, refresh, and confirm private settings are hidden after sign-out.
5. Equipment Passports: create, view, edit, refresh, and confirm private setup photo upload works for a saved passport.
6. Projectiles / Ammo, Optics / Sights, Range Sessions, Maintenance, and Hunting Readiness: create, view, edit, refresh, and confirm each saved record persists.
7. Private images: upload a saved Equipment Passport setup photo and a saved Range Session target photo, then sign out and confirm upload controls are not available.
8. Public publishing: open a saved passport Public Preview, publish or update a sanitized Public Passport snapshot, view it in Discover, and unpublish if needed.
9. Discover: confirm public detail pages show sanitized fields only and do not expose private notes, private S3 keys, private images, target photos, maintenance records, readiness records, ammo lot numbers, purchase details, exact locations, owner private details, or image metadata.
10. Social actions: signed-in users can react, comment, and report; signed-out users can view public pages and see sign-in prompts for actions.
11. Failure states: if public snapshots or reaction counts are unavailable, the page should remain usable with a quiet fallback message.

### Before Deploying

See `docs/AMPLIFY_HOSTING_DEPLOYMENT.md` for the Amplify Hosting dev/staging runbook. Expected AWS region is `us-west-2`.

1. Confirm the intended AWS profile and environment.
2. Confirm whether you are using a local sandbox or a production Amplify environment.
3. Confirm the deployment branch and Amplify Hosting app are pointed at the intended backend environment.
4. Restart `npm run amplify:sandbox` after schema or storage changes, including public Reaction read authorization changes.
5. Confirm no secrets, tokens, passwords, private keys, account IDs, or local `.env` files are committed.
6. Confirm `amplify_outputs.json` matches the target environment you intend the frontend to use.
7. Confirm `.amplify` remains ignored by git.
8. Run `npm run amplify:typecheck`, `npm run lint`, and `npm run build`.
9. Manually test public/private data boundaries before sharing a deployed URL.

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
8. `docs/AMPLIFY_HOSTING_DEPLOYMENT.md`
9. `tasks/001-project-bootstrap.md`
