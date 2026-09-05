# Amplify Gen 2 Data Model Plan

## Private Owner-Scoped Models

- UserProfile
- EquipmentPassport
- ProjectileProfile
- OpticSightProfile
- RangeSession
- TargetPhoto
- PrivateImageAsset (owner-only private upload candidate registry with backend-only binding results)
- MaintenanceLogEntry
- HuntingChecklist
- PublicImageAsset (public-image workflow ledger; owner-readable but not client-writable)

Each private model should include an `ownerId` identity field tied to Cognito. AppSync authorization should use `allow.ownerDefinedIn("ownerId")` or the model-specific owner field so private reads and writes stay scoped to the signed-in owner.

## Owner Field Reassignment Guard

Amplify owner-based authorization allows an owner to reassign an owner field unless that field is protected with field-level authorization. UnifiedRange protects owner-like fields with create/read/delete field-level owner rules so clients can set owner identity fields during create and keep reading them later without updating them after create.

Protected owner-like fields:

- `UserProfile.ownerId`
- `PublicUserProfileSnapshot.ownerId`
- `EquipmentPassport.ownerId`
- `ProjectileProfile.ownerId`
- `OpticSightProfile.ownerId`
- `RangeSession.ownerId`
- `TargetPhoto.ownerId`
- `PrivateImageAsset.ownerId`
- `PrivateImageAsset.ownerSub` (bound to the Cognito `sub` claim during create)
- `MaintenanceLogEntry.ownerId`
- `HuntingChecklist.ownerId`
- `PublicPassportSnapshot.ownerId`
- `PublicImageAsset.ownerId`
- `Comment.authorId`
- `Reaction.userId`
- `Report.reporterId`

`UserProfile.username` is collected during setup and treated as immutable in the frontend after creation. Username uniqueness is checked through a separate reservation model so private profiles do not need to be globally queryable.

`UsernameReservation` stores normalized username claims separately from private `UserProfile` records. The reservation record uses the normalized username as its record id for an MVP uniqueness guard, stores no profile details, and is created before profile setup writes the username. Existing profiles can create a matching reservation when loaded; conflicts require manual/admin resolution.

New owner-scoped records use Amplify Auth's current Cognito username as the canonical owner key. Username reservation validation also recognizes the same session's Cognito `userId`, `sub`, and `cognito:username` as legacy aliases. A true mismatch never overwrites the reservation and blocks public identity synchronization without blocking the owner's private profile. See `USERNAME_RESERVATION_REPAIR.md`.

The moderation queue may use `UsernameReservation` to translate a report's Cognito-backed `reporterId` into a public-safe `@username`. It must not broaden `UserProfile` read authorization to do so. See `USERNAME_SIGN_IN_PLAN.md` for the separate future username authentication design.

`UserProfile.nameLastChangedAt` supports a lightweight client-side monthly limit for first and last name edits. This is a UX guard only; use a server-side workflow if stronger enforcement becomes necessary.

User privacy and account defaults are stored on `UserProfile` so they remain owner-scoped account data. Defaults should stay private-first: account visibility and default passport visibility default to private, public preview is required before publishing, and public-sharing sanitization should hide exact locations, ammo lot numbers, purchase details, private notes, and image metadata.

Public read exceptions remain intentionally narrow:

- `PublicUserProfileSnapshot` provides immutable username, public display name, public bio, and visibility without exposing the owner-scoped `UserProfile`.
- `PublicPassportSnapshot` can be read with API key for sanitized discovery.
- `Reaction` can be read with API key so public pages can show public-safe reaction counts.

Private records remain owner-scoped and should not expose private notes, private image keys, lot numbers, purchase details, exact locations, maintenance records, readiness records, or owner private profile details through public flows.

## Phase 1 through Phase 2F.1 Public Image Foundation

`PublicImageAsset` is a non-public workflow ledger for the backend image processor. It contains the public snapshot relationship, source type and record id, processed public derivative fields, bounded processing status/error data, and consent timestamp. It deliberately contains no private S3 key and has no API-key authorization.

