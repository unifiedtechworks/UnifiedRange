# Phase 2E Public Image Rendering and Delivery Plan

## Status and scope

Phase 2E.1 adds the backend-only delivery resolver foundation. `resolvePublicPassportImage` is an API-key-authorized public query that accepts only `publicPassportSnapshotId`, revalidates the current public snapshot/asset/source/profile/object graph, and returns a 60-second processed-derivative URL plus safe alt text only when every check passes. Every rejected condition returns the same bounded unavailable response. Phase 2E.2 adds the first rendering surface on saved Public Passport detail pages only.

Phase 2C can create a bounded, metadata-stripped JPEG derivative under the processor-only `public/passports/{snapshotId}/cover/{publicImageAssetId}.jpg` namespace. Phase 2D lets the signed-in owner explicitly select the current verified Equipment Passport cover, complete the safety checklist, provide bounded alt text, and invoke processing from Public Preview. Normal publishing still defaults to **Publish without images**.

The derivative namespace grants write/delete access only to the processor and read access only to the processor and delivery Lambda. Signed-out visitors, API-key clients, normal signed-in users, moderators, and admins still cannot read it directly through Amplify Storage. The saved Public Passport detail component calls only the resolver with the route's snapshot ID; it never reads projection fields or Storage directly. Discover cards and public profile cards remain image-free.

Phase 2E.2 is a narrow detail-only rendering slice, not broad public image release. Missing, expired, ineligible, inconsistent, or failed delivery silently degrades to the complete text-only detail. Target photos remain out of scope.

## Decision summary

| Concern | Phase 2E recommendation |
| --- | --- |
| First rendering surface | Saved Public Passport detail at `/discover/passports/[publicPassportId]` only |
| Deferred surfaces | Discover cards, `/u/[username]` setup cards, feeds, profile images, galleries, and every target-photo surface |
| Browser input | `publicPassportSnapshotId` only |
| Delivery | Implemented foundation: `resolvePublicPassportImage` validates current public eligibility and returns a 60-second presigned GET URL plus safe alt text |
| Storage posture | Keep S3 Block Public Access and the processor-only derivative prefix; do not add broad guest read |
| Public mapper | Keep `recordToSanitizedPublicPassport` free of image keys; use a detail-only delivery helper keyed by snapshot ID |
| Missing or denied image | Render no image and no technical error; never fall back to a private source |
| Revocation | Stop issuing URLs immediately, detach the projection first, then delete asynchronously and idempotently |
| Release gate | Validate derivative-aware remove/unpublish and implement visibility revocation before expanding public rendering |

## Why Public Passport detail is first

The first surface should be the saved Public Passport detail page only.

- It renders one explicitly selected setup at a stable public snapshot route.
- A single image request is easier to inspect in browser, AppSync, Lambda, and S3 logs.
- Missing, denied, or expired delivery can degrade to the existing complete text-only detail page.
- It limits visual spread while removal, cache behavior, accessibility, and signed-out delivery are tested.
- It avoids multiplying requests across every Discover result and public profile card.
- It makes it easier to verify that sample/demo records and target-photo placeholders never request an image.

Do not render images in `PublicPassportCard` during the first slice. Because Discover and public profiles both reuse that card, leaving it text-only defers both surfaces at once. Do not add profile avatars, feeds/follows, galleries, or target photos.

## Current contracts to preserve

### Storage

The derivative currently lives in the same Amplify Storage resource as private images, under a separate processor-only rule:

```text
public/passports/{snapshotId}/cover/{publicImageAssetId}.jpg
```

The path is backend-generated and content-addressed. It contains no private source filename, username, Cognito identity, private Storage identity, private source key, or target-photo path.

The processor has `get`, `write`, and `delete` access to this derivative namespace. The Phase 2E.1 delivery Lambda has `get` access only. Browsers and guest identities have no direct Storage access, and the resolver has no private-prefix, list, write, or delete permission.

