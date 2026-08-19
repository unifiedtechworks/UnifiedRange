# Public Image Publishing Backend Design

## Status

Phase 1 data guardrails were added on August 5, 2026. Phase 2A private source registration, Phase 2B trusted private source verification, and the Phase 2C backend derivative foundation were added on August 9, 2026. The schema now contains a non-public, client-read-only `PublicImageAsset` workflow ledger, backend-reserved public image projection fields, an owner-only `PrivateImageAsset` candidate registry, an IAM-authorized verification operation, and an authenticated processing operation. These backend changes require an Amplify redeploy.

Public image publishing is still not available. Phase 2C adds a backend-only action that can turn an explicitly consented, verified Equipment Passport cover candidate into a bounded metadata-free JPEG derivative and guarded public snapshot projection. There is no app selection/consent UI, client invocation, public delivery/read rule, public URL, rendering, target-photo processing, removal flow, or automatic publishing. The processor-only `public/passports/{snapshotId}/cover/` namespace is deliberately not readable by browser or guest identities.

The browser may create and read its own immutable `PrivateImageAsset` candidate records after a successful private upload. Those rows remain private registration hints until `verifyPrivateImageAsset` independently marks them `verified`. Normal clients cannot write `bindingStatus`, `bindingFailureCode`, or `verifiedAt`. The Phase 2C processor rejects every candidate that is missing `verified` status and repeats the current source/object checks because verification proves source binding only and does not prove decoded image safety or metadata removal.

UnifiedRange's current app flows publish sanitized text/setup snapshots only. Equipment Passport setup photos and Range Session target photos remain owner-private. Public pages must continue to render no image until the later selection, delivery, rendering, removal, and moderation phases are implemented and tested.

This design refines the product boundary in [PUBLIC_IMAGE_PUBLISHING_PLAN.md](PUBLIC_IMAGE_PUBLISHING_PLAN.md) into an implementable AWS Amplify Gen 2 backend contract.

### Implemented foundation

- `PublicImageAssetSourceType` currently permits only `equipment_cover`; target photos remain excluded.
- `PublicImageAssetStatus` contains `draft`, `processing`, `ready`, `failed`, and `removed`.
- `PublicImageAsset` stores no private S3 key and is not API-key readable. Owners may read their own future workflow records, but current clients cannot create, update, or delete them.
- `PublicPassportSnapshot.publicImageAssetId`, `publicImageKey`, and `publicImageAltText` are readable by the owner and public API, but client create/update authorization is intentionally absent.
- The legacy `PublicPassportSnapshot.coverPhotoUrl` field received the same create/update guard and is no longer mapped into saved public UI data.
- `buildPublicPassportSnapshotInput` continues to omit every image field.
- `amplify/storage/resource.ts` grants the verifier read access only to the two existing private prefixes. It grants the processor private-equipment read plus get/write/delete on the exact derivative namespace. No client or guest read/write rule exists for that namespace.
- `PrivateImageAsset` now records owner-private upload candidates for Equipment Passport covers and Range Session target photos. Its key, filename, type, size, and source relationship have no public/API-key access.
- The upload client performs defense-in-depth validation of the saved source owner, Cognito owner aliases, source-record path segment, Storage identity segment, generated filename, type, and size before registration.
- Browser validation does not establish trust. The Phase 2B Lambda receives only a candidate id, derives the caller's Identity Pool identity from AppSync IAM resolver identity, binds the protected Cognito `sub`, re-reads the saved source, validates the exact path and object metadata, and alone writes bounded verification fields.
- Legacy candidates without the protected `ownerSub` and Storage identity bridge fields fail closed. Re-upload creates a candidate eligible for verification; the verifier does not backfill identity data from request input.
- The owner-only private panels may request verification and display a bounded status/failure message. The action does not expose a key, read image bytes, copy an object, or publish anything.
- `processPublicPassportImage` accepts only snapshot/candidate ids, bounded alt text, and required consent. It rejects unverified, target-photo, demo/sample, mismatched-owner, private-account, unresolved-username, stale-source, missing-object, unsupported-format, malformed, animated, oversized, or metadata-mismatched inputs with bounded failures.
- The processor accepts JPEG and PNG up to 6 MB and 12 megapixels, applies EXIF orientation in pixel space, flattens transparency, scales to at most 1600 pixels, emits a JPEG no larger than 2 MB, and independently rejects metadata-bearing JPEG segments in the output.
- The first implementation uses the portable JavaScript `image-js`/`jpeg-js` decode-and-re-encode path so the Amplify Lambda bundle does not depend on an architecture-specific native binary. Its strict signature/header checks and output inspection remain authoritative release gates.
- A content-addressed backend key prevents source names or private identifiers from reaching the filename. Conditional/transactional finalization updates only the ledger and guarded image projection fields, and a newly written derivative is deleted when finalization loses a state race.
- DynamoDB finalization permissions use the transaction's underlying attribute-limited `ConditionCheckItem` and `UpdateItem` actions, constrained by `dynamodb:EnclosingOperation=TransactWriteItems`; there is no broad transaction/table mutation grant.
- Failure bookkeeping is conditioned on the exact active processing attempt, and snapshot finalization compares the previously observed asset id, derivative key, and alt text. A failed or stale invocation cannot overwrite a newer ledger/projection state.
- Missing and inaccessible S3 objects share the bounded `object_not_found` result because S3 can return `403` for a missing key when least-privilege roles intentionally lack bucket-list permission. This avoids a key-existence oracle while allowing an unavailable cached derivative to follow the normal rewrite/rollback path.
- Structured Lambda logs contain only fixed event names, bounded failure codes, and non-sensitive output type/size. They omit workflow IDs, owner identity, private/public keys, filenames, record content, tokens, URLs, and image bytes.
- Current Public Preview payloads and all public UI continue to ignore image projection fields, so normal app publishing remains text/setup only.
- The explicit-confirmation developer harness in [PHASE_2C_PROCESSOR_TESTING.md](PHASE_2C_PROCESSOR_TESTING.md) invokes the deployed mutation with only the two opaque IDs and optional alt text. It validates the configured AppSync/Cognito target and never accepts or prints a Storage key.

