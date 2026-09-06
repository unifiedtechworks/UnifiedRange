# Phase 2F Public Image Lifecycle Cleanup Plan

Last updated: September 5, 2026

## Purpose and current boundary

Phase 2F should make a processed public Equipment Passport cover safely removable before UnifiedRange expands image rendering beyond saved Public Passport detail pages. It must coordinate public-delivery revocation, snapshot projection changes, derivative deletion, ledger state, retries, and audit without touching the owner-private original.

Phase 2F.1 implements the backend cleanup foundation, Phase 2F.2 adds the first owner-facing removal control, Phase 2F.3 composes that cleanup with owner-scoped snapshot deletion for derivative-aware unpublish, and Phase 2F.4 composes cleanup with the existing consent/processor flow for remove-first replacement. Today:

- Phase 2C can create a bounded, metadata-stripped JPEG derivative from one verified `equipment_cover` candidate.
- Phase 2D requires explicit owner selection, safety acknowledgements, and alt text.
- Phase 2E resolves a 60-second non-cacheable delivery URL and renders the derivative only on saved Public Passport detail.
- `removePublicPassportImage` lets an authenticated owner detach and clean the current derivative by supplying only the public snapshot id.
- A snapshot-indexed `PublicImageAsset` lookup supports retrying a canonical derivative deletion after the projection has already been detached.
- The processor now conditions final projection on the snapshot's existing `updatedAt` generation and refuses to reactivate a `removed` ledger row, so removal wins over an older in-flight processor finalization.
- The developer-only [Phase 2F.1 cleanup harness](PHASE_2F_1_LIFECYCLE_CLEANUP_TESTING.md) exercises the mutation independently of product UI.
- Public Preview shows **Remove public image** only to the signed-in owner when a prepared derivative is attached. It sends only the snapshot id, refreshes to text-only state, and never deletes the private original.
- The hardened UI holds one synchronous operation guard across snapshot saving, the full image processor request, owner removal, replacement cleanup, and derivative-aware unpublish, so publishing, processing, removal, replacement, and unpublishing cannot overlap.
- Cleanup, unpublish, replacement, and processing responses carry in-memory request generations tied to the route, source, and authenticated owner context as appropriate. Context changes invalidate those generations before any late result can reload or overwrite a newer Public Preview.
- Image-bearing Unpublish calls `removePublicPassportImage` with only the snapshot id, waits for confirmed detachment, and only then deletes the sanitized text/setup snapshot.
- **Replace public image** calls the same snapshot-id-only cleanup first and continues to the existing consent/processor flow only after `removed`, `not_attached`, or detach-confirmed `cleanup_pending`. Atomic replacement remains unavailable.
- Discover cards and public profile cards remain image-free.
- Range Session target photos remain private and ineligible.

Phase 2F is a prerequisite for considering any wider public-image surface.

## Safety invariants

Every Phase 2F path must preserve these rules:

1. Revoke new delivery before asynchronous object cleanup.
2. Resolve the current public image from trusted backend records. A client never supplies an S3 key, URL, owner id, source record id, destination path, or image bytes.
3. Validate that the derivative key exactly matches `public/passports/{snapshotId}/cover/{publicImageAssetId}.jpg` before deleting it.
4. Clear or delete the public snapshot projection; never substitute a private image.
5. Preserve the private original unless the owner separately requests its private deletion.
6. Keep `range_session_target` and every non-`equipment_cover` source ineligible.
7. Make retries idempotent and safe when records or objects are already absent.
8. Return bounded user-facing results and log no keys, URLs, filenames, alt text, image bytes, owner/source ids, or tokens.
9. Never restore a removed image automatically. A later public image requires fresh eligibility checks and explicit owner consent.

The existing resolver already fails closed when the snapshot is absent, the account is private, the projection and ledger disagree, the asset is not `ready`, the source is not `equipment_cover`, or the derivative object is missing. Phase 2F should retain those checks as defense in depth.

## Recommended backend ownership

