# Phase 2E.1 Delivery Resolver Testing

## Scope

This is a developer-only test path for the deployed `resolvePublicPassportImage` public/API-key query. It verifies that the resolver accepts only a persistent `publicPassportSnapshotId`, returns the bounded public contract, issues a 60-second URL for an eligible processed derivative, and serves a bounded JPEG with `private, no-store, max-age=0` response headers.

It does not add a product image component, call the resolver from a public page, expose direct Amplify Storage access, process target photos, or enable public image publishing outside the existing owner-only Public Preview preparation flow.

## Safety properties

The harness in `scripts/resolve-public-passport-image.mjs`:

- requires only `UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID`;
- reads the deployed AppSync endpoint and normal API-key configuration from the local `amplify_outputs.json`;
- validates the endpoint before sending the API key;
- sends no Cognito token and requires no signed-in session;
- sends no S3 key, public asset ID, owner ID, source record ID, path, URL, filename, or image bytes;
- validates the resolver response allowlist before using it;
- validates HTTPS, the configured S3 bucket/Region host, the exact public derivative path shape, and the 60-second signed lifetime;
- fetches the derivative once to verify JPEG bytes and the non-cacheable response headers; and
- prints only a bounded summary. It never prints the API key, delivery URL, public key, alt text, snapshot ID, image bytes, GraphQL error messages, or response body.

Do not commit a copied API key, token, resolver response, or delivery URL. `amplify_outputs.json` is the normal generated Amplify client configuration and must continue to follow the repository's existing handling policy.

## Prerequisites

1. Deploy the current Amplify backend so the hardened resolver Lambda is active.
2. Generate or download an `amplify_outputs.json` that matches that deployment.
3. Prepare disposable hosted-development data through the existing owner flow:
   - public account visibility;
   - a saved Equipment Passport marked public;
   - a saved, published Public Passport snapshot;
   - one verified JPEG/PNG `equipment_cover` candidate; and
   - a Phase 2C derivative whose `PublicImageAsset` is `ready` and whose snapshot projection is current.
4. Obtain the snapshot ID from the saved public detail route `/discover/passports/[publicPassportSnapshotId]`. Use only the route's persistent snapshot ID. Do not use a private Equipment Passport ID, candidate ID, key, URL, or a demo/sample ID.

## Run the bounded harness

From the repository root in PowerShell:

```powershell
$env:UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID = "replace-with-saved-public-snapshot-id"
npm run test:public-image-resolver
```

An eligible result prints a summary shaped like:

```json
{
  "status": "available",
  "cacheSeconds": 0,
  "urlValidated": true,
  "urlExpiresInSeconds": 60,
  "altTextPresent": true,
  "altTextLength": 28,
  "deliveryFetchValidated": true,
  "responseCacheHeadersValidated": true,
  "derivativeSizeBytes": 123456
}
```

The exact alt-text length and derivative size vary. Neither value reveals the text, filename, key, URL, owner, or source record.

A missing or ineligible persistent ID prints only:

```json
{
  "status": "unavailable",
  "failureCode": "unavailable",
  "cacheSeconds": 0,
  "urlPresent": false,
  "altTextPresent": false,
  "expiresAtPresent": false
}
```

Invalid, demo-shaped, or sample-shaped IDs are rejected locally and are not sent.

## Negative and boundary tests

Use disposable sandbox/hosted-development records and repeat the same command for each state:

- a persistent but nonexistent snapshot ID;
- a snapshot with no image projection;
- a non-ready, failed, or removed public image asset;
- a mismatched snapshot/asset/source relationship;
- an account whose visibility is private;
- an Equipment Passport whose public flag is false;
- an unsafe, missing, or mismatched alt-text projection;
- a missing, non-JPEG, empty, or oversized derivative object; and
- any non-`equipment_cover` source, including every target-photo source.

Every case must produce the same bounded unavailable contract. The harness must never reveal why a particular public record is unavailable.

Use AWS IAM inspection separately to confirm the resolver role has attribute-limited DynamoDB reads, `GetObject`/`HeadObject` only for `public/passports/{snapshot_id}/cover/*`, and no private-prefix, list, write, copy, tag, ACL, or delete permissions.

Review Lambda logs separately. Allowed fields are fixed event names, bounded internal failure categories, URL lifetime, and cache seconds. Logs must not contain snapshot, asset, owner, source, profile, or Storage IDs; private/public keys; URLs; alt text; filenames; tokens; image bytes; or raw AWS errors.

## Product boundary after testing

Passing this harness approves only the resolver primitive. Phase 2E.2 now uses that primitive on saved Public Passport detail only; Discover and public profiles remain image-free. Detail rendering still requires its own signed-in/signed-out, expiry/caching, visibility, stale-response, private-boundary, and accessibility tests. Do not expand surfaces or approve a broader release until backend-controlled removal, derivative-aware unpublish, hosted adversarial checks, and the remaining lifecycle gates are complete.