## Recommended decisions

| Concern | Recommendation |
| --- | --- |
| First supported source | One Equipment Passport private cover photo. Keep target photos ineligible in the first release. |
| Public destination | A separate public-derivative bucket when practical; otherwise a strictly isolated `public/passports/` prefix. |
| Public object name | Content-addressed backend key such as `public/passports/{snapshotId}/cover/{assetId}.jpg`, not the private filename and not a fixed mutable overwrite. |
| Processing entry point | An authenticated, Lambda-backed AppSync action that accepts record IDs and consent data, never an arbitrary S3 key or URL. |
| Image processing | Decode, auto-orient, constrain dimensions, and re-encode server-side. Fail closed if decoding or metadata removal cannot be proven. |
| Public data shape | Server-managed public projection fields on `PublicPassportSnapshot`, backed by a non-public `PublicImageAsset` workflow ledger. |
| Public rendering | Read only the derivative key and alt text projected onto the public snapshot. Never fall back to the private original. |
| Removal | Detach the public reference first, then delete the derivative asynchronously and idempotently. Preserve the private original. |
| Existing private images | Treat legacy client-written image-key fields as untrusted until ownership is validated through a trusted image registration/finalization path. Re-upload may be required for the first release. |

## Existing implementation boundary

### Private source paths

The browser currently uploads through `src/lib/privateImageStorage.ts` to:

```text
private/equipment/{identityId}/{equipmentPassportId}/{generatedFilename}
private/targets/{identityId}/{rangeSessionId}/{generatedFilename}
```

Amplify Storage authorizes these patterns:

```text
private/equipment/{entity_id}/*
private/targets/{entity_id}/*
```

`{entity_id}` is the authenticated Cognito Identity Pool identity used by Amplify Storage. It is not necessarily the same value as the Cognito user-pool username currently stored in model `ownerId` fields.

Private model references are:

- `EquipmentPassport.privateCoverPhotoKey`
- `TargetPhoto.storageKey` and the current compatibility value in `TargetPhoto.imageUrl`

`EquipmentPassportPrivatePhotoPanel` and `RangeSessionPrivateTargetPhotoPanel` save these private keys only after an owner-scoped upload. `getPrivateImageUrl` returns a short-lived private URL for the signed-in owner.

These private keys, URLs, filenames, objects, and identity path segments must never be:

- accepted as public image references;
- copied into a public API response;
- rendered by Discover, `/u/[username]`, or a public passport page;
- written to browser-visible processing errors, analytics, or logs;
- used as public alt text or public object names.

### Current public snapshot

`PublicPassportSnapshot` is owner-written and API-key readable. `buildPublicPassportSnapshotInput` currently omits all private image keys. `PublicPassportPreview` says private images are not published, and `PublicPassportDetail` renders sanitized setup fields only.

The existing `coverPhotoUrl` field must not be populated from `privateCoverPhotoKey` or a signed private URL. Before implementing this design, either deprecate `coverPhotoUrl` or define it as a backend-generated public derivative only. The recommended contract uses a public key rather than accepting an arbitrary URL.

## Threat model and trust boundary

The processing Lambda is a privileged boundary because it can read private objects and write public ones. It must protect against:

- an owner asking the function to publish another user's private object;
- a caller supplying an arbitrary S3 key, URL, bucket, or destination;
- a client-modified `privateCoverPhotoKey` pointing outside the caller's trusted private image registry;
- private-key, signed-URL, filename, identity-ID, or metadata leakage;
- malformed, oversized, animated, polyglot, or decompression-bomb inputs;
- EXIF/GPS, embedded thumbnails, XMP/IPTC, comments, device IDs, and timestamps surviving processing;
- duplicate jobs, retries, replacement races, and stale snapshot updates;
- public objects remaining available after unpublish, moderation removal, or account deletion;
- a database reference pointing to a missing object, or an orphan object with no database reference;
- public pages falling back to a private source when a derivative is unavailable.

Client-side validation and consent copy improve usability but are not security controls. Every ownership, content, state, and destination check must be repeated by the backend.

## Storage design

### Recommended public paths

Use versioned derivative keys:

```text
public/passports/{publicPassportSnapshotId}/cover/{publicImageAssetId}.jpg
public/passports/{publicPassportSnapshotId}/gallery/{publicImageAssetId}.webp
```

Only the `cover` path is in scope for the first release. `gallery` reserves a stable future namespace; it must not be enabled until multiple-image consent, ordering, moderation, and cleanup ship together.

Prefer a random, backend-generated `publicImageAssetId`. A fixed `cover.webp` is simpler, but versioned names are safer because they:

- avoid stale CDN/browser caches when replacing an image;
- allow the database reference to switch atomically after the new derivative is ready;
- make rollback and orphan reconciliation deterministic;
- avoid overwriting a currently visible object during a failed replacement.

Never include the source filename, username, Cognito username/sub, S3 identity ID, private record ID, caption, or user text in the public filename.

### Bucket choice

The preferred production design is a separate public-derivative Storage resource or S3 bucket:

- private bucket: owner-scoped browser read/write plus processor read;
- public derivative bucket: processor write/delete plus public delivery read;
- optional private staging prefix: processor-only, never publicly readable.

A separate bucket provides a clearer IAM and lifecycle boundary and reduces the risk that a public-prefix rule accidentally broadens private access. If Amplify constraints make a shared bucket preferable, keep `private/` and `public/` rules separate and test that guest/public principals cannot list, read, write, copy, or delete anything under `private/`.

Do not make the whole bucket public. Public delivery should expose only derivative objects, through either:

- guest read access restricted to the derivative prefix; or
- CloudFront with Origin Access Control while S3 Block Public Access remains enabled.

CloudFront is the stronger production option for cache invalidation, response headers, and keeping the bucket non-public. The application should store a derivative key, not a permanent client-supplied URL.

### Object settings

Public derivative writes should set only backend-controlled metadata:

- `Content-Type: image/jpeg` for the implemented Phase 2C output;
- a conservative `Cache-Control` suitable for versioned objects;
- no original filename, content disposition, user metadata, tags copied from the private object, or source-key metadata;
- encryption at rest using the bucket default;
- lifecycle rules for failed staging objects and orphan cleanup.

## Backend components

The backend design contains or still needs:

1. `processPublicPassportImage` Lambda for explicit owner-requested processing. **Implemented as the backend-only Phase 2C foundation.**
2. `removePublicPassportImage` Lambda action, or a removal command handled by the same function. **Not implemented.**
3. An authenticated AppSync custom action that invokes the processor. **Implemented, but no client calls it.**
4. A non-public `PublicImageAsset` workflow ledger. **Implemented.**
5. Server-managed projection fields on `PublicPassportSnapshot`. **Implemented and guarded from normal client writes.**
6. Least-privilege access from the function to the specific data models and S3 prefixes. **Implemented for Phase 2C; hosted policy and cross-account testing remain release gates.**
7. A scheduled or queued orphan-cleanup path. **Not implemented.**
8. CloudWatch metrics, structured audit events, alarms, and a dead-letter/retry strategy. **Bounded structured events are implemented; full operational alarms/retries are not.**

The processing action should be asynchronous if operational testing shows an 8 MB decode/re-encode can exceed a comfortable AppSync request duration. A safe pattern is:

```text
AppSync command -> create pending asset/job -> queue -> processor Lambda
               -> owner polls/subscribes to owner-only job state
```

A synchronous first implementation is acceptable only if strict size/dimension limits and measured processing times keep it reliable. The state and rollback rules below still apply.

## Command contract

For one Equipment Passport cover image, the implemented backend action accepts this narrow command:

```text
processPublicPassportImage({
  publicPassportSnapshotId,
  privateImageAssetId,
  altText,
  consentConfirmed: true
})
```

It must not accept:

- `sourceStorageKey`;
- an S3 bucket name;
- a source or destination URL;
- a destination key;
- an arbitrary owner ID;
- a public status supplied by the client.

`publicPassportSnapshotId` identifies the related `EquipmentPassport` through `equipmentPassportId`, while opaque `privateImageAssetId` identifies the owner-only verified candidate. The function re-derives `equipment_cover`, the exact source key, and every owner relationship server-side.

`consentConfirmed` is required and must be exactly `true`. Phase 2D should add a versioned safety-checklist consent record before this action becomes user-facing. Phase 2C uses a content-addressed derivative id/key so an identical validated request is idempotent without accepting a client idempotency key.

The response exposes only the public workflow asset id, safe processing status, and bounded failure code. It never returns the private key, destination key, or signed URL.

## Ownership validation

The processor must establish all of the following from trusted identity and database reads:

1. The request is authenticated.
2. The canonical caller owner key matches `PublicPassportSnapshot.ownerId`.
3. The snapshot's `equipmentPassportId` resolves to an `EquipmentPassport` owned by the same caller.
4. The requested source type is allowed and resolves server-side to that passport's eligible private image record.
5. The source object belongs to the caller's trusted private Storage identity/prefix.
6. The public account/snapshot is eligible for publishing and username ownership is not unresolved.
7. No active conflicting processing job exists for the same snapshot/role, unless the command is an idempotent retry.

### Important identity mismatch

Data models currently use a Cognito user-pool username-style owner key, while private Storage paths use a Cognito Identity Pool `identityId`. A privileged Lambda must not assume these values are interchangeable.

Also, `privateCoverPhotoKey` and `TargetPhoto.storageKey` are currently written by the browser into owner-scoped models. Ownership of the model alone does not cryptographically prove that an arbitrary value in its key field belongs to the same Storage identity. A malicious client could attempt to replace that field with a guessed key and turn the processor into a confused deputy.

Phase 2B implements the preferred source-finalization strategy:

- **Implemented:** finalize the owner-private `PrivateImageAsset` candidate through an authenticated Identity Pool/IAM mutation. The operation accepts only the candidate id. The Lambda derives `cognitoIdentityId` and authenticated state from AppSync resolver identity, binds it to the candidate and path, binds the protected user-pool `sub`, re-reads the saved source, and runs `HeadObject` against the exact S3 key.
- **Fail-closed legacy behavior:** candidates created before the identity bridge fields existed are not backfilled from client input and cannot verify. Re-upload is required for the current development release.
- **Integration gate:** hosted testing must confirm the deployed Amplify IAM event contains the expected authenticated Identity Pool fields and Cognito sign-in provider value. Missing or unrecognized identity context returns the bounded `unauthorized` failure and never marks a candidate verified.
- **Not acceptable:** compare only `EquipmentPassport.ownerId`, trust the browser-written S3 key, or rely on the obscurity of another user's private key.

The first public-image release may intentionally require re-upload through the trusted registration path. That is safer than silently treating legacy key fields as verified.

## Processing sequence

1. Validate command identifiers, alt-text length, and explicit consent acknowledgement.
2. Resolve the caller's canonical owner aliases from trusted auth claims.
3. Load the snapshot, related passport, public profile state, and trusted private image registration.
4. Perform all ownership and relationship checks before reading S3.
5. Create or reuse an owner-only `PublicImageAsset` record in `pending` state using a conditional/idempotent write.
6. Move the asset to `processing` with a conditional state transition.
7. `HeadObject` the private source and reject missing or oversized objects before download.
8. Stream or download within strict memory and time limits.
9. Decode the bytes with an allowlisted image processor; reject mismatched signatures, invalid images, animation, unsupported formats, and excessive dimensions/frame counts.
10. Auto-orient pixels, flatten transparency onto a neutral background, resize within the maximum display dimensions, and re-encode to a new JPEG derivative without copying source metadata.
11. Inspect the derivative to verify its format, dimensions, size, frame count, and absence of disallowed metadata.
12. Write the new object to the backend-generated, versioned public key.
13. Transactionally update the asset to `ready` and project `publicImageAssetId`, `publicImageKey`, and `publicImageAltText` onto the snapshot only if source ownership, visibility, username ownership, and verification state are still valid.
14. If replacing an image, switch the snapshot reference only after the new object and asset are ready.
15. Delete a newly written derivative if finalization fails. Deletion of a superseded ready derivative remains future lifecycle work.
16. Emit a privacy-safe audit event and metrics.

At no point should the browser download the private source and upload it to a public prefix.

## Image validation and metadata removal

### Recommended first-release limits

The Phase 2C implementation enforces:

- accepted private input: JPEG or PNG still image; WebP remains private-upload-only and is rejected by the public processor;
- maximum source bytes: 6 MB;
- maximum decoded pixels: 12 megapixels;
- maximum frames/pages: 1;
- maximum source dimension: 8192 pixels;
- maximum derivative long edge: 1600 pixels;
- output: JPEG with bounded quality fallback;
- maximum derivative bytes: 2 MB;
- Lambda configuration: 1024 MB memory, 45-second timeout, and 512 MB ephemeral storage.

Reject SVG, PDF, HEIC until explicitly supported, archives, executables, multiple-frame images, and any file whose decoded format disagrees with the allowlist. Extension and browser MIME type are hints only; validate decoded content and magic bytes.

### Re-encoding requirements

A library such as `sharp` can decode, auto-rotate, resize, and encode WebP in Lambda. The implementation must use a Lambda-compatible build and must not call an option that preserves source metadata.

The processor must remove or prevent propagation of:

- EXIF and GPS coordinates;
- camera/device make, model, and serial information;
- IPTC and XMP blocks;
- comments and user-description fields;
- embedded thumbnails/previews;
- original orientation after pixel rotation;
- original filename and content disposition;
- source timestamps or user-defined S3 metadata;
- color/profile metadata unless an explicitly reviewed safe profile is required for correct display.

Re-encoding is required. An S3 server-side copy with metadata replacement is not sufficient because metadata may be embedded in the image bytes.

Automated fixtures must include GPS, device IDs, embedded thumbnail, Unicode/private filename, rotated orientation, oversized dimensions, corrupt bytes, animated WebP, and extension/MIME mismatches. A release test should inspect the resulting bytes with an independent metadata tool rather than trusting only the processing library's output.

## User consent contract

The UI is implemented in a later phase, but the backend contract must require explicit consent data.

Public Preview should keep **Publish without images** selected by default. Publishing or updating the text snapshot must not carry forward a newly selected private image implicitly.

To publish an image, the owner must:

1. explicitly choose an eligible image;
2. see a preview labeled as private source versus proposed public derivative;
3. provide safe public alt text;
4. acknowledge that the processed derivative will be public;
5. confirm that the image does not reveal serial numbers, exact locations, license plates, faces of bystanders without consent, sensitive personal information, private documents, or anything they do not want public;
6. submit the image-specific action separately from ordinary text publishing.

Consent should be renewed when the source image changes. The backend should record the consent/checklist version and timestamp in the non-public asset ledger. It should reject public-image creation for a private account in the first release.

Target photos must never be selected automatically from `TargetPhoto.isPublic` or `publicPhotoPlaceholders`. A later target-photo release requires a separate consent and safety review.

## Schema design

### Option A: fields on `PublicPassportSnapshot` only

Possible fields:

```text
publicImageKey
publicImageAltText
publicImageModerationStatus
```

Advantages:

- smallest read path and fewest records;
- enough for one cover image when processing is synchronous and successful;
- public pages need no second query.

Disadvantages:

- weak representation of pending/failed jobs and retries;
- replacement loses stable asset history needed for reports and audit;
- cleanup and account lifecycle state are harder to reconcile;
- owner update authorization could allow a modified client to attach an arbitrary public key unless every image field is backend-write-only;
- status values alone cannot make a known public object unavailable.

This is acceptable only for a tightly limited prototype and is not the recommended release design.

### Option B: public `PublicImageAsset` model only

Advantages:

- stable image identity and a natural gallery/report target;
- independent lifecycle and moderation state.

Disadvantages:

- operational/private fields can be accidentally exposed if the model is public-readable;
- public pages require another query;
- a `hidden` status does not revoke access to a still-public object;
- source mapping and error details do not belong in a public model.

Do not place a private source key in a public-readable asset model.

### Recommended hybrid

Use a non-public workflow ledger plus a minimal public projection.

Future `PublicImageAsset` fields may include:

```text
id
ownerId
publicPassportSnapshotId
sourceType                 // initially equipment_cover only
sourceRecordId             // opaque private image registration ID, not an S3 key
role                       // cover; gallery later
publicImageKey             // processed derivative only
altText
status                     // pending | processing | approved | failed | hidden | removed
consentVersion
consentedAt
contentHash
outputBytes
outputWidth
outputHeight
errorCode                  // bounded code, never raw private details
idempotencyKey
createdAt
updatedAt
removedAt
```

Authorization should keep this ledger owner/admin/backend readable as required and not API-key readable. Public pages do not query it.

Add server-managed projection fields to `PublicPassportSnapshot`:

```text
publicImageAssetId
publicImageKey
publicImageAltText
```

Only an `approved` derivative is projected. For `hidden`, `removed`, failed, or pending assets, clear the public projection before object cleanup. Public clients continue reading a single sanitized snapshot and cannot see processing errors, consent data, source relationships, or owner-private workflow state.

Do not expose `publicImageModerationStatus` on the public snapshot unless the UI has a specific safe reason. Absence of the projection should be sufficient for public display. The private ledger retains the status.

All projected image fields must be backend-write-only. The existing owner must remain able to update ordinary sanitized text fields, but a modified owner client must not be able to set `publicImageKey` or `publicImageAssetId`. The future Amplify schema must use field-level authorization and resource-based function access to enforce that distinction. If Amplify cannot express it safely on the existing owner-writable model, route all snapshot updates through backend actions before adding image fields.

### Trusted private image registration and verification

`PrivateImageAsset` is the owner-private candidate registry. It stores the canonical AppSync owner key, a `sub` protected by Cognito claim authorization, source type, source record id, private Storage key, captured Storage identity, generated safe filename, browser-observed content type, and byte count. The owner may create/read immutable candidate rows but cannot update/delete them or write the guarded binding result fields. There is no public/API-key or admin/moderator read authorization. A future backend lifecycle action must perform bounded cleanup.

This client-created row is deliberately not called trusted or eligible. A modified browser can lie about ordinary create fields. The verifier therefore compares them with trusted IAM caller identity, the saved source, and S3 observations. The Phase 2C processor requires `bindingStatus=verified` and still revalidates processing-time state rather than accepting the row's key, type, or size by themselves.

Verification is a point-in-time source-binding attestation, not an immutable claim about the object. The owner can still replace or delete the private S3 object through the normal private upload lifecycle. The Phase 2C processor therefore repeats source ownership, exact-key, `HeadObject`, and object metadata checks, conditionally downloads the bytes, and validates the decoded image immediately before derivative creation; it never trusts prior `verified` status by itself.

For `range_session_target`, Phase 2B binds the candidate to the owner-scoped Range Session, expected target path, and exact S3 object metadata. It does not yet bind the candidate to one immutable `TargetPhoto` row. Target-photo candidates remain ineligible for public processing until that separate relationship and consent flow are designed and reviewed.

Phase 2B adds `verifyPrivateImageAsset`, an Identity Pool/IAM-authorized operation whose trusted resolver identity contains the caller's `cognitoIdentityId`. Given only a `PrivateImageAsset` id, the function:

1. loads the candidate and its source record server-side;
2. requires the protected candidate `sub` and captured Storage identity to match trusted IAM resolver identity;
3. requires the source record owner to equal the candidate's protected owner identity;
4. requires the key shape and embedded identity segment to equal the trusted IAM caller identity and source record id;
5. runs `HeadObject` on the exact key and validates observed MIME type and byte size against the allowlist, 8 MB limit, and registration metadata;
6. writes only `verifying`, `verified`, or `failed` plus a bounded failure code and verification time; and
7. returns an opaque asset id and status, never the private key.

The Lambda receives attribute-limited, exact-table `dynamodb:GetItem`; attribute-limited candidate-table `dynamodb:UpdateItem`; and private-prefix S3 `get` permission. Candidate reads are projected to binding inputs, source reads to owner/key fields, and updates to the verification result fields plus the owner condition. It has no public prefix, public projection, broad model mutation, object write/delete, or image-byte processing permission. `HeadObject` is an S3 `GetObject`-authorized API even though the function does not download the body.