Current owner clients may read their own workflow records but cannot create, update, or delete them. `processPublicPassportImage` can create/update processing state, and `removePublicPassportImage` can conditionally mark the current asset removed and clear its public cleanup fields. Admin/moderator access is deferred.

`PublicPassportSnapshot` reserves these optional public projection fields:

- `publicImageAssetId`
- `publicImageKey`
- `publicImageAltText`

`PublicImageAsset.privateImageAssetId` lets the backend-created processing record reference a verified private source without copying the private key into the public snapshot.

The legacy `coverPhotoUrl` field is also reserved. Field-level authorization permits owner/public reads and owner snapshot deletion while denying normal client create/update writes to all image projection fields. The Phase 2C function receives explicit resource authorization to populate only the new guarded projection fields; it does not populate the legacy URL field.

The existing public snapshot payload builder omits `coverPhotoUrl`, all new projection fields, `EquipmentPassport.privateCoverPhotoKey`, and all `TargetPhoto` keys. Discover/public-profile mapping ignores image fields. Saved Public Passport detail uses only `publicPassportSnapshotId` with the delivery resolver and never accepts a key from page data.

Phase 2A adds `PrivateImageAsset` as an owner-only registry for private upload candidates. It records:

- canonical AppSync `ownerId`;
- Cognito `ownerSub`, protected by a create/read owner rule using the `sub` identity claim;
- `sourceType` (`equipment_cover` or `range_session_target`);
- saved source record id;
- private Storage key;
- captured Storage Identity Pool id;
- generated sanitized filename;
- browser-observed content type and byte size; and
- guarded binding status, failure code, and verification timestamp fields.

Owners may create and read their immutable candidate rows. There is no public/API-key or admin/moderator read access. Normal clients cannot update/delete candidate data or write the binding result fields. Successful private uploads create a new candidate after validating the saved source owner, Cognito owner aliases, expected source and Identity Pool path segments, generated filename, content type, and upload limit. Retained replacement history is private; a future trusted lifecycle action must handle bounded cleanup.

An unverified registry row is not a trust attestation. AppSync Data uses the Cognito user-pool username as the canonical `ownerId`, while Amplify Storage paths use an Identity Pool `identityId`. Phase 2B bridges the boundary with `verifyPrivateImageAsset`, an `identityPool`-authenticated custom mutation that accepts only the candidate id. Its Lambda derives the trusted Storage identity from AppSync IAM context, binds the protected user-pool `sub`, re-reads the owner-scoped source, validates the exact private path, and compares S3 `HeadObject` MIME/byte metadata before writing `verifying`, `verified`, or `failed` plus bounded failure details. Missing or non-`verified` status must be rejected by every future public processor.

`verified` is a point-in-time source-binding result, not an immutable object or decoded-content attestation. Because owners retain private S3 replacement/deletion access, Phase 2C repeats source, key, object metadata, account visibility, immutable username reservation, and ownership checks at processing time and independently validates decoded bytes. A `range_session_target` candidate is currently bound to its owner-scoped Range Session and exact private object, not to one immutable `TargetPhoto` row, so it remains ineligible for public processing.

The verification Lambda has attribute-limited exact-table read permission, attribute-limited candidate-table status-update permission, and read access to the two existing private image prefixes. It cannot write/delete S3 objects, mutate public snapshots or workflow ledgers, or access a public prefix. Legacy candidates without the new identity bridge fields fail closed and require re-upload.

Phase 2C adds `processPublicPassportImage`, a user-pool-authenticated mutation with snapshot id, private candidate id, optional bounded alt text, and required consent acknowledgement. The function accepts only verified `equipment_cover` candidates, resolves the complete ownership graph server-side, uses the `userProfilesByOwnerId` index instead of scanning private profiles, and fails closed when the profile is private or immutable username ownership is unresolved. It accepts bounded JPEG/PNG input, creates a fresh metadata-free JPEG derivative, and conditionally/transactionally updates only the ledger and public snapshot image projection. Failure responses and logs are bounded and omit owner ids, private keys, filenames, private records, and image bytes.