### Public snapshot projection

The processor may populate these backend-managed fields on `PublicPassportSnapshot`:

- `publicImageAssetId`
- `publicImageKey`
- `publicImageAltText`

Normal snapshot create/update payloads must continue to omit them. The legacy `coverPhotoUrl` field must remain unused.

`recordToSanitizedPublicPassport` currently ignores every image field. Keep that shared mapper unchanged for the first detail-only release so image keys cannot spread accidentally into Discover or public profile cards.

### Workflow ledger

`PublicImageAsset` is owner-readable and client-nonwritable. It records the public snapshot relationship, public derivative key, safe alt text, consent time, and processing status without storing the private S3 key. The delivery backend—not a public browser—should cross-check this ledger before returning a URL.

## Delivery options

### Option 1: Amplify Storage guest `getUrl`

This is operationally simple but would require guest read authorization on the derivative prefix. A browser that knows a derivative key could request it without rechecking whether the snapshot still exists, the account remains public, or the asset remains ready. It also broadens the unauthenticated Storage surface before removal and moderation controls exist.

Do not use this for the first release.

### Option 2: direct S3 or CloudFront public read

CloudFront with Origin Access Control and a private S3 origin is a strong long-term delivery architecture. It supports response headers, scale, and cache controls without making the bucket public. However, static public paths still require coordinated invalidation or deletion when an account becomes private, an owner removes an image, a snapshot is unpublished, or moderation hides an asset.

Defer this until lifecycle commands, cache invalidation, and operational monitoring are proven. Never make the S3 bucket or entire `public/` prefix anonymously public.

### Option 3: backend-generated short-lived URL — implemented foundation

Phase 2E.1 adds this narrowly scoped public AppSync query backed by Lambda:

```text
resolvePublicPassportImage({ publicPassportSnapshotId })
```

The browser supplies only the snapshot ID already present in the public route. It does not supply a key, asset ID, owner ID, source ID, bucket, path, URL, filename, or status.

After eligibility checks succeed, the resolver generates a short-lived presigned `GetObject` URL for the exact projected derivative. Return only:

```text
{
  available: true,
  url: shortLivedDerivativeUrl,
  altText: safePlainText,
  expiresAt: timestamp
}
```

Every missing, denied, removed, inconsistent, or unavailable condition should return the same public-safe unavailable result:

```text
{ available: false }
```

Do not return a public failure code, S3 key, asset ID, owner identifier, or raw AWS error. Use bounded internal metrics without sensitive identifiers.

Implemented initial delivery controls:

- URL lifetime of 60 seconds;
- signed response cache headers overridden with `private, no-store, max-age=0`;
- `Content-Type: image/jpeg` and no content disposition or original filename;
- no bucket listing, writes, copies, deletes, ACL changes, tagging, or private-prefix access for the resolver;
- strict persistent snapshot-ID validation; and
- no URL logging, analytics capture, local storage, or persistent client cache.

The hardened resolver also rejects a generated URL unless it is HTTPS, targets the exact configured S3 bucket/Region host, has no embedded credentials or fragment, resolves to the exact validated public derivative key, and carries the expected 60-second `X-Amz-Expires` value. Required runtime configuration is validated inside the handler's bounded failure boundary so a missing setting does not bypass the generic unavailable contract. The developer-only harness documented in [PHASE_2E_1_DELIVERY_RESOLVER_TESTING.md](PHASE_2E_1_DELIVERY_RESOLVER_TESTING.md) independently checks the generated Storage host, invokes the API-key query with only a snapshot ID, validates and fetches the derivative internally, and prints only a bounded result without the URL, key, alt text, IDs, API key, or image bytes.

The existing derivative objects were written with long-lived immutable cache metadata. The signed GET overrides that metadata with a non-cacheable response policy. Hosted testing must confirm S3 honors the override and that browser/intermediary behavior stays inside the accepted revocation window; do not rely on URL expiration alone.

### Option 4: proxy image bytes through the application backend