If deployed AppSync identity integration does not provide the expected trusted Identity Pool context, keep the action failed closed and replace it with a server-created upload/finalization workflow. Do not infer a user-pool username-to-Identity-Pool mapping from ordinary request input.

## Authorization and IAM

### AppSync action

- Require authenticated users; do not allow API key/guest invocation.
- Read the caller identity from the resolver/function event, never from an `ownerId` argument.
- Normalize through the project's canonical owner-identity helper and account for username/sub aliases consistently.
- Rate-limit active jobs per owner and snapshot.
- Validate input length and enum values before invoking processing.

### Data authorization

- Owner may request processing/removal only for their own snapshot and source records.
- Owner may read their private workflow state, but may not directly approve an asset or attach a derivative key.
- Processor function may read the required private records, mutate the workflow ledger, and mutate only server-managed public projection fields.
- API-key readers may read only the projected derivative key/alt text from an eligible public snapshot.
- Admin/moderator may later hide/remove a derivative through a separate audited action; report-status permission alone must not imply image-removal permission.

### S3/IAM policy

The Phase 2C processor role receives only:

- `s3:GetObject`/`HeadObject` for validated private equipment-image prefixes;
- no target-photo read in the first release;
- `s3:PutObject`, `GetObject`, and `DeleteObject` for `public/passports/{snapshot_id}/cover/*`;
- staging access only if a private staging prefix is used;
- no bucket-wide list unless reconciliation strictly requires a prefix-limited list;
- no permission to alter bucket policy, object ACL, KMS policy, or unrelated objects.

If the private key contains a dynamic identity segment that IAM cannot safely constrain per invocation, application-level trusted registration and owner checks are mandatory and should be reinforced with separate access points/buckets where practical.

Phase 2C grants public/guest principals no derivative access. A later delivery phase may grant narrowly scoped ready-derivative reads only after release testing; those principals must never receive list, write, copy, tag, or delete permission.

## Public rendering contract

`PublicPassportDetail`, Discover cards, and public profiles should eventually use one helper that:

1. accepts `publicImageKey` only from a sanitized public snapshot;
2. resolves a public delivery URL through the chosen Storage/CloudFront configuration;
3. uses `publicImageAltText` as plain text;
4. renders no image when either field is absent;
5. never accepts `privateCoverPhotoKey`, `TargetPhoto.storageKey`, `imageUrl`, or `coverPhotoUrl` from private records;
6. never falls back to a private URL after a public load failure.

Public snapshot APIs may expose the public derivative key because the derivative is intentionally public. They must not expose the source registration ID, source key, consent details, job errors, owner aliases, or private record metadata.

## Moderation design

Future public-image reporting should add a dedicated report target such as `public_image` whose `targetId` is the stable `PublicImageAsset.id`, never a private source ID or S3 key.

Planned asset states:

- `pending`: accepted but not yet processed;
- `processing`: processor owns the active attempt;
- `approved`: sanitized derivative is eligible for public projection;
- `failed`: no public projection; owner may retry safely;
- `hidden`: public projection removed by moderation or safety workflow;
- `removed`: owner/unpublish/lifecycle removal completed or in final cleanup.

If product policy wants the externally documented set `pending`, `approved`, `hidden`, and `removed`, keep `processing` and `failed` as internal workflow states.

Moderation must:

- show the public derivative and report metadata only;
- never reveal or fetch the private original;
- use a separate, audited permission to hide/remove the public derivative;
- detach the public projection immediately, then delete the public object;
- leave the owner's private source unchanged;
- keep report status independent from derivative availability;
- record actor, reason code, asset ID, snapshot ID, and timestamp without storing private image content in the audit event.

## Failure, rollback, and reconciliation

| Failure | Required behavior |
| --- | --- |
| Private source record/object missing | Mark the job `failed` with a bounded `source_missing` code. Do not change the current public projection. |
| Caller/source ownership unresolved | Reject before S3 read, create no derivative, and emit a security metric without logging keys. |
| Type, size, dimensions, or animation invalid | Fail closed with a safe owner-facing reason. Write no public object. |
| Decode/re-encode fails | Mark `failed`; write no public reference. Remove any staging output. |
| Metadata-removal verification fails | Treat as processing failure. Never publish the derivative. |
| Public object upload fails | Keep the previous approved image/reference, if any. Mark the new job failed/retryable. |
| Public upload succeeds but database projection fails | Delete the new object. If deletion fails, record an orphan-cleanup task; never expose the unreferenced key to clients. |
| Database projection succeeds but old object deletion fails | Keep the new projection active. Record the old key as an orphan and retry cleanup. |
| Duplicate/retried request | Return the existing job/result for the same owner/idempotency key; do not create another live object. |
| Two replacements race | Use conditional version/state writes so only one projection wins; cleanup the losing derivative. |
| User removes image or unpublishes snapshot | Clear/disable the public projection first, then delete the public derivative and mark the ledger removed. Preserve private original. |
| Public delivery object disappears unexpectedly | Public page renders no image; reconciliation marks the asset inconsistent and alerts operators. Never use private fallback. |
| Cleanup job repeatedly fails | Send to DLQ/alert, retain non-public cleanup metadata, and keep the public projection detached. |

Use a scheduled reconciliation job to compare approved projections with public objects and to remove expired staging objects and orphan derivatives. Avoid bucket-wide scans when a ledger-driven query can provide the candidate keys.

