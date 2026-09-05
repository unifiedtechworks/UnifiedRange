# Phase 2F Public Image Lifecycle Cleanup Plan

Last updated: August 31, 2026

## Purpose and current boundary

Phase 2F should make a processed public Equipment Passport cover safely removable before UnifiedRange expands image rendering beyond saved Public Passport detail pages. It must coordinate public-delivery revocation, snapshot projection changes, derivative deletion, ledger state, retries, and audit without touching the owner-private original.

Phase 2F.1 now implements the backend cleanup foundation, and Phase 2F.2 adds the first owner-facing removal control. Today:

- Phase 2C can create a bounded, metadata-stripped JPEG derivative from one verified `equipment_cover` candidate.
- Phase 2D requires explicit owner selection, safety acknowledgements, and alt text.
- Phase 2E resolves a 60-second non-cacheable delivery URL and renders the derivative only on saved Public Passport detail.
- `removePublicPassportImage` lets an authenticated owner detach and clean the current derivative by supplying only the public snapshot id.
- A snapshot-indexed `PublicImageAsset` lookup supports retrying a canonical derivative deletion after the projection has already been detached.
- The processor now conditions final projection on the snapshot's existing `updatedAt` generation and refuses to reactivate a `removed` ledger row, so removal wins over an older in-flight processor finalization.
- The developer-only [Phase 2F.1 cleanup harness](PHASE_2F_1_LIFECYCLE_CLEANUP_TESTING.md) exercises the mutation independently of product UI.
- Public Preview shows **Remove public image** only to the signed-in owner when a prepared derivative is attached. It sends only the snapshot id, refreshes to text-only state, and never deletes the private original.
- Replacement and derivative-aware unpublish remain blocked after a derivative is prepared.
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

Lifecycle operations should be backend commands, not a sequence of browser model updates and Storage deletes. Recommended future commands are:

| Command | Authorization | Accepted client input | Result |
| --- | --- | --- | --- |
| `removePublicPassportImage` | Signed-in snapshot owner | `publicPassportSnapshotId` | **Implemented in Phase 2F.1.** Keep the text snapshot published, detach its image, and attempt/retry exact derivative cleanup |
| `unpublishPublicPassport` | Signed-in snapshot owner | `publicPassportSnapshotId` | Revoke/delete the public snapshot and schedule its derivative cleanup |
| Replacement workflow | Signed-in snapshot owner | Existing processor contract: snapshot id, verified private-image asset id, bounded alt text, explicit consent | Detach the old image, then process and attach a new eligible derivative |
| `moderatePublicPassportImage` | Cognito `admin`/`moderator` group through a separate action | Snapshot id, bounded action and reason code | Hide or remove the current public derivative without private-record access |

The owner removal and moderation commands should accept a snapshot id rather than a public asset id. The backend resolves and conditionally operates on the projection that is current when the command executes. This prevents a stale page from removing a replacement it did not display.

No lifecycle command should accept a raw public or private key. IAM should grant each function only the DynamoDB attributes and exact public derivative prefix required for its job. Owner cleanup functions need no private-prefix read permission.

## Core detach-first state transition

The Phase 2F.1 durable transition stops future resolver calls before S3 deletion is treated as complete:

1. Authenticate the caller and resolve the canonical Cognito owner identity on the backend.
2. Read the current snapshot projection and its `PublicImageAsset` ledger row with consistent reads.
3. Revalidate snapshot ownership, `ready` state, `equipment_cover`, projection/ledger agreement, and the exact derivative-key grammar.
4. Execute a conditional DynamoDB transaction that:
   - removes `publicImageAssetId`, `publicImageKey`, and `publicImageAltText` from a retained text snapshot, or deletes the snapshot for unpublish;
   - changes the matching ledger asset to a non-deliverable lifecycle state; and
   - retains the canonical public key only on the removed owner-private ledger row while deletion needs a retry.
5. Delete the exact derivative object. S3 `NoSuchKey` is a successful idempotent outcome.
6. Finalize the cleanup record and clear the ledger's key/alt-text copy when it is no longer required to retry deletion.
7. A repeated mutation can find the removed ledger row by snapshot id and retry. Durable background backoff/dead-letter reconciliation remains future work.

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