Proxying every byte provides a state check on every request but adds application bandwidth, latency, timeout, and scaling pressure. It also creates another place where image bytes could be logged accidentally. Keep it as a fallback only if short-lived signed delivery cannot meet revocation requirements.

## Backend eligibility contract

The resolver should fail closed unless all checks succeed in one current request:

1. The snapshot ID is syntactically valid and not demo/sample-shaped.
2. `PublicPassportSnapshot` exists. Its existence is the current published-state signal.
3. `publicImageAssetId`, `publicImageKey`, and safe non-empty `publicImageAltText` exist.
4. The derivative key exactly matches `public/passports/{snapshotId}/cover/{publicImageAssetId}.jpg` after strict segment validation.
5. The referenced `PublicImageAsset` exists, belongs to that snapshot owner, references that snapshot, uses `equipment_cover`, has status `ready`, and matches the projected key and alt text.
6. The source Equipment Passport still exists, belongs to the snapshot owner, and remains eligible for public sharing.
7. The authoritative owner profile currently has `accountVisibility=public`. Because the owner index is eventually consistent, resolve the profile through the index and then perform a consistent primary-key read before signing; any sanitized public-profile projection used by public pages must agree.
8. Username ownership is resolved if the product continues to require a valid public identity for publishing.
9. A metadata-only S3 check confirms the derivative exists, is `image/jpeg`, and remains within the processor's output byte limit.
10. No current owner-removal, unpublish, account-privacy, moderation-hidden, or cleanup state blocks delivery.

IDs and projection fields are selectors, not authorization. The resolver must derive all owner and source relationships server-side. It must never consult `EquipmentPassport.privateCoverPhotoKey`, `PrivateImageAsset.storageKey`, `TargetPhoto`, or a caller-supplied destination.

For current data, `ready` is the only deliverable `PublicImageAssetStatus`. `draft`, `processing`, `failed`, and `removed` always render nothing. A future moderation workflow may add `hidden` or a separate delivery-status field; that state must also render nothing.

## Public API shape and field exposure

The resolver means public clients do not need direct API-key reads of `publicImageKey` or `publicImageAssetId`. Phase 2E.1 keeps the current field authorization unchanged because existing generated public snapshot operations still select those fields; changing field authorization without narrowing those selection sets could break the current public text pages. Public UI mapping continues to omit them. Tighten this authorization only with a coordinated public-query selection review.

The new custom query is a schema/backend change. If direct public projection reads are retained temporarily, public UI code must continue to ignore the key and must never pass it to a generic Storage helper.

The public response may reveal the processed derivative URL because the image is intentionally public for the URL lifetime. Its path must reveal only the public snapshot/asset namespace, never the private source structure.

## Detail-page rendering design

### Component boundary

Phase 2E.2 adds `PublicPassportImage`, a detail-only component that receives only `publicPassportSnapshotId`, plus a narrow public resolver helper.

- `PublicPassportDetail` renders it only for a saved public snapshot, never for sample/demo data.
- The component calls the public delivery resolver using the public API authorization mode.
- It does not accept a storage key, URL, private passport, candidate, owner, or source record as a prop.
- It ignores stale responses after route or snapshot changes.
- It clears the URL from state on unmount and never persists it.
- It makes no processor, upload, verification, or Storage-write request.
- The parent detail loader and image component use independent request generations so an older snapshot/profile/resolver/image event cannot win after navigation.
- Resolver checks stop after 10 seconds and image-byte loading stops after 15 seconds; both degrade to the same quiet text-only state.

`PublicPassportCard`, `DiscoverPublicPassportList`, `PublicUserProfile`, and `recordToSanitizedPublicPassport` remain image-free in this release.

### UI states

Use a bounded cover area above the sanitized setup details:

