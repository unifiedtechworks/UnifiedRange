# Public Image Publishing Plan

## Status and scope

Public image publishing is planned but is not implemented. UnifiedRange currently stores Equipment Passport setup photos and Range Session target photos in owner-scoped private S3 paths. `PublicPassportSnapshot` publishing copies sanitized text/setup data only; it must not expose a private image key, signed private URL, or private image bytes.

This document defines the privacy and safety boundary for a future release. Phase 1 reserves a non-public workflow ledger and guarded public snapshot projection fields. Phase 2A adds owner-only registration of private upload candidates, but it does not add trusted backend verification, public Storage access, image-copy functions, public URLs, image selection, rendering, or moderation actions.

The public projection fields remain empty because normal client create/update operations cannot write them and no backend processor exists. `PrivateImageAsset` candidates remain unverified because normal clients cannot write their guarded binding fields. Public image publishing is still unavailable.

See [PUBLIC_IMAGE_BACKEND_DESIGN.md](PUBLIC_IMAGE_BACKEND_DESIGN.md) for the detailed Amplify/Lambda implementation contract, identity-boundary analysis, failure handling, and phased backend work.

## Design principles

- Images remain private by default.
- Publishing an image requires a separate, explicit choice; publishing a text snapshot never implies image consent.
- The browser must never make a private object public or copy it directly into a public prefix.
- Public pages reference only a server-generated, metadata-free derivative.
- Removing a public derivative must not delete or change its private original.
- Target photos are never published automatically. The safest first release should support one Equipment Passport setup photo only.
- Public identity, image, and setup records must remain sanitized snapshots rather than broader reads of private models.

## Current private sources

The current client creates owner-scoped keys in these forms:

```text
private/equipment/{identityId}/{equipmentPassportId}/{generatedFilename}
private/targets/{identityId}/{rangeSessionId}/{generatedFilename}
```

The Amplify Storage rules use these access patterns:

```text
private/equipment/{entity_id}/*
private/targets/{entity_id}/*
```

Current model references are:

- `EquipmentPassport.privateCoverPhotoKey`
- `TargetPhoto.storageKey`
- owner-only `PrivateImageAsset` candidate rows for `equipment_cover` and `range_session_target`

These fields and their signed download URLs are private inputs only. They must never be copied into `PublicPassportSnapshot`, returned by a public API, written to logs, embedded in image alt text, or rendered in Discover or public profiles.

After a successful private upload and saved-record update, the normal client validates the source owner, source id, path shape, Storage identity segment, generated filename, MIME type, and byte limit before registering a candidate. This is useful integrity checking and association data, but it is not an authorization boundary: a modified client can bypass browser code. Only a future backend finalizer may mark a candidate `verified`, after independently resolving the source and actual S3 object against trusted caller identity.

## Proposed public destinations

Use a clearly separate public namespace for processed derivatives:

```text
public/passports/{publicPassportSnapshotId}/{publicImageAssetId}.webp
```

This should be the canonical first-release prefix for public setup images. The generated asset identifier must not contain the private filename, Cognito identifier, S3 identity ID, equipment ID, username, or user-provided text.

Possible later namespaces, only when their separate product flows exist, are:

```text
public/profiles/{normalizedUsername}/{publicImageAssetId}.webp
public/setups/{publicPassportSnapshotId}/{publicImageAssetId}.webp
```

`public/profiles` is reserved for a future, separately consented public-profile image workflow. Do not copy setup images there. `public/setups` should not be introduced alongside `public/passports` unless a later migration establishes a single canonical meaning; two equivalent setup prefixes would complicate cleanup and authorization.

Public-prefix permissions should be intentionally asymmetric:

- The processing Lambda role may read validated private sources and write/delete public derivatives.
- Public or guest clients may read only ready public derivatives.
- App clients may not write, overwrite, copy, or delete public objects directly.
- Admin/moderator access should operate through an audited backend action rather than direct bucket mutation.

A separate public-derivative bucket can provide stronger isolation than a shared bucket. If the existing Amplify Storage resource is extended instead, private and public access rules, lifecycle policies, logging, and deployment tests must still be kept distinct.

## Explicit consent and UI flow

The Public Preview page should make **Publish without images** the default. Image publishing must be an additional opt-in choice:

1. The owner uploads an image through the existing private workflow.
2. The owner opens the saved Equipment Passport's Public Preview.
3. The preview shows eligible private images only to that signed-in owner. It does not expose their storage keys.
4. The owner chooses **Publish without images** or explicitly selects one eligible image.
5. Before submission, show an image safety checklist warning the owner not to publish:
   - serial numbers or other unique identifying marks;
   - exact locations, address details, GPS clues, or recognizable private-property details;
   - license plates;
   - faces of bystanders or anyone who has not consented;
   - sensitive personal information, screens, labels, mail, receipts, or private documents;
   - illegal, threatening, harassing, marketplace, or otherwise prohibited content.
