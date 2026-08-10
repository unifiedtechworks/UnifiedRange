# S3 Image Storage Plan

## Buckets Or Prefixes

Current private MVP paths:

```txt
private/equipment/{identityId}/{equipmentPassportId}/
private/targets/{identityId}/{rangeSessionId}/
```

Amplify Gen 2 Storage requires the owner token to be the path part immediately before the ending wildcard in the access rule. The backend rules therefore use `private/equipment/{entity_id}/*` and `private/targets/{entity_id}/*`.

The Phase 2C backend-only derivative namespace is:

```txt
public/passports/{publicPassportSnapshotId}/cover/{contentAddressedAssetId}.jpg
```

Phase 2C grants only `process-public-passport-image` get/write/delete access to this namespace. There is no guest, API-key, authenticated-browser, moderator, or admin Storage rule for it. Despite the `public/` name, the derivative is not publicly readable or renderable until a later delivery release establishes and tests that boundary. Normal clients must never receive public-prefix write access.

## Private User Images

Private setup images and target photos are readable and writable only by the signed-in owner through Amplify Storage owner-based access. Private images should not be served directly as public assets.

The current MVP stores:

- `EquipmentPassport.privateCoverPhotoKey`
- `TargetPhoto.storageKey`

Phase 2A registers successful uploads as owner-only `PrivateImageAsset` candidates. The candidate records store the private key, source relationship, protected Cognito `sub`, captured Storage identity, generated safe filename, browser-observed content type, and byte size. They have no public/API-key or moderator access. Candidate records alone do not authorize S3 reads or public processing.

The app validates the expected key shape and matches its Identity Pool segment and saved source record in the normal upload flow. Phase 2B repeats the security checks in a Lambda-backed IAM action. It accepts only the candidate id, derives the authenticated `cognitoIdentityId` from AppSync identity, re-reads the candidate and saved source, validates the exact key, and runs `HeadObject` to compare S3 MIME type and bytes with the allowlist and 8 MB limit.

The verifier receives S3 `get` access only on the existing `private/equipment/` and `private/targets/` owner path patterns. This permits `HeadObject` because S3 authorizes it through `GetObject`; the function does not download image bytes. It has no S3 write/delete permission and no public-prefix permission.

A `verified` result records a point-in-time source binding. It does not freeze the private object or prove that decoded image bytes are safe. The owner retains normal private object replacement/deletion access, so the Phase 2C processor repeats the source, key, and S3 metadata checks and then validates decoded bytes immediately before it creates a derivative. Range target verification currently binds to the owning Range Session and exact private object, not to one immutable `TargetPhoto` row; those candidates remain excluded from public processing.

## Public Sanitized Images

The Phase 2C Lambda may create a public-safe derivative only after its authenticated request includes explicit consent and all current ownership, public-account, username-reservation, source, and object checks pass. Public image delivery access is not enabled.

The current Public Passport publishing flow writes sanitized text/setup data only and does not expose private S3 keys or public images.

## Metadata Stripping

The Phase 2C processor decodes an eligible JPEG/PNG, applies orientation in pixel space, flattens transparency, resizes, and re-encodes a fresh JPEG. It then independently rejects derivatives containing EXIF/application metadata, ICC/application metadata, Photoshop/application metadata, or JPEG comments. The derivative is not publicly delivered in this phase.

## Future Workflow

1. User uploads a private image and S3 stores the private original.
2. The client links the image to its saved owner-scoped record and creates an unverified owner-only source candidate.
3. The Phase 2B verifier binds the protected Cognito identity, source owner, trusted IAM/Identity Pool identity, key path, and actual object metadata, then marks the candidate verified.
4. User previews the Public Passport and explicitly selects a backend-verified eligible source. **Publish without images** remains the default.
5. A Lambda decodes and re-encodes a sanitized derivative into the processor-only namespace. The Phase 2C backend foundation implements this step when its action is invoked directly with explicit consent.
6. The public snapshot references only the approved sanitized derivative. Phase 2C can set this guarded projection, but current clients do not invoke the action and current public pages do not read or render it.

Steps 1-3 and the backend-only processing foundation in steps 5-6 are implemented. Step 4's owner selection/safety UI, public delivery authorization, public URLs/rendering, target-photo support, removal/unpublish coordination, moderation actions, and lifecycle reconciliation are not implemented. The processor-only destination is not a public delivery path.