| State | Behavior |
| --- | --- |
| Checking | Reserve a bounded aspect-ratio area with an accessible loading label; do not show a private/source preview |
| Available/loading bytes | Request only the short-lived derivative URL and show a neutral skeleton |
| Loaded | Render the processed JPEG with safe alt text and responsive dimensions |
| Unavailable | Omit the image area or show a neutral “No public image shared” fallback |
| URL expired or object missing | Hide the broken image and retain the complete text-only detail page |
| Resolver/network failure | Use the same neutral fallback; do not expose a technical error or retry indefinitely |
| Route changes while loading | Ignore the stale result and never display the prior snapshot's image |

Because Phase 2C already bounds dimensions and output size, the first release may load the short-lived URL directly with a standard image element or an unoptimized framework image component. Do not route the URL through an optimizer or CDN cache until its cache and revocation behavior has been tested. Set explicit width/aspect-ratio constraints to prevent layout shift and mobile overflow.

The client repeats the public delivery contract before assigning `src`: one non-duplicated set of SigV4 parameters, HTTPS, the configured S3 bucket/Region host, no alternate port/credentials/fragment, the exact snapshot-specific cover path and lowercase content-addressed JPEG filename, a 60-second signing window consistent with `expiresAt`, `cacheSeconds=0`, and the signed `private, no-store, max-age=0`/JPEG/inline response overrides. It also rejects a decoded image with empty or greater-than-1600-pixel dimensions. These are defense-in-depth checks; backend authorization remains authoritative.

Optional copy such as “User-approved processed public image” may appear near the image if it helps users understand the boundary. It must not imply moderator approval or safety certification.

### Alt text

- Treat backend-returned alt text as plain text only.
- Normalize and revalidate the current Phase 2D length and forbidden URL/path rules in the resolver.
- Require meaningful non-empty alt text for the first release; if it is absent or invalid, render no image.
- Never generate alt text from a filename, private note, model record, S3 key, URL, username, or source metadata.
- Do not inject alt text as HTML or duplicate it into a visible tooltip by default.
- Preserve long-word wrapping for nearby captions and mobile layouts.

## Missing and inconsistent derivatives

If projection fields exist but the ledger is missing/not ready, fields disagree, or the object cannot be read, return unavailable and render no image.

- Never fall back to `privateCoverPhotoKey`, a private signed URL, an owner preview URL, `coverPhotoUrl`, `TargetPhoto.storageKey`, or `TargetPhoto.imageUrl`.
- Never reveal whether the failure was a missing object, denied object, removed asset, private account, hidden asset, or mismatched record.
- Emit a bounded internal inconsistency metric and queue ledger-driven reconciliation later.
- Do not let a client retry loop create request amplification.
- Keep the text/setup snapshot usable even when image delivery fails.

## Visibility, unpublish, removal, and replacement

Phase 2F.1 provides the backend-controlled owner-removal primitive, Phase 2F.2 exposes its owner-facing Public Preview remove control, Phase 2F.3 composes cleanup with owner-scoped snapshot deletion for derivative-aware Unpublish, and Phase 2F.4 composes the same cleanup contract with the existing consent/processor flow for owner-facing remove-first replacement. Atomic replacement remains deferred.

### Snapshot unpublish

The implemented owner flow:

1. confirms the signed-in owner intent;
2. calls the backend cleanup command with only the public snapshot id so the image projection is detached and the ledger asset becomes non-deliverable;
3. continues only for `removed`, `not_attached`, or detach-confirmed `cleanup_pending`;
4. deletes the same sanitized snapshot through the existing owner-authorized model operation; and
5. preserves the private Equipment Passport and original image.

If cleanup fails, snapshot deletion does not run. If cleanup succeeds but text deletion fails, the UI explains that the image is detached while the text/setup may remain public and permits a safe Unpublish retry. A future atomic command may replace this two-call orchestration when durable reconciliation is added.

The resolver must stop issuing new URLs as soon as the projection/snapshot is detached. Previously issued URLs may remain usable only until their short expiration; this limitation must be part of release review and owner-facing public-sharing copy.