Storage-key resolution and derivative deletion remain backend commands rather than browser Storage operations. Phase 2F.3 safely composes the existing backend cleanup mutation with the existing owner-authorized snapshot delete; the browser still never reads or supplies a key. A future atomic unpublish command may replace this two-call orchestration if durable cleanup scheduling or stronger cross-call atomicity is required.

| Command | Authorization | Accepted client input | Result |
| --- | --- | --- | --- |
| `removePublicPassportImage` | Signed-in snapshot owner | `publicPassportSnapshotId` | **Implemented in Phase 2F.1.** Keep the text snapshot published, detach its image, and attempt/retry exact derivative cleanup |
| Derivative-aware Unpublish | Signed-in snapshot owner | `publicPassportSnapshotId` to cleanup, followed by the same snapshot id for owner-scoped model deletion | **Implemented in Phase 2F.3.** Detach delivery first, then delete sanitized text/setup only after a bounded safe cleanup result |
| Replacement workflow | Signed-in snapshot owner | Cleanup receives only snapshot id; existing processor receives snapshot id, verified private-image asset id, bounded alt text, explicit consent | **Implemented in Phase 2F.4.** Detach the old image, then process and attach a newly verified eligible derivative |
| `moderatePublicPassportImage` | Cognito `admin`/`moderator` group through a separate action | Snapshot id, bounded action and reason code | Hide or remove the current public derivative without private-record access |

Owner removal, derivative-aware unpublish, and future moderation commands accept a snapshot id rather than a public asset id. The backend cleanup resolver conditionally operates on the projection current when the command executes. The frontend also scopes the follow-on snapshot deletion to its route/account request generation so a late response cannot update or delete a different preview.

No lifecycle command should accept a raw public or private key. IAM should grant each function only the DynamoDB attributes and exact public derivative prefix required for its job. Owner cleanup functions need no private-prefix read permission.

## Core detach-first state transition

The Phase 2F.1 durable transition stops future resolver calls before S3 deletion is treated as complete:

1. Authenticate the caller and resolve the canonical Cognito owner identity on the backend.
2. Read the current snapshot projection and its `PublicImageAsset` ledger row with consistent reads.
3. Revalidate snapshot ownership, `ready` state, `equipment_cover`, projection/ledger agreement, and the exact derivative-key grammar.
4. Execute a conditional DynamoDB transaction that:
   - removes `publicImageAssetId`, `publicImageKey`, and `publicImageAltText` from the retained text snapshot;
   - changes the matching ledger asset to a non-deliverable lifecycle state; and
   - retains the canonical public key only on the removed owner-private ledger row while deletion needs a retry.
5. Delete the exact derivative object. S3 `NoSuchKey` is a successful idempotent outcome.
6. Finalize the cleanup record and clear the ledger's key/alt-text copy when it is no longer required to retry deletion.
7. A repeated mutation can find the removed ledger row by snapshot id and retry while the snapshot still exists. If derivative-aware unpublish continues after `cleanup_pending`, the snapshot is revoked and the protected removed ledger row retains the cleanup state for future operator or durable reconciliation; scheduled reconciliation remains future work.

The conditional transaction must compare the expected snapshot id, current asset id, current key, and current lifecycle generation. If another operation has changed any of them, the command should re-read and either return an already-complete result or stop with a bounded conflict result. It must never delete an object found only in stale browser state.

Removing the projection prevents the resolver from issuing a new URL. A URL already issued before revocation may work until the object is deleted or its maximum 60-second signature expires. The cleanup worker should therefore attempt `DeleteObject` immediately after detachment. If policy later requires instantaneous revocation of already-issued URLs, delivery must move behind a revocable proxy or equivalent control; UI hiding alone cannot invalidate an S3 presigned URL.

## Future lifecycle state and audit decision

The current `PublicImageAssetStatus` values are `draft`, `processing`, `ready`, `failed`, and `removed`. They are enough to make an owner-removed asset non-deliverable, but they do not distinguish:

- owner removal from unpublish, replacement, account privacy, missing-object repair, or moderation;
- a derivative awaiting S3 deletion from one whose deletion completed; or
- reversible moderation hiding from permanent removal.

Phase 2F.1 uses the existing `removed` asset status plus presence of the canonical ledger key as its minimal cleanup-pending representation. Successful deletion clears the ledger key and alt-text copy. The new owner-only snapshot index permits a repeated snapshot-id-only call to find that removed row. A later lifecycle release should still decide whether to:

- keep public eligibility in the asset status, adding a non-deliverable `hidden` status if reversible moderator hiding is required;
- add a dedicated bounded cleanup state or persist durable retry state in a private cleanup job record;
- store bounded reason codes and lifecycle timestamps, never free-form sensitive content; and
- record append-only lifecycle events in a backend-only audit store.

An audit event should contain opaque snapshot/asset references, action, actor class (`owner`, `moderator`, `system`), bounded reason code, prior/new state, timestamp, idempotency key, and outcome. It should not contain the private source key, public URL, original filename, alt text, image bytes, profile data, or report narrative. Moderator identity may be retained in a protected administrative audit attribute, never a public response.

Phase 2F.1 adds the cleanup result enum and `PublicImageAsset.publicPassportSnapshotId` secondary index, but no public/private image field or moderator state. Audit and durable-job schema remain future decisions.

## Owner-initiated image removal

Public Preview now adds **Remove public image** in Phase 2F.2 only for the signed-in owner when the saved snapshot has a current prepared derivative. Phase 2F.1 supplies the backend mutation, narrow client helper, and developer harness; Phase 2F.2 is only the owner UI slice and adds no backend contract.

Recommended flow:

1. Explain that the public setup will stay published without an image and the private original will be unchanged.
2. Require an explicit confirmation.
3. Send only `publicPassportSnapshotId` to `removePublicPassportImage`.
4. The backend performs the detach-first transition and returns `removed`, `not_attached`, `cleanup_pending`, or `failed`, plus only a bounded failure code when needed.
5. Refresh the snapshot. The public detail immediately becomes text-only; the UI shows a bounded cleanup-pending notice and retains a same-tab retry marker containing only the public snapshot-scoped state, never a key, URL, owner/source identity, token, filename, alt text, or image data.
6. Complete or retry derivative deletion in the backend.

`removed` is a success, `not_attached` is an idempotent no-op success, `cleanup_pending` means public delivery is already detached while exact derivative cleanup needs a retry, and `failed` is a bounded retry-safe failure. The UI never renders raw GraphQL, Lambda, DynamoDB, S3, IAM, or AWS error text.

Repeated requests succeed safely. A missing projection returns `not_attached` unless an indexed removed ledger row still has canonical cleanup pending. An already-missing S3 object is a successful idempotent delete. Missing/foreign snapshot IDs share `unauthorized` because a deleted/unpublished snapshot cannot be ownership-verified without adding an existence oracle.

## Derivative-aware unpublish

Phase 2F.3 preserves direct owner-scoped deletion for a text-only snapshot. When a prepared derivative or same-tab cleanup-pending marker exists, Public Preview instead uses this ordered flow:

1. Explain that the processed public image is detached first, the sanitized text/setup is then unpublished, and neither the private original nor private Equipment Passport is deleted.
2. Call `removePublicPassportImage` with only `publicPassportSnapshotId`.
3. Continue to snapshot deletion only for `removed`, `not_attached`, or `cleanup_pending`. All three mean no current public image projection remains; `cleanup_pending` additionally means exact object cleanup still needs retry or reconciliation.
4. Stop before snapshot deletion for `failed`, an unknown result normalized to failure, or a network/auth failure. Show only a bounded message and leave the public text/setup published.
5. Delete the same snapshot through the existing owner-authorized model operation. The public detail and Discover entry then become unavailable.

