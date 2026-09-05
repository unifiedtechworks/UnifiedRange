# Phase 2F.1 Public Image Cleanup Testing

## Scope

This is a developer-only test path for the deployed owner-authorized `removePublicPassportImage` mutation. It accepts one `publicPassportSnapshotId`, detaches the current public image projection, marks a safely matched `PublicImageAsset` removed, and deletes only its canonical processed derivative. The sanitized text/setup snapshot remains published.

Phase 2F.1 is the backend contract and developer harness. Phase 2F.2 calls that same snapshot-id-only contract from an owner-only Public Preview remove button, and Phase 2F.3 calls it before owner-scoped snapshot deletion for derivative-aware Unpublish. Direct replacement, account-visibility cleanup, moderation actions, Discover images, public-profile images, galleries, and target-photo publishing remain unavailable.

## Deployment checkpoint — August 31, 2026

- `npm ci`, `npm run amplify:typecheck`, `npm run lint`, `npm run build`, and `git diff --check` passed before deployment.
- `npm run amplify:sandbox -- --once` synthesized, typechecked, and deployed the Phase 2F.1 schema, index, Lambda, resolver, IAM, and Storage permissions successfully to the configured developer sandbox.
- `amplify_outputs.json` was refreshed by the successful sandbox deployment.
- The manual positive, other-owner, missing-object, cleanup-pending, concurrency, log, and IAM checks below are still required. A hosted branch environment must receive its normal Amplify redeploy before hosted UI testing.

## Safety properties

The mutation and `scripts/remove-public-passport-image.mjs` harness:

- require a signed-in owner and one persistent public snapshot id;
- accept no public/private S3 key, URL, asset id, owner id, source record id, filename, destination path, or image bytes;
- resolve the current projection and ledger records on the backend;
- remove `publicImageAssetId`, `publicImageKey`, and `publicImageAltText` before object cleanup;
- never read, write, copy, or delete a private Storage prefix;
- delete only an exact `public/passports/{snapshotId}/cover/{publicImageAssetId}.jpg` derivative;
- leave the Equipment Passport and private original unchanged;
- return and print only bounded cleanup status/failure codes; and
- keep a removed ledger row's validated public key only while S3 cleanup needs a retry, then clear the key and alt text.

The mutation result is one of:

- `removed`: the projection is detached and canonical derivative cleanup completed;
- `not_attached`: no projection or retryable removed derivative is attached;
- `cleanup_pending`: delivery is detached, but bounded backend cleanup/manual reconciliation remains; or
- `failed`: ownership, request validation, or the detach transaction failed before a safe result was reached.

Known failure codes are `unauthorized`, `invalid_request`, `state_changed`, `projection_mismatch`, `storage_delete_failed`, and `unknown_error`. They must not contain technical record or Storage details.

## Prerequisites

1. Deploy the Phase 2F.1 schema, function, GSI, IAM, and Storage resource changes.
2. Regenerate or download a matching `amplify_outputs.json`.
3. Use a disposable hosted-development account and synthetic equipment photo.
4. Prepare a public account, public Equipment Passport, sanitized snapshot, verified `equipment_cover`, processed derivative, and working public-detail image.
5. Record only the public snapshot id from `/discover/passports/[publicPassportSnapshotId]`.

Do not use production records or an image containing serial numbers, exact locations, license plates, bystander faces, private documents, sensitive personal information, or real private data.

## Obtain a temporary owner ID token

Use a short-lived Cognito **ID token** for the same account that owns the snapshot. Treat it like a password:

- never commit it, save it in an `.env` file, paste it into documentation/chat/tickets, or capture it in screenshots;
- do not pass it as a command-line argument;
- enter it through a secure PowerShell prompt; and
- clear the environment variable immediately after testing.

The harness rejects access tokens, expired tokens, tokens from another configured pool/client, and unexpected AppSync endpoints before sending the request.