### Owner removes the public image

The implemented `removePublicPassportImage(publicPassportSnapshotId)` command authenticates the owner, conditionally detaches all three image projection fields, marks a safely matched ledger row `removed`, and deletes only the canonical public derivative. The public detail then falls back to text-only and the private original remains unchanged. Phase 2F.1 exposes this through a developer harness, and Phase 2F.2 calls it from Public Preview with only the current snapshot id.

### Replacement

Phase 2F.4 implements replacement as a privacy-first, non-atomic sequence. Public Preview first calls `removePublicPassportImage` with only the snapshot id and continues only for `removed`, `not_attached`, or detach-confirmed `cleanup_pending`. The old derivative is unavailable before the owner can select the newly verified current equipment cover, repeat the Phase 2D checklist, provide new bounded alt text, and invoke the existing processor. A cleanup failure stops replacement. A later processing failure leaves the sanitized snapshot public without an image and allows retry; the old derivative is never restored or replaced by a private-source fallback. Atomic prepare-and-cutover replacement remains future work.

### Account becomes private

Every delivery request must recheck authoritative account visibility. A transition to private must immediately prevent new URLs and hide the image even if cleanup is delayed. The settings workflow should also enqueue detachment/deletion for every public derivative and ensure public text/profile visibility follows the same privacy decision.

### Object missing

If the database still projects an image but S3 cannot confirm the processed object, return unavailable, show no broken technical state, and record a bounded reconciliation signal. Do not recreate the derivative automatically and do not read the private original.

### Moderator hides an image later

A future audited moderator action should detach delivery or set a dedicated hidden state before deleting the derivative. It must operate on the public asset/snapshot only, leave the private original untouched, and remain separate from ordinary report-status updates.

## Reporting and moderation follow-up

Public image reporting is not part of the first detail rendering slice. Before images expand beyond the controlled detail page:

- add a dedicated `public_image` report target using a stable public asset identifier, never a private candidate/source ID or S3 key;
- show moderators only the processed public derivative and report metadata;
- add an audited hide/remove command with separate authorization;
- make `reviewed` or `dismissed` report status independent from image availability;
- ensure a hidden/removed asset cannot receive a new delivery URL; and
- test that admins/moderators gain no read access to private originals or `PrivateImageAsset` data.

## Public/private safety invariants

Public rendering must never expose or derive from:

- private S3 keys or private signed URLs;
- `EquipmentPassport.privateCoverPhotoKey`;
- Range Session target photos or `TargetPhoto` fields;
- `PrivateImageAsset` ledger data;
- owner IDs, Cognito usernames/subs, or Identity Pool IDs;
- private source record IDs;
- original filenames or client metadata;
- EXIF/GPS, embedded thumbnails, comments, device data, or timestamps; or
- private notes, exact locations, purchase details, lot numbers, or private profile fields.

The browser receives only a temporary URL for the processed public JPEG and safe alt text after current backend eligibility checks. A failed public derivative must always degrade to no image, never to the private original.

## Proposed Phase 2E implementation sequence

### Phase 2E.0: release prerequisites

- Complete Phase 2C/2D hosted positive, adversarial, concurrency, metadata-removal, IAM, and rollback tests.
- [x] Implement the Phase 2F.1 backend-controlled public-image removal primitive.
- [x] Implement derivative-aware snapshot unpublish and owner-facing lifecycle controls.
- Define account-private revocation and the maximum accepted signed-URL lifetime.
- Decide whether existing long-cache derivative objects must be rewritten or delivered with signed response-header overrides.

### Phase 2E.1: backend delivery resolver