If cleanup detaches delivery but text deletion fails, Public Preview refreshes the snapshot and explains that the image is unavailable while the sanitized text/setup may remain published. The owner can retry Unpublish without reprocessing an image. A cleanup-pending retry remains available while the snapshot exists. If text deletion succeeds after `cleanup_pending`, the page is unpublished immediately; the removed ledger row remains the backend signal for later reconciliation because no scheduled reconciler exists yet.

The flow uses one synchronous mutation guard and a route/account-scoped request generation. Publish, processing, owner removal, and duplicate Unpublish cannot overlap, and a late result cannot apply to another passport. No cleanup/unpublish request contains a key, path, URL, asset id, owner id, source id, filename, image bytes, or private identifier. Public comments, reactions, reports, and moderation evidence continue to follow their separately documented retention policy.

## Replacement behavior

Phase 2F.4 implements replacement by favoring privacy and simple recovery over seamless visual availability:

1. Ask the owner to confirm that the current public image will be removed first and that a new private cover has been uploaded and verified.
2. Send only `publicPassportSnapshotId` to `removePublicPassportImage` and continue only for `removed`, `not_attached`, or detach-confirmed `cleanup_pending`.
3. Complete the non-deliverable projection transition. The text snapshot remains public without an image, and a cleanup-pending old object remains unavailable while backend reconciliation is still needed.
4. Let the owner select one newly verified, current JPEG/PNG `equipment_cover` candidate through the existing consent flow.
5. Require the full safety checklist and new bounded alt text again.
6. Process the new derivative with only the existing narrow processor inputs: snapshot id, private candidate id, bounded alt text, and internal consent confirmation.
7. Attach it only if the snapshot is still owned, published, public, image-empty at the expected lifecycle generation, and otherwise eligible.

If cleanup fails, returns an unknown result, or encounters a network/auth error, replacement does not start. If new processing fails after safe detachment, the setup remains safely text-only and the owner can retry or cancel the in-page replacement flow. The old derivative is not restored automatically. This avoids a stale image surviving because a replacement failed midway.

The backend should create a new immutable asset generation and versioned derivative key for a replacement. It should not reactivate a `removed` ledger row or reuse a removed key, even when the same private candidate and alt text are selected again. A lifecycle generation/conditional version on the snapshot prevents an older processing invocation from attaching after removal, unpublish, an account-private transition, or a newer replacement.

A later atomic-cutover design could prepare a new unattached derivative before switching references, but it would leave the old image public until cutover and requires more complex consent, rollback, and race semantics. It is not recommended for the first cleanup release.

## Required behavior by lifecycle event

### Account visibility changes to private

- Persist the private visibility state first. The existing resolver then stops issuing new URLs immediately.
- Enqueue cleanup for every current public image owned by the account and detach each projection conditionally.
- Apply the existing public-profile/text-snapshot visibility policy consistently; do not leave an image reachable because a public profile snapshot is stale.
- Attempt immediate derivative deletion and retry failures.
- Do not restore images if the account later becomes public. The owner must explicitly republish/re-consent.

The visibility-setting workflow should eventually invoke a backend orchestrator or emit a trusted data-change event. It must not rely on the settings page discovering and deleting every image from the browser.

### Public snapshot is unpublished

- Use Phase 2F.3's derivative-aware owner flow: conditionally detach/mark the current asset non-deliverable through `removePublicPassportImage`, then delete the same snapshot only after a safe bounded cleanup result.
- Keep the two calls under one frontend operation guard and one route/account request generation. A future atomic backend command can replace this orchestration when durable reconciliation is introduced.
- If exact derivative deletion remains pending after delivery detachment, allow snapshot unpublish and retain the protected removed ledger state for later reconciliation.
- Preserve the private source and protected lifecycle/moderation evidence.

### Private original is deleted or replaced

- Treat deletion or replacement of the authoritative private cover as a privacy-first revocation signal.
- Detach the matching public projection before allowing a new public derivative to be attached.
- Allow the requested private deletion to complete once public delivery is revoked; public object deletion may retry separately.
- Mark the prior public asset removed with a bounded `private_source_deleted` or `private_source_replaced` reason.
- Require fresh verification and consent for any new source.