## Account deletion, export, and private deletion

### Account export

The account export manifest should include:

- the owner's `PublicImageAsset` metadata in a portable, non-sensitive form;
- public derivative bytes if the product chooses to include published assets;
- alt text and public snapshot relationship;
- a clear distinction between private original and public derivative.

Do not export expiring signed URLs as durable data. Private originals should be included through the protected private export workflow, not by exposing their S3 keys to public APIs.

### Account deletion

Account deletion should:

1. block new processing jobs;
2. detach all public image projections and public snapshots;
3. delete public derivatives and wait/retry until cleanup reaches a terminal state;
4. apply report/audit retention policy without retaining public image access;
5. delete private originals through the owner-private lifecycle workflow;
6. delete or pseudonymize workflow ledgers only after required audit/retention decisions;
7. avoid final account deletion success while unhandled public objects remain.

### Public snapshot unpublish

The current browser directly deletes `PublicPassportSnapshot`. Once images exist, unpublish must use a backend-controlled command so it can detach the projection, delete the derivative, update the ledger, and then remove the snapshot idempotently.

### Private image deletion/replacement

Private deletion must not leave an unmanaged public derivative. The privacy-first default is:

- warn that the related public derivative will also be removed;
- detach and delete the public derivative through the backend;
- then delete/replace the private original;
- require fresh consent before a replacement becomes public.

If product policy later allows a sanitized derivative to remain after private deletion, that must be an explicit, separately reviewed choice rather than accidental behavior.

## Observability and operations

Record structured events and metrics for:

- requested, processing, approved, failed, hidden, and removed counts;
- processing duration, input/output bytes, and output dimensions;
- validation failures by bounded reason code;
- ownership/security rejections;
- projection-update rollback failures;
- orphan cleanup attempts and DLQ depth;
- public delivery 404s where observable.

Logs and traces must not contain private keys, signed URLs, original filenames, image bytes, free-form alt text, Cognito tokens, or sensitive source metadata. Use asset/job IDs and bounded error codes. Restrict log retention and access appropriately.

Alarms should cover sustained processing failures, metadata-verification failures, orphan cleanup failures, DLQ messages, and unexpected access-denied spikes.

## Phased implementation checklist

### Phase 1: backend foundation, no UI

- [x] Document the user-pool owner key versus Storage identity mismatch and fail closed rather than treating them as interchangeable.
- [x] Add an owner-private `PrivateImageAsset` candidate registry without treating client input as trusted.
- [x] Implement the trusted `PrivateImageAsset` finalization strategy; hosted cross-account and identity-event tests remain a release gate.
- [x] Defer the separate public bucket/prefix decision until processing and delivery are implemented; add no Storage rule now.
- [x] Define `PublicImageAssetStatus`, a client-read-only private workflow ledger, and backend-reserved public projection fields.
- [x] Define the future AppSync action contract in this document without accepting S3 keys or URLs.
- [x] Defer the processor function because Phase 1 does not copy, process, or publish images.
- [x] Defer processor IAM permissions until the trusted source and destination resources exist.
- [x] Add no public Storage read rule before processor output tests pass.
- [ ] Add unit tests for authorization contracts and forbidden inputs.
- [x] Preserve payload omission and public rendering behavior through typecheck, lint, build, and manual regression expectations.
- [x] Document that the Phase 1 schema requires backend redeployment.

### Phase 2A: private source candidates, no public processing

- [x] Register successful private Equipment Passport and Range Session target uploads as owner-only candidates.
- [x] Bind candidate inputs to a saved owner-scoped source record in the normal client flow.
- [x] Validate the expected private path shape, Storage identity segment, source id, generated filename, content type, and byte limit.
- [x] Reject missing, mismatched, demo, and sample source ids before registration.
- [x] Keep verification fields client-nonwritable and treat missing/unverified status as ineligible.
- [x] Preserve current private display and text-only public snapshot behavior.
- [x] Add no public Storage path, processor, selection UI, or rendering.

### Phase 2B: trusted private source verification

- [x] Implement Identity Pool/IAM-backed candidate verification.
- [x] Resolve the candidate and source server-side and bind protected user-pool identity, source owner, trusted Storage identity, key shape, and exact S3 object metadata.
- [x] Permit only the backend resource—not app clients—to set bounded binding status/failure/verification fields.
- [x] Keep Range Session target candidates ineligible for the first public release even if source binding is verified.
- [x] Add a private-only verification control and bounded status copy without exposing keys or adding public behavior.
- [x] Bound candidate identifiers and return bounded failures when the initial candidate lookup or metadata parse fails.
- [ ] Run hosted integration tests for same-owner success, other-owner rejection, legacy candidate rejection, missing object, mismatched metadata, unsupported type, and oversize object.

### Phase 2C: private processing and derivative foundation