- [x] Add the snapshot-ID-only public query and Lambda.
- [x] Give the resolver read-only, attribute-limited access to the public snapshot, public image ledger, authoritative visibility/source records, and exact public derivative objects.
- [x] Add strict projection/ledger/key/status/visibility/object checks.
- [x] Return only availability, a 60-second URL, safe alt text, expiry, zero cache seconds, or one generic unavailable result.
- [x] Review removal of API-key access from raw public image key/asset projection fields; retain it temporarily until generated public snapshot selection sets are narrowed safely.
- [x] Add bounded no-sensitive-value logs.
- [x] Add a snapshot-ID-only developer harness that validates the response allowlist, 60-second URL, bounded JPEG, and non-cacheable headers without printing sensitive or delivery values.
- [ ] Add deployment-level rate/abuse monitoring after the public query is exercised in sandbox/hosted development.

The original foundation phase changed the Amplify backend/schema/IAM and required sandbox plus hosted backend redeployment.

### Phase 2E.2: Public Passport detail rendering

- [x] Add a detail-only component that accepts only the snapshot ID.
- [x] Add loading, loaded, unavailable, expired, and stale-request states.
- [x] Render saved public snapshots only; keep sample data text-only.
- [x] Use direct short-lived delivery without framework/CDN caching until revocation tests pass.
- [x] Keep Discover cards and public profile cards unchanged.
- [x] Revalidate the resolver response host, path, expiry, cache seconds, and alt text before rendering.
- [x] Bind detail, resolver, and image events to the current route/request; bound resolver/image loading; and discard stale events.
- [x] Validate non-duplicated SigV4 fields, signed response overrides, and decoded image dimensions before showing the derivative.

### Phase 2E.3: lifecycle and privacy validation

- Test signed-out, signed-in, other-owner, private-account, moderator, and admin sessions.
- Deploy and test Phase 2F.1 removal, missing-object idempotency, retry state, URL expiration, and concurrent processor/removal state changes.
- Test deployed derivative-aware unpublish and remove-first replacement; test account visibility changes and moderation after those later lifecycle operations exist.
- Verify no private key/request appears in DOM text, GraphQL variables, public responses, analytics, console output, or backend logs.
- Verify no public route requests a private Storage prefix.

### Phase 2E.4: controlled rollout

- Enable only the detail surface after release gates pass.
- Monitor unavailable-rate, resolver latency, S3 failures, and unexpected request volume using bounded non-sensitive metrics.
- Keep a kill switch that disables URL issuance without changing private records.
- Expand to Discover/public profile cards only through a later review after cache, lifecycle, accessibility, and moderation behavior is proven.

## Release acceptance gates

Do not expand beyond the detail-only hosted-development slice or approve a broader public-image release until all of the following pass:

- only `ready` processed `equipment_cover` derivatives can receive a URL;
- the public resolver accepts only a public snapshot ID;
- public clients cannot read/list/write/delete the derivative prefix directly;
- private prefixes remain inaccessible to public, other-owner, moderator, and admin identities;
- missing/denied/expired/removed/hidden images render no image and no private fallback;
- account-private and unpublished states stop new delivery immediately;
- owner removal and unpublish detach public access before asynchronous cleanup;
- response caching cannot outlive the accepted revocation window;
- safe alt text is present and accessible;
- signed-out visitors can view only the processed derivative for an eligible public snapshot;
- Discover and public profile cards still render no images in the first slice; and
- no private key, private URL, filename, source/owner identity, metadata, or target photo crosses the public boundary.

## Deployment expectation

The original Phase 2E.1 foundation changed the Amplify schema, added `resolve-public-passport-image`, and changed IAM/Storage resource access. Its later hardening changed the resolver Lambda and requires that backend version to be deployed before Phase 2E.2 can succeed.

Phase 2E.2 itself is frontend-only plus documentation. Phase 2F.1 subsequently adds a schema result enum/index, `remove-public-passport-image`, public-prefix delete-only IAM, processor concurrency guards, and therefore requires backend redeployment. Phase 2F.3 is frontend/docs-only and uses that deployed cleanup contract before snapshot deletion. General surface expansion still requires successful hosted removal/unpublish tests, visibility/private-source cleanup, moderation, and the remaining acceptance tests.