## Run the bounded harness

From the repository root in PowerShell:

```powershell
$env:UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID = Read-Host "Disposable PublicPassportSnapshot id"
$temporaryToken = Read-Host "Temporary Cognito ID token" -AsSecureString
$env:UNIFIEDRANGE_DEV_ID_TOKEN = [System.Net.NetworkCredential]::new("", $temporaryToken).Password
$env:UNIFIEDRANGE_CONFIRM_REMOVE_PUBLIC_IMAGE = "REMOVE_PUBLIC_PASSPORT_IMAGE_DERIVATIVE"
npm run test:public-image-cleanup
```

Expected successful output:

```json
{
  "cleanupStatus": "removed"
}
```

Run the same command again. The expected idempotent result is normally:

```json
{
  "cleanupStatus": "not_attached"
}
```

If the first call detached the projection but S3 deletion could not finish, expect only `cleanup_pending` and a bounded failure code. A later retry uses the snapshot-indexed removed ledger row; it does not require or accept the derivative key.

Clear temporary values after every run:

```powershell
Remove-Item Env:UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID -ErrorAction SilentlyContinue
Remove-Item Env:UNIFIEDRANGE_DEV_ID_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:UNIFIEDRANGE_CONFIRM_REMOVE_PUBLIC_IMAGE -ErrorAction SilentlyContinue
$temporaryToken = $null
```

## Validate the result

1. Refresh the public detail signed in and signed out. The sanitized text/setup remains visible and no image or private fallback appears.
2. Run `npm run test:public-image-resolver` for the same snapshot. It must return the generic unavailable result.
3. In authorized backend inspection, confirm the snapshot omits all three public image projection fields.
4. Confirm the safely matched ledger row is `removed`; after successful deletion, its public key and alt-text copy are absent.
5. Confirm the canonical derivative object is absent.
6. Confirm the private Equipment Passport, private cover key/object, `PrivateImageAsset`, verification status, and private display are unchanged.
7. Review Lambda logs. They may contain only fixed event names and bounded cleanup status/failure codes—not snapshot/asset/owner/source ids, keys, URLs, filenames, alt text, tokens, or image bytes.
8. Inspect IAM: the cleanup Lambda has attribute-limited snapshot/ledger reads and updates, GSI query access, and public-prefix delete only. It has no private-prefix, list, public write, or resolver permission.

## Negative and concurrency tests

Use isolated disposable fixtures:

- Call with a persistent foreign-owner snapshot id and a persistent nonexistent id. Both must return the same bounded unauthorized result.
- Call with a demo/sample-shaped id. The harness must reject it locally.
- Call on a text-only snapshot. It should return `not_attached` and leave the text snapshot unchanged apart from its backend concurrency timestamp.
- Remove an already-missing canonical derivative. S3 delete is idempotent and should complete safely.
- Create a partial/stale projection or mismatched key only in a disposable sandbox. The snapshot must detach; no mismatched object or foreign ledger row may be deleted. Expect `cleanup_pending/projection_mismatch` where manual reconciliation is required.
- Race processing and cleanup. If cleanup changes the snapshot after processing read it, processor finalization must fail with bounded `state_changed`, delete a newly written derivative, and never reattach the removed projection.
- Retry cleanup concurrently. Calls must converge on a detached snapshot and removed ledger state.
- Change the account to private before cleanup. The signed-in owner must still be able to remove the derivative.
- Attempt to use a target-photo candidate or key. The mutation accepts neither, has no target/private Storage permission, and must never alter target records or objects.

## Current limitation and next phase

Phase 2F.1 exposes the backend primitive and developer harness. Phase 2F.2 wires an explicit owner-facing remove action, and Phase 2F.3 safely runs the same cleanup before owner-scoped snapshot deletion. Immutable replacement generations with fresh consent, account-visibility/private-source hooks, scheduled reconciliation, and image moderation remain later work.
