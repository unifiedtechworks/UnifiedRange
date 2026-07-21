# Amplify Hosting Dev Deployment

## Purpose

This guide prepares UnifiedRange for a dev or staging deployment through AWS Amplify Hosting. It does not cover production promotion, public image publishing, destructive moderation workflows, or new product features.

## Assumptions

- AWS region: `us-west-2`.
- Deployment target: AWS Amplify Hosting connected to a dev or staging branch.
- Backend: Amplify Gen 2 resources in `amplify/` for Cognito, AppSync/DynamoDB, and private S3 storage.
- Frontend: Next.js build output from `npm run build`.
- Runtime config: `amplify_outputs.json` must match the backend environment used by the deployed frontend.

## Local Sandbox Development

Use the local sandbox when developing backend or frontend integration changes:

```bash
npm install
npm run amplify:typecheck
npm run amplify:sandbox
npm run dev
```

Use an explicit AWS profile when needed:

```powershell
$env:AWS_PROFILE="unifiedrange"
npm run amplify:sandbox
```

The sandbox generates or updates `amplify_outputs.json`. Restart the sandbox after schema, auth, or storage changes so AppSync and Storage authorization match the local code.

## Amplify Hosting Dev Branch

The repository includes `amplify.yml` for Amplify Hosting.

Expected build behavior:

- Backend phase installs dependencies with `npm ci`.
- Backend phase runs `npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID`.
- Frontend phase runs `npm run build`.
- Amplify Hosting serves the Next.js `.next` output.
- Build cache includes `node_modules` and `.next/cache`.

Manual AWS Console steps are still required for the first hosting setup:

1. Create or open the Amplify app in the intended AWS account.
2. Connect the dev or staging branch.
3. Confirm the app region is `us-west-2`.
4. Confirm the Amplify service role has permission to deploy the Gen 2 backend resources.
5. Confirm branch environment variables only contain non-secret deployment settings required by the app.
6. Trigger the first branch build from Amplify Hosting.

Do not deploy from Codex unless explicitly requested.

## `amplify_outputs.json`

`amplify_outputs.json` contains generated environment endpoints and identifiers. It should not contain passwords, private keys, or tokens, but it is environment-specific.

Current workflow:

- Keeping `amplify_outputs.json` committed is acceptable for a single intentional dev/staging target.
- Before deploying, confirm it points to the backend environment expected for the branch.
- If each branch should generate its own outputs during Amplify Hosting builds, do not hand-edit this file; let `ampx pipeline-deploy` refresh it for that branch.
- Do not commit local sandbox outputs over a shared staging output unless that is intentional.

## Ignored Local State

Confirmed ignored by `.gitignore`:

- `.amplify`
- `.env`
- `.env.local`
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`
- `.next`
- `node_modules`
- `*.tsbuildinfo`
- `*.pem`

Keep local sandbox state, secrets, and AWS credentials out of git.

## Environment Separation

Recommended progression:

1. Local sandbox for active development.
2. Amplify Hosting dev branch for shared testing.
3. Separate staging branch or app before production.
4. Separate AWS account for production when the product is ready.

Use clear branch naming and AWS tags so dev, staging, and future production resources are easy to identify.

## Manual Deployment Checklist

Before a dev or staging deployment:

1. Confirm the branch being deployed.
2. Confirm the AWS account and profile.
3. Confirm region is `us-west-2`.
4. Confirm the target environment is sandbox, dev, or staging.
5. Run `npm run amplify:typecheck`.
6. Run `npm run lint`.
7. Run `npm run build`.
8. Restart `npm run amplify:sandbox` locally if schema, auth, or storage changed.
9. Confirm `amplify_outputs.json` matches the target environment.
10. Confirm `.amplify`, local env files, secrets, and credentials are not committed.
11. Test auth sign-up/sign-in/sign-out.
12. Test private image upload for equipment and target photos.
13. Test public/private boundaries on Discover and Public Passport pages.
14. Confirm public pages do not expose private notes, private S3 keys, private images, lot numbers, purchase info, exact locations, owner private details, maintenance records, or readiness records.
15. Confirm Cognito `admin` or `moderator` users can see the moderation nav and pending report count, while normal signed-in users cannot access moderation tools.
16. Confirm signed-out demo behavior remains clearly labeled.

## Cost And Billing Notes

- Add AWS tags for app name, environment, and owner.
- Create an AWS Budget for the dev/staging account.
- Monitor Amplify Hosting build minutes, AppSync requests, DynamoDB usage, Cognito MAUs, S3 storage, and S3 requests.
- Use separate dev/staging and production environments.
- Consider a separate AWS account for production later.
- Delete unused sandbox environments and stale branches.

## Safety Boundary

Deployment must not add ballistic calculators, scope adjustment outputs, holdover recommendations, wind corrections, zeroing instructions, aiming guidance, or any feature that tells a user how to adjust or aim equipment.