Private image deletion is not currently part of Phase 2F implementation. When added, it must be coordinated through a backend workflow or trusted event rather than a best-effort client cleanup. Target-photo deletion must never enter the public-image workflow.

### Public derivative object is missing

- Continue returning the existing generic resolver-unavailable result with no private fallback.
- Reconciliation should clear a stale snapshot projection, mark the asset non-deliverable with an `object_missing` reason, and close cleanup idempotently.
- The UI should remain text-only and show no S3/object diagnostic to public viewers.
- Recreating the image requires an explicit owner action and fresh consent; the system must not silently reconstruct it from the private original.

### Public image asset is removed or hidden

- Any state other than the exact eligible `ready` state remains non-deliverable.
- Clear a projection that still points to a removed/hidden asset.
- Owner removal proceeds to derivative deletion.
- Moderator hiding follows the moderation retention rule below but never exposes or changes the private original.

## Moderation and reporting plan

Image reporting and moderation remain future work. The current report target enum has no `public_image` value, and report-status updates do not authorize content or image mutation.

Recommended future boundary:

1. A signed-in viewer reports the image from the public passport detail using `publicPassportSnapshotId`, a bounded reason, and optional bounded context. The backend resolves the current public asset; the browser does not submit an S3 key or private asset id.
2. Add a dedicated `public_image` report target, or an equally explicit typed relation, so reports distinguish the image from the text snapshot.
3. Moderators see only the processed public derivative and public report metadata. They receive no `PrivateImageAsset`, private source record, private key, original filename, or private image permission.
4. A separate group-authorized moderation action supports:
   - **Hide**: immediately make the asset non-deliverable, detach it, and retain only the minimum protected evidence required by policy.
   - **Remove**: make it non-deliverable, detach it, and permanently delete the public derivative.
5. Both actions preserve the owner-private original. The report status remains a separate review outcome and does not itself mutate the image.
6. Every action records an append-only protected audit event with actor, bounded reason, timestamp, prior/new state, and cleanup outcome.

Because an already-issued URL can survive for up to 60 seconds, a hide command should attempt immediate derivative deletion from the delivery prefix. If reversible evidence retention is required, copy only the processed public derivative to a separate moderator-only quarantine boundary before deleting the deliverable object. The normal resolver and browser must have no access to that quarantine location. Unhiding should not automatically republish; owner re-consent and fresh processing are safer.

## Cleanup worker and reconciliation

The request path should do the minimal detach-first transaction and an immediate exact-key delete attempt. A durable worker should handle retryable cleanup without granting the public resolver delete permission.

Required worker behavior:

- consume an idempotency key derived from operation, snapshot, asset generation, and lifecycle version;
- re-read trusted ledger state before deletion;
- accept only a canonical public derivative key resolved from the ledger;
- treat `NoSuchKey` as success;
- use bounded exponential backoff, a dead-letter path, and operational metrics with no sensitive dimensions;
- clear the ledger key/alt-text copy after confirmed deletion when no protected retention rule requires it; and
- never read, delete, or copy a private original.

A scheduled reconciler should detect and repair:

- a snapshot projection referencing a missing, non-ready, removed, hidden, or mismatched asset;
- a ready asset no longer referenced by its snapshot;
- a public object whose snapshot or ledger no longer exists;
- a removed asset whose public projection or derivative still exists;
- a projected derivative missing from S3;
- an asset whose account is private or source record is no longer eligible; and
- abandoned processing/staging objects older than a bounded threshold.

Orphan discovery may require tightly scoped list permission on the public derivative prefix. Give that permission only to the reconciler, not the public resolver, browser, or ordinary owner action. Reconciliation should never infer or expose a private path from a public key.

## Concurrency and rollback rules

Lifecycle revocation must win over processing:

- Removal, unpublish, account-private, private-source deletion, and moderator hide advance a lifecycle generation or create a tombstone.
- Processor finalization conditionally requires the same active generation and expected empty/current projection.
- A stale processor may delete only the derivative it just wrote; it cannot restore a detached projection.
- Two cleanup requests converge on the same non-deliverable state.
- Two replacements cannot both attach. The losing derivative is queued for deletion.
- Snapshot deletion makes every later processor finalization fail closed.

If the DynamoDB detach transaction fails, do not delete an object that might still be the current public image. If detachment succeeds and S3 deletion fails, keep delivery revoked and retry deletion. Never roll the projection back merely to compensate for cleanup failure.

## UI states and copy

Phase 2F implementation should keep lifecycle controls in owner-only Public Preview:

- **Remove public image** — keeps the sanitized text snapshot public.
- **Unpublish** — if needed, detaches the public derivative first and then removes the sanitized snapshot.
- **Replace public image** — removes/detaches the old derivative first, then unlocks a fresh consent/checklist/alt-text pass for a newly verified current cover.

Owner states are bounded: confirming in the native owner dialog, removing the old image, ready for a new verified cover, processing the replacement, replacement prepared, cleanup pending but delivery detached, cleanup failed with no replacement, replacement processing failed with retry available, detaching for unpublish, unpublishing text/setup, unpublished, and image detached but text unpublish failed. Public pages simply become text-only after detachment, show only the newly eligible derivative after replacement succeeds, or become unavailable after unpublish, with no raw error or technical status.

No Phase 2F control belongs on Discover or public profile cards, and no target-photo control should be introduced.

## IAM and logging requirements

- Owner lifecycle Lambda: authenticated command invocation; narrow read/update/delete access to the current snapshot/asset and delete access only to the canonical public derivative prefix.
- Visibility/event cleanup: protected backend invocation; query only the owner's public snapshots/assets through a purpose-built index.
- Moderator action: `admin`/`moderator` group authorization, separate from report-status permission; no private image or private-record access.
- Resolver: remains read/head-only and cannot delete or list.
- Reconciler: narrowly scoped public-prefix list/head/delete only if required; no private-prefix access.
- Browser/API-key principals: no direct public derivative Storage access and no lifecycle mutation access.

Logs and metrics should use fixed event names and bounded failure/reason codes. Do not log ids, keys, URLs, filenames, alt text, image contents, profile fields, or tokens.

## Suggested implementation phases

### Phase 2F.0: contract and deployment design

- Finalize lifecycle states, cleanup durability, lifecycle generation, audit retention, and safe response codes.
- Decide the minimal schema additions required for cleanup-pending and moderator-hidden state.
- Threat-model IAM, race behavior, presigned-URL revocation, and retained moderation evidence.

### Phase 2F.1: backend owner-removal foundation

- [x] Add the owner-authorized `removePublicPassportImage(publicPassportSnapshotId)` mutation.
- [x] Implement conditional detach-first projection/ledger updates and exact-key cleanup.
- [x] Add snapshot-indexed retry support, processor/removal concurrency guards, a narrow client helper, and developer harness.
- [x] Deploy the Phase 2F.1 backend to the configured developer sandbox.
- [ ] Complete the hosted positive/adversarial checklist.

### Phase 2F.2: owner removal UI

- [x] Add the explicit owner-facing remove control and refresh the text-only snapshot after removal or detach-pending cleanup.
- [x] Keep the private original unchanged, send only the public snapshot id, and show only bounded owner states.
- [x] Block all overlapping publish/process/remove/unpublish operations for the full request lifetime.
- [x] Invalidate route/account-stale cleanup and processing responses before they can update a newer preview.
- [x] Keep cleanup-pending same-tab retry state free of image keys and private identifiers.

### Phase 2F.3: derivative-aware unpublish

