# Phase 2C Public Image Processor Manual Testing

## Purpose and release boundary

This is a developer-only test path for `processPublicPassportImage`. It does not add a product control, public image delivery, or public rendering. The normal Public Preview flow still publishes text/setup data only.

The command creates a persistent processor-only JPEG derivative and may populate the guarded public image projection fields. There is no product removal/unpublish cleanup flow yet. Use a disposable synthetic fixture in a sandbox or hosted-development backend, never a production record or a sensitive photo.

The repository script accepts only:

- an authenticated Cognito ID token through a temporary environment variable;
- `publicPassportSnapshotId`;
- `privateImageAssetId`;
- optional public alt text; and
- an exact explicit-confirmation phrase.

It does not accept an owner ID, source record ID, private S3 key, destination key, bucket, URL, or image bytes. It reads the AppSync endpoint and Cognito identifiers from the repository's `amplify_outputs.json`, verifies the endpoint is the configured AWS AppSync host, checks that the short-lived ID token belongs to the configured Cognito user pool/client, and never prints the token or GraphQL error messages.

## Prerequisites

Use one signed-in standard developer account that owns all fixture records. Confirm:

1. `amplify_outputs.json` points to the backend under test.
2. The account has a valid immutable username reservation and public account visibility.
3. A saved Equipment Passport owned by that account is marked public.
4. The passport has a synthetic JPEG or PNG private cover under the processor's 6 MB limit.
5. The corresponding `PrivateImageAsset` is `verified` and has `sourceType=equipment_cover`.
6. A sanitized `PublicPassportSnapshot` exists for that same Equipment Passport.

Do not use an image containing a serial number, exact location, license plate, face, document, real personal data, or other sensitive content. Do not use a Range Session target candidate; the processor rejects `range_session_target` before reading S3 and has no target-prefix permission.

## Gather the two opaque IDs

Use an authenticated owner session or the authorized Amplify development data viewer. Copy only each record's `id`:

- On `/passports/[passportId]/public-preview`, inspect the owner-authenticated GraphQL response that loads the existing `PublicPassportSnapshot`. Match its `equipmentPassportId` to the disposable passport and copy the snapshot `id`.
- On the saved Equipment Passport page, inspect the owner-authenticated GraphQL response used by the private verification panel. Select the row whose `sourceType` is `equipment_cover`, whose `sourceRecordId` matches the disposable passport, and whose `bindingStatus` is `verified`; copy its `id`.

Do not copy, paste, screenshot, or record `storageKey`, `storageIdentityId`, signed URLs, private filenames, tokens, or complete private model rows. The script deliberately has no input for them.

## Obtain a temporary ID token

Sign in as the same fixture owner. Obtain the short-lived Cognito **ID token** from an authenticated development session or an AppSync request made by that session. Treat it like a password:

- never commit it, put it in an `.env` file, paste it into documentation/chat/tickets, or capture it in screenshots;
- do not pass it as a command-line argument;
- use the secure PowerShell prompt below so the token itself is not entered into shell history; and
- clear the environment variable immediately after the test.

The script rejects access tokens, expired tokens, tokens from another configured pool/client, and unexpected/non-AppSync endpoints before sending a request.

## Invoke the processor

In PowerShell from the repository root:

```powershell
$env:UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID = Read-Host "PublicPassportSnapshot id"
$env:UNIFIEDRANGE_PRIVATE_IMAGE_ASSET_ID = Read-Host "Verified PrivateImageAsset id"
$env:UNIFIEDRANGE_PUBLIC_IMAGE_ALT_TEXT = Read-Host "Optional public alt text"
$temporaryToken = Read-Host "Temporary Cognito ID token" -AsSecureString
$env:UNIFIEDRANGE_DEV_ID_TOKEN = [System.Net.NetworkCredential]::new("", $temporaryToken).Password
$env:UNIFIEDRANGE_CONFIRM_PROCESS_PUBLIC_IMAGE = "PROCESS_VERIFIED_EQUIPMENT_COVER"
npm run test:public-image-processor
```

The explicit confirmation acknowledges that the command will create or reuse a derivative and update backend-managed projection fields. The script always sends `consentConfirmed: true` only after that phrase is present.

Expected safe output shape:

```json
{
  "processingStatus": "ready",
  "publicImageAssetId": "img-opaque-backend-generated-value"
}
```

A validation or processor failure returns `failed` and a bounded `failureCode`; it must not return a private key, signed URL, owner ID, source record, destination key, filename, or image bytes. GraphQL error bodies are intentionally not printed.

Clear the temporary values whether the test passes or fails:

```powershell
Remove-Item Env:UNIFIEDRANGE_PUBLIC_PASSPORT_SNAPSHOT_ID -ErrorAction SilentlyContinue
Remove-Item Env:UNIFIEDRANGE_PRIVATE_IMAGE_ASSET_ID -ErrorAction SilentlyContinue
Remove-Item Env:UNIFIEDRANGE_PUBLIC_IMAGE_ALT_TEXT -ErrorAction SilentlyContinue
Remove-Item Env:UNIFIEDRANGE_DEV_ID_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:UNIFIEDRANGE_CONFIRM_PROCESS_PUBLIC_IMAGE -ErrorAction SilentlyContinue
$temporaryToken = $null
```

## Validate the result

With authorized backend inspection:

1. Confirm the owner-only `PublicImageAsset` is `ready` and stores only the public derivative key, safe alt text, source relationship IDs, processing state, and consent timestamp—never the private S3 key.
2. Confirm the `PublicPassportSnapshot` projection contains only `publicImageAssetId`, the processor-generated `publicImageKey`, and optional safe `publicImageAltText`.
3. Confirm the object is a JPEG no larger than 2 MB or 1600 pixels on its long edge and has no EXIF/GPS, ICC/application metadata, Photoshop/application metadata, JPEG comments, original filename, private path, or owner identifier.
4. Confirm a browser, signed-out/API-key client, ordinary authenticated client, moderator, and admin group membership alone cannot read/write the processor-only Storage path.
5. Confirm Discover, public profiles, public passport pages, and Public Preview still render no image and make no derivative request.

Use separate disposable fixtures to exercise `candidate_not_verified`, `unsupported_source`, `profile_not_public`, `object_not_found`, `unsupported_content_type`, `file_too_large`, `invalid_image`, `animated_image`, `dimensions_exceeded`, `storage_write_failed`, and `state_changed`. Missing/foreign snapshot or candidate IDs intentionally share `unauthorized` so the operation is not an ownership-existence oracle. Missing and inaccessible S3 objects intentionally share `object_not_found`; an object-scoped role without bucket-list access may receive `403` for an absent key, and the processor must not expose that distinction.

## Next phase

Phase 2D may add an owner-facing safety checklist, image selection, versioned consent, alt text, and **Publish without images** default only after the positive, negative, concurrency, metadata-removal, IAM, rollback, and hosted tests in this document pass. Phase 2D must not enable public delivery/rendering until its separate release gates are complete.