6. Require a clear acknowledgement that the selected image will become publicly viewable after processing. Consent should be renewed when the selected source changes.
7. Offer a public alt-text field. Explain that alt text is public and must not contain private details. Enforce a reasonable length and sanitize it as plain text.
8. Submit the selection to an authenticated backend operation. The UI displays processing, ready, failed, and removed states without falling back to the private image.

Account visibility must be checked by the backend. For the first release, public image publishing should be blocked when the public account snapshot is private. A later exception would require a deliberately designed, explicit account-level permission; a client-only override is insufficient.

The preview should also provide **Remove public image** independently of text unpublishing. Replacing an image should process the new derivative before switching the public reference, then clean up the old derivative.

## Backend processing architecture

The recommended publish operation is an authenticated AppSync custom mutation or equivalent backend command backed by Lambda:

1. Receive the public snapshot ID, an opaque backend-verified eligible-source identifier, alt text, and the owner's explicit consent—not an arbitrary destination key.
2. Resolve the caller from trusted Cognito claims.
3. Confirm the caller owns the `PublicPassportSnapshot`, its source `EquipmentPassport`, and the selected private image record.
4. Confirm username ownership is valid, the public snapshot is eligible, account visibility permits publishing, and the source key is inside the caller's expected private prefix.
5. Reject target photos in the initial release. A later target-photo workflow must require its own explicit selection and safety review.
6. Read the object server-side and validate the decoded file, not only its extension or browser-provided MIME type.
7. Enforce input byte, pixel-dimension, frame-count, and processing-time limits to resist oversized or malformed images.
8. Decode and re-encode into an approved output format. This creates a new derivative and removes embedded metadata rather than trusting a metadata-delete flag.
9. Generate a random public asset ID and a sanitized server-owned filename. Never reuse the original filename.
10. Write the derivative to `public/passports/{publicPassportSnapshotId}/...` with a validated content type, safe cache headers, and no private metadata.
11. Persist only the ready public derivative key and sanitized public alt text after the object write succeeds.
12. If any step fails, leave the public snapshot without a new image reference and remove incomplete public output. Never substitute the private URL.

The operation should be idempotent, use structured audit events without private keys or image contents, and emit metrics for validation failures, processing failures, removals, and orphan cleanup. Retry behavior must not create multiple live public objects.

## Metadata stripping and file safety

Every public derivative must meet all of these requirements:

- Remove EXIF, GPS, IPTC, XMP, camera/device identifiers, embedded thumbnails, comments, and original timestamps where possible.
- Normalize orientation during decoding so orientation metadata is unnecessary.
- Sanitize or replace the original filename.
- Validate both declared content type and decoded file signature.
- Allow only approved still-image formats. SVG, documents, archives, and executable/polyglot inputs must be rejected.
- Enforce conservative upload, decoded dimension, output dimension, and output byte limits.
- Re-encode server-side; do not treat an S3 copy with metadata replacement as sufficient sanitization.
- Consider resizing and recompression in the first implementation if doing so simplifies metadata removal and limits. Additional thumbnail variants can be added later.
- Run automated tests using fixtures containing GPS, device, thumbnail, filename, and orientation metadata, then verify none survives in the public object.

The current private upload limit is 8 MB and accepts JPEG, PNG, and WEBP. The public processor may impose stricter limits. Its policy must be authoritative even when the private uploader accepted the original.

## Data model foundation and planned changes

Phase 1 already reserves these optional, client-nonwritable fields on `PublicPassportSnapshot`:

- `publicImageKey`: key of the ready public derivative only.
- `publicImageAltText`: sanitized, public plain text.
- `publicImageAssetId`: relationship to the non-public processing ledger.

The existing `coverPhotoUrl` field must remain empty for private images. Before implementation, decide whether it will be removed/deprecated or populated only from a trusted public derivative. Prefer storing a key and resolving the public URL through one controlled helper rather than accepting arbitrary URLs from clients.

`PublicImageAsset` is the owner-readable, client-nonwritable future processing ledger. Phase 2A also adds `PrivateImageAsset`, an owner-only candidate registry containing private source linkage and upload metadata. Its verification fields are client-nonwritable, and the model has no public/API-key or moderator read access. `PublicImageAsset.privateImageAssetId` is reserved for a future backend-created relationship; no current client can create it.

Future schema work should be limited to explicit Lambda resource authorization and any action/result types needed for trusted finalization and processing. Do not broaden client writes or public reads to ship that backend.

## Public/private boundary

Public surfaces may receive only:

- the processed public derivative key or resolved public URL;
- sanitized alt text;
- a safe availability/moderation state.

Public surfaces must never receive:

- `privateCoverPhotoKey`, `TargetPhoto.storageKey`, or a signed private URL;
- the original filename or object metadata;
- Cognito IDs, S3 identity IDs, private entity IDs, or private bucket details;
- private notes, exact locations, serial numbers, lot numbers, purchase details, maintenance/readiness records, or private profile fields.

Discover, `/u/[username]`, and public passport detail pages should render no image when the derivative is absent, processing, rejected, reported-and-hidden, or removed. They must not attempt to fetch the private original as a fallback.

## Unpublish, removal, and cleanup

Unpublishing a Public Passport must make its public image unavailable with the text snapshot:

1. Remove or disable the snapshot's public image reference first so public pages stop rendering it.
2. Invalidate cached delivery where applicable.
3. Delete the public derivative through an idempotent backend cleanup job.
4. Preserve the private original and its private record unless the owner separately deletes it through the private workflow.

The same boundary applies to **Remove public image**, account-visibility changes to private, account lifecycle processing, and moderator removal. If object deletion is asynchronous, public authorization or delivery state must deny access immediately rather than relying solely on UI hiding. Scheduled reconciliation should remove orphan public objects and detect references to missing objects.

Deleting or replacing a private original should not silently leave an unmanaged public derivative. The product must clearly define whether the already-consented derivative remains published or is removed; the privacy-first default is to remove it and require a new explicit selection.

## Moderation and reporting

Public images must participate in reporting without exposing their private source:

- Add a future report target such as `public_image`, linked to the public asset or public snapshot—not the private key.
- Let signed-in users report personal information, threats/harm, harassment, illegal hunting, unsafe content, sales/marketplace activity, or other policy violations.
- Show admins/moderators the public derivative and report metadata only. Do not grant access to the private original through the moderation card.
- Provide an audited action to remove or disable the public derivative without deleting the owner's private image.
- Keep report status separate from image availability. A report marked `reviewed` must not implicitly publish or remove an image.
- Consider automated scanning as defense in depth, not as a replacement for explicit consent or human review.

No destructive moderation action is part of the current app. The image release must extend authorization and moderation documentation before enabling public reads.

## Implementation phases

### Phase 1: contracts and threat review

- Choose a separate bucket or the canonical `public/passports` prefix.
- Define allowed source type, output format, limits, public caching, lifecycle, and retention.
- Threat-model authorization bypass, private-key disclosure, metadata leakage, malformed files, stale caches, orphan objects, and race conditions.
- Define the processing and moderation state machine and audit events.

### Phase 2A: private source registration

- Register successful owner uploads as private candidates without changing private display behavior.
- Validate the normal client's source owner, source id, key shape, Storage identity segment, generated filename, type, and byte size.
- Keep candidate verification fields unavailable to normal client writes.
- Treat missing or `unverified` binding status as ineligible for public processing.
- Add no public image controls, copies, reads, URLs, or rendering.

### Phase 2B: trusted finalization and backend processor

- Add a trusted Identity Pool/IAM binding or a server-owned upload alternative that can independently attest the private S3 source.
- Require backend `verified` status before a private candidate can be selected by any processing command.
- Add least-privilege Storage permissions and the owner-authenticated Lambda operation.
- Implement source ownership validation, decode/re-encode metadata stripping, type/size validation, randomized names, and idempotent cleanup.
- Grant only the backend resource permission to set binding and public projection fields.
- Add unit and integration fixtures that prove private metadata and keys never reach public responses.

### Phase 3: owner UI

- Add Public Preview selection, the safety checklist, public alt text, explicit consent, processing status, **Publish without images**, and **Remove public image**.
- Keep normal private upload screens and their keys owner-only.
- Block account-private publishing server-side and communicate the reason clearly.

### Phase 4: public display and moderation

- Render only ready public derivatives in Discover, public passport pages, and eligible public profiles.
- Add public-image reports and an audited moderator removal action that preserves the private original.
- Test unpublish, replacement, account-visibility changes, account lifecycle behavior, cache invalidation, and orphan cleanup.

### Phase 5: release gates

- Verify EXIF/GPS removal independently from the processing library.
- Test with signed-out, normal signed-in, other-owner, moderator, and admin sessions.
- Confirm public APIs contain no private key, signed private URL, original filename, owner-private identifier, or excluded record data.
- Complete desktop/mobile accessibility checks, including meaningful alt text and safe empty/error states.
- Deploy backend changes before enabling any client control or public image rendering.

## Out of scope for this plan

- Implementing public image upload or direct client writes to public storage.
- Implementing the copy/processing Lambda or metadata-stripping service.
- Adding schema fields, public image URLs, or public Storage authorization now.
- Automatically publishing Equipment Passport or Range Session images.
- Public profile avatars, image feeds, follows, direct messaging, or marketplace behavior.
- Calculators, scope outputs, hold recommendations, field corrections, sight-in instructions, or directions for adjusting or aiming equipment.