- [x] Preserve the existing direct owner deletion for text-only snapshots.
- [x] For image-bearing snapshots, call the backend cleanup mutation first and continue only after `removed`, `not_attached`, or detach-confirmed `cleanup_pending`.
- [x] Stop on failed/unknown/network/auth cleanup results and keep the text snapshot published.
- [x] Block overlapping lifecycle actions and discard route/account-stale cleanup or delete responses.
- [x] Provide bounded recovery when image detachment succeeds but text deletion fails.
- [ ] Complete the hosted positive, failure, cleanup-pending, recovery, and stale-navigation checklist.

### Phase 2F.4: owner-facing remove-first replacement

- [x] Add **Replace public image** only to the signed-in owner's saved Public Preview when an image is attached or cleanup is pending.
- [x] Call the existing cleanup operation with only the snapshot id and continue only after `removed`, `not_attached`, or detach-confirmed `cleanup_pending`.
- [x] Reuse the existing current-candidate validation, private preview, full safety checklist, bounded alt text, and narrow processor contract.
- [x] Keep the sanitized text/setup published and the private original unchanged across cleanup and processing outcomes.
- [x] Block overlapping mutations, compare the refreshed current private-cover key with the source captured before cleanup, and invalidate replacement when the route, account, or source changes; candidate and processing requests use the same source-aware fail-closed behavior.
- [ ] Complete hosted positive, cleanup-pending, failure, recovery, retry, cancel, and stale-navigation checks.

Atomic prepare-and-cutover replacement remains a future option. The implemented flow intentionally creates a text-only interval and never restores the old derivative automatically.

### Phase 2F.5: lifecycle hooks and reconciliation

- Integrate account-private and private-source deletion/replacement events.
- Add durable retries, dead-letter handling, metrics, and scheduled orphan reconciliation.
- Test missing records/objects and partially completed operations.

### Phase 2F.6: image reporting and moderation

- Add a typed public-image report path.
- Add group-authorized hide/remove actions, quarantine only if policy requires it, and protected audit history.
- Verify moderators cannot access private originals or private image records.

### Phase 2F.7: release validation

- Run owner, other-owner, signed-out, moderator, admin, concurrent, retry, and object-missing tests.
- Confirm issued URLs expire within the current 60-second bound and no new URL is issued after revocation.
- Confirm removal/unpublish/replacement never exposes or deletes the private original.
- Only after these gates pass should Discover or public profile rendering be reconsidered.

## Phase 2F QA matrix

| Scenario | Expected public result | Expected private result | Cleanup/audit expectation |
| --- | --- | --- | --- |
| Owner removes image | Text detail remains; no new image URL | Original unchanged | Projection cleared, asset removed, object deleted/retried |
| Owner unpublishes snapshot | Detail and resolver unavailable | Passport/original unchanged | Snapshot revoked, asset removed, object deleted/retried |
| Owner replaces image | Text-only gap, then only new derivative | Both private source records follow normal owner lifecycle | Old object removed; new immutable asset/consent audited |
| Account becomes private | Public profile/content follows privacy policy; no new image URL | All owner data unchanged | All public projections detached and derivatives cleaned |
| Private original deleted/replaced | Public image is revoked; no fallback | Requested private change completes | Prior public asset removed; new consent required |
| Derivative missing | Text-only detail; generic unavailable | Original unchanged | Projection reconciled, asset marked non-deliverable |
| Moderator hides/removes | Image unavailable; text follows content policy | Original unchanged and unreadable to moderator | Protected report/action/cleanup audit retained |
| Duplicate/retried command | Same safe end state | Original unchanged | No duplicate live objects or conflicting audit outcome |

## Explicitly out of scope

The current Phase 2F.1-2F.4 release does not implement:

- atomic prepare-and-cutover replacement, queues, streams, or scheduled reconciliation;
- moderator lifecycle state or audit models;
- Discover or public profile image rendering;
- target-photo publishing or cleanup as public media;
- galleries, feeds/follows, marketplace behavior, or account deletion; or
- calculators, scope outputs, hold recommendations, field corrections, sight-in instructions, or aiming/adjustment guidance.