- [x] Implement authenticated public-image command handling and canonical owner validation.
- [x] Resolve snapshot, passport, public account profile, username reservation, and a verified private source server-side.
- [x] Treat verification as point-in-time: repeat source/key/object checks immediately before processing and validate decoded bytes independently.
- [x] Implement idempotent/content-addressed state transitions with conditional and transactional finalization.
- [x] Validate object existence, type, bytes, pixels, and PNG animation state.
- [x] Auto-orient, resize, re-encode, and independently verify metadata removal from the JPEG derivative.
- [x] Write a versioned public derivative using a backend-generated content-addressed key.
- [x] Project only ready derivative key/alt text onto the public snapshot through backend-only writes.
- [x] Roll back a newly written output when finalization fails.
- [x] Bind failure writes to the exact active processing attempt and include prior alt text in optimistic snapshot finalization.
- [x] Add a developer-only, explicit-confirmation authenticated test script with no product UI, committed token, S3-key input, or arbitrary endpoint.
- [ ] Add superseded-asset removal and scheduled orphan cleanup.
- [ ] Add hosted integration fixtures for same-owner success, another-owner/private-account/source-race attempts, malformed/animated/oversized inputs, and metadata leakage.
- [x] Keep the destination processor-only: no public delivery rule, selection UI, client invocation, target-photo processing, or rendering.

### Phase 2D: owner Public Preview consent workflow

- [ ] Keep **Publish without images** as the default.
- [ ] Show only backend-verified eligible private sources to the owner.
- [ ] Add safety checklist, public alt text, and consent-version acknowledgement.
- [ ] Show pending/processing/approved/failed owner states without exposing keys.
- [ ] Add image-specific publish, replace, and remove commands.
- [ ] Route unpublish through backend cleanup instead of direct snapshot deletion.
- [ ] Do not begin this UI slice until the Phase 2C positive, negative, concurrency, metadata-removal, IAM, rollback, and hosted tests pass.

### Phase 4: public rendering and moderation

- [ ] Enable narrowly scoped public derivative delivery only after processing tests pass.
- [ ] Render approved projection fields in public details/Discover with no private fallback.
- [ ] Add `public_image` reports against stable public asset IDs.
- [ ] Add audited admin/moderator hide/remove action that preserves private originals.
- [ ] Test caches and signed-out visibility after remove/unpublish.

### Phase 5: lifecycle integration

- [ ] Add derivative and ledger handling to account export.
- [ ] Add detach/delete/retry behavior to account deletion.
- [ ] Coordinate private-image deletion/replacement with public derivative removal.
- [ ] Add scheduled orphan/staging reconciliation and operational alarms.
- [ ] Complete privacy, authorization, load, accessibility, and hosted release tests.

## Release acceptance gates

Do not enable public image selection or rendering until all of these are true:

- the function cannot read another owner's source through modified inputs or record fields;
- no action accepts an arbitrary private/public key or URL;
- EXIF/GPS and filename removal is independently verified with hostile fixtures;
- projected fields are backend-write-only;
- private/public Storage rules are proven separate for guest, owner, other-owner, processor, moderator, and admin identities;
- public load failures never fall back to a private object;
- remove, replacement, unpublish, visibility change, and account deletion revoke the public reference before cleanup;
- rollback and orphan cleanup tests pass;
- public APIs and logs contain no private key, signed URL, source filename, token, or private profile/record data;
- target photos remain excluded unless their separate release is reviewed.

## Completed Codex Prompt: Phase 1 Public Image Publishing Foundation

This prompt is retained as the historical scope for the Phase 1 schema foundation. Do not rerun it without first reviewing the current schema and the remaining trusted-source work.

```text
Implement only Phase 1 of the UnifiedRange public image publishing backend foundation.

Read first:
- docs/PUBLIC_IMAGE_BACKEND_DESIGN.md
- docs/PUBLIC_IMAGE_PUBLISHING_PLAN.md
- docs/S3_IMAGE_STORAGE_PLAN.md
- amplify/data/resource.ts
- amplify/storage/resource.ts
- amplify/backend.ts
- src/lib/privateImageStorage.ts

Scope:
1. Resolve and document the canonical mapping between the Cognito user-pool owner key used in Data and the Cognito Identity Pool identity used in private Storage paths.
2. Add the minimum private workflow schema needed for a trusted private image registration and a PublicImageAsset processing ledger.
3. Add server-managed public image projection fields to PublicPassportSnapshot only if field-level authorization can prevent normal owners and public clients from writing them.
4. Define a narrow authenticated backend action contract that accepts a public snapshot ID, source type/opaque registered asset ID, alt text, consent version, and idempotency key. It must not accept any S3 key, bucket, URL, destination, or owner ID.
5. Scaffold a Lambda handler that validates input and fails closed with a not-enabled result. Do not read/copy images or create public derivatives in this phase.
6. Add only the least-privilege function/data permissions required for the scaffold. Do not enable guest/public Storage read and do not add a public S3 prefix unless a non-readable placeholder resource is strictly required.
7. Add unit/type tests for forbidden inputs, authorization boundaries, and fail-closed behavior.
8. Update docs with the exact backend redeploy and future Phase 2 requirements.

Do not implement:
- image copying, decoding, resizing, re-encoding, or metadata stripping;
- public Storage reads or public image URLs;
- Public Preview image selection or any UI;
- public image rendering, reporting, or moderation actions;
- target-photo publishing;
- account deletion/export execution;
- unrelated schema or product features.

Preserve all existing private image behavior and sanitized text-only public publishing. Clearly state every schema/auth/resource change and that an Amplify backend redeploy is required. Run npm run amplify:typecheck, npm run lint, npm run build, and git diff --check.
```

## Safety boundary

Public image publishing remains a privacy-controlled setup-documentation feature. It must not add calculators, scope outputs, hold recommendations, field corrections, sight-in instructions, or any feature that tells a user how to adjust or aim equipment.