The derivative Storage namespace is `public/passports/{snapshot_id}/cover/*`. The processor has private-equipment get plus derivative get/write/delete access. The Phase 2E.1 resolver has derivative get access only, and the Phase 2F.1 cleanup Lambda has derivative delete only. No browser, guest, API-key, moderator, or admin identity can access the prefix directly. Phase 2D may call the processor after explicit consent, while `buildPublicPassportSnapshotInput` still omits image fields.

`resolvePublicPassportImage` is an API-key-authorized query with one input: `publicPassportSnapshotId`. Its Lambda re-reads attribute-limited public snapshot, public asset, Equipment Passport public flag, and profile visibility data, then checks the exact derivative with S3 `HeadObject`. The owner index locates the profile, and a consistent primary-key read confirms current visibility before signing. It never reads `PrivateImageAsset`, a private image key, target-photo data, or a private Storage prefix. An eligible `ready` `equipment_cover` returns a 60-second signed URL, safe alt text, expiry, and zero cache seconds. All missing, mismatched, private, removed, failed, or unavailable cases return the same generic unavailable response. Saved Public Passport detail may render that derivative; Discover and public profiles remain image-free.

Phase 2F.1 adds `PublicImageCleanupStatus`, the `removePublicPassportImage(publicPassportSnapshotId)` owner mutation, and the `publicImageAssetsBySnapshotId` secondary index. The cleanup Lambda revalidates ownership, conditionally removes the snapshot's three image projection fields and marks a safely bound `equipment_cover` ledger row `removed` before S3 deletion. A removed row retains its canonical public key only while deletion needs a retry; a GSI lookup followed by consistent primary-key reads lets repeated snapshot-id-only calls retry safely. Successful cleanup removes the ledger key and alt-text copy. The processor now includes snapshot `updatedAt` in finalization conditions and cannot reactivate a removed asset id, preventing an older processing attempt from winning after cleanup. Phase 2F.2 calls this mutation from an owner-only Public Preview remove control, and Phase 2F.3 calls it before the existing owner-scoped snapshot deletion for derivative-aware Unpublish. Both phases add no schema or backend input. Replacement, visibility/private-source hooks, target-photo support, image reporting/moderation, and scheduled reconciliation remain future work.

## Public Discovery Models

- PublicPassportSnapshot
- PublicUserProfileSnapshot
- PublicRangeSessionSummary
- PublicTargetPhotoPlaceholder
- Comment
- Reaction
- Report

PublicPassportSnapshot should be generated from private records through a sanitization workflow. It should duplicate safe public fields instead of joining directly to private records.

Comments and reactions can be readable to signed-in users for community workflows, but create/update/delete access should remain scoped to the author. Reports should stay scoped to the reporter until an admin/moderation workflow exists.

The hosted-dev moderation queue uses Cognito groups named `admin` and `moderator` for report metadata reads and status-only updates. Field-level authorization keeps reporter identity, target, reason, details, and timestamps read-only to moderators while allowing only `Report.status` to change. Missing or `open` status values are treated as pending for badge/count purposes. Status changes do not perform content actions.

## DynamoDB Access Patterns

- List user Equipment Passports by owner.
- Read a single private passport by owner and id.
- List Range Sessions by owner and equipmentPassportId.
- List Maintenance records by owner and equipmentPassportId.
- List Hunting Readiness checklists by owner.
- List Public Passport snapshots by filters such as equipment type, category, manufacturer, use case tags, and beginner-friendly tags.
- Read public snapshot detail by public id.

## Notes

Private notes, lot numbers, purchase details, exact locations, maintenance details, and image metadata must not be copied into public records.

Run this local validation before deploying a sandbox:

```bash
npm run amplify:typecheck
```

Run the local sandbox only after AWS credentials are configured:

```bash
npm run amplify:sandbox
```