Repeated requests succeed safely. A missing projection returns `not_attached` unless an indexed removed ledger row still has canonical cleanup pending. An already-missing S3 object is a successful idempotent delete. Missing/foreign snapshot IDs share `unauthorized` because a deleted/unpublished snapshot cannot be ownership-verified without adding an existence oracle.

## Derivative-aware unpublish

The browser currently deletes a text-only `PublicPassportSnapshot` directly and blocks unpublish when an image projection exists. Phase 2F should replace this with one owner-authorized backend unpublish command for both text-only and image-bearing snapshots.

For an image-bearing snapshot, the command should transactionally mark the current asset non-deliverable and delete the public snapshot. Deleting the snapshot is equivalent to clearing all public text/image projection fields and makes both the public detail and resolver unavailable. The asset ledger or private cleanup job must retain the exact validated derivative locator only until S3 cleanup succeeds; it must not depend on a deleted snapshot to remember the object.

For a text-only snapshot, the same command should remain idempotent and preserve current unpublish behavior. Public comments, reactions, reports, and moderation evidence must follow their separately documented retention policy; the image cleanup command must not silently broaden into destructive moderation or private-record deletion.

If object deletion fails after the snapshot is revoked, unpublish should still remain effective. The object is not directly readable through Amplify Storage, the resolver cannot authorize it without the snapshot, and cleanup can retry safely. The owner-private Equipment Passport and private image remain unchanged.

## Replacement behavior

The first Phase 2F replacement should favor privacy and simple recovery over seamless visual availability:

1. Ask the owner to remove/detach the current public image.
2. Complete the non-deliverable projection transition. The text snapshot remains public without an image.
3. Let the owner select one current verified JPEG/PNG `equipment_cover` candidate through the existing consent flow.
4. Require the full safety checklist and new bounded alt text again.
5. Process the new derivative with the existing narrow processor inputs.
6. Attach it only if the snapshot is still owned, published, public, image-empty at the expected lifecycle generation, and otherwise eligible.
7. Delete the old derivative independently with idempotent retries.

If new processing fails, the setup remains safely text-only. The old derivative is not restored automatically. This avoids a stale image surviving because a replacement failed midway.

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

- Use the derivative-aware backend command described above.
- Revoke/delete the snapshot and mark its current asset non-deliverable in one conditional transaction.
- Delete the derivative asynchronously if necessary.
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
- **Unpublish public setup** — removes the public snapshot and its image reference.
- **Replace public image** — first removes the old public image, then begins a fresh consent flow.

Owner states should be bounded: removing, public image removed, cleanup pending, replacement ready, and unable to complete. Public pages should simply fall back to the sanitized text detail with no raw error or technical status. Settings copy for changing an account to private should explain that public images will be removed and will not return automatically.

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

### Phase 2F.3: derivative-aware unpublish and replacement

- Replace direct snapshot deletion with a derivative-aware backend unpublish command.
- Add detach-first replacement orchestration with a new immutable asset generation.
- Require fresh verification, checklist, consent, and alt text.
- Prove stale processor invocations cannot reattach an old image.

### Phase 2F.4: lifecycle hooks and reconciliation

- Integrate account-private and private-source deletion/replacement events.
- Add durable retries, dead-letter handling, metrics, and scheduled orphan reconciliation.
- Test missing records/objects and partially completed operations.

### Phase 2F.5: image reporting and moderation

- Add a typed public-image report path.
- Add group-authorized hide/remove actions, quarantine only if policy requires it, and protected audit history.
- Verify moderators cannot access private originals or private image records.

### Phase 2F.6: release validation

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

Phase 2F.1 and the current Phase 2F.2 owner UI slice do not implement:

- derivative-aware unpublish, replacement, queues, streams, or scheduled jobs;
- moderator lifecycle state or audit models;
- Discover or public profile image rendering;
- target-photo publishing or cleanup as public media;
- galleries, feeds/follows, marketplace behavior, or account deletion; or
- calculators, scope outputs, hold recommendations, field corrections, sight-in instructions, or aiming/adjustment guidance.
