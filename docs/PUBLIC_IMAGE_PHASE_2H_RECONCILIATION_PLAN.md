# Phase 2H Protected Public Image Reconciliation Plan

## Status and scope

Phase 2H planning is complete. Phase 2H.1 implements the protected, read-only inspection subset through `inspectPublicImageCleanup(publicImageAssetId)`. Phase 2H.2 adds a separate, admin-only `retryRemovedPublicImageCleanup(publicImageAssetId, confirmation)` mutation for one already-removed, detached equipment-cover generation. Its backend-controlled execution gate is hard-coded to `false` in every deployed environment in this phase, so the deployed function returns `disabled` before any data or S3 operation. There is no schedule, queue, task model, bucket scan, user-facing control, or live cleanup authorization.

Phase 2H.3 records read-only hosted deployment assurance for the Phase 2H.2 checkpoint and prepares a future sandbox-only test procedure. See [Phase 2H Hosted Deployment Assurance](PUBLIC_IMAGE_PHASE_2H_DEPLOYMENT_ASSURANCE.md) and [Controlled Cleanup Test Runbook](PHASE_2H_CONTROLLED_CLEANUP_TEST_RUNBOOK.md). The assurance work did not enable the global gate, invoke cleanup, create a fixture, or deploy infrastructure.

The current product already fails closed for public delivery: the resolver issues a short-lived URL only when the published snapshot, its projected image generation, the `PublicImageAsset` ledger row, source eligibility, account visibility, moderation state, canonical key, and S3 object all agree. Owner removal, derivative-aware Unpublish, replacement, and moderator Remove detach delivery before attempting object deletion. Those controls can therefore leave a non-deliverable derivative that still needs exact cleanup after a timeout or partial failure.

Phase 2H must recover those objects without broadening public access, reading private originals, guessing across image generations, or weakening generation-bound report and moderation evidence.

### Phase 2H.1 implemented boundary

The Phase 2H.1 query accepts one bounded `PublicImageAsset` generation ID. AppSync permits only the Cognito `admin` group, and the Lambda repeats that group check from trusted identity context. Moderator-only users, ordinary users, signed-out callers, and API-key callers are not authorized. Operational reconciliation starts admin-only because its findings concern cross-lifecycle storage state rather than ordinary report review; moderators retain their narrower current-image review/action boundary.

The Lambda performs strongly consistent, attribute-limited base-table reads of the named asset and its associated `PublicPassportSnapshot`. It derives and validates the existing canonical equipment-cover path, uses `HeadObject` only, and re-reads both records before returning. A changed record returns `state_changed`; a 403 is inaccessible/indeterminate, while only a 404 is confirmed missing. No secondary index, profile/private-record read, object download, presigned URL, write, detach, cleanup action, or deletion is used.

The bounded response contains only `assessmentStatus`, allow-listed `findingCodes`, `recommendedNextStep`, `inspectedAt`, and `retryable`. Recommendations are `no_action`, `manual_review`, `retry_inspection`, or `cleanup_candidate_for_future_review`. The last value is a review classification, not `safe_to_delete` permission. Keys, URLs, owner/source identifiers, filenames, alt text, ledger contents, report details, object metadata, and raw AWS errors are never returned.

Phase 2H.1 can assess a current attached generation, a detached or removed generation, an intentionally hidden generation, a missing snapshot, a different projected generation, a missing/inaccessible derivative, malformed/legacy/inconsistent bindings, an active or expired processing lease, and state changes during inspection. Hidden, reported, missing-snapshot, different-generation, legacy, malformed, target-photo, and otherwise ambiguous cases remain retained or manual-review outcomes. An orphan object with no ledger row cannot be discovered from an asset-ID query; bucket listing remains intentionally absent.

Automated mocked coverage exercises authorization, invalid/missing assets, attached/detached/hidden/replacement states, target-photo rejection, canonical-key rejection, S3 success/403/404/transient results, state races, bounded output, and the read/head-only dependency surface. Hosted authenticated integration scenarios remain pending in the manual QA checklist.

### Phase 2H.2 implemented boundary

`retryRemovedPublicImageCleanup` is independent from the inspector. It does not accept an inspection result, recommendation, key, path, URL, bucket, ETag, object version, snapshot/owner/source identifier, force flag, or batch. AppSync and the Lambda both require Cognito `admin`; the request must contain one exact `img-` plus 40 lowercase hexadecimal asset id and `confirmation: true`. The backend execution gate is not client-controlled and remains `false`. A disabled invocation performs zero DynamoDB reads/writes and zero S3 calls.

When a later separately approved deployment enables the gate, the mutation re-derives all authority from current trusted state. It accepts only an `equipment_cover` asset already in server-managed `removed` status with `moderationStatus` exactly `clear` or `removed`, a valid owner/source/snapshot binding, a fully detached snapshot projection, and either no retained key or the exact canonical derivative key. Current, replacement-generation, partial, hidden, legacy, malformed, missing-ledger, target-photo, active/draft/processing/ready, and otherwise ambiguous states fail closed. A snapshot referencing a different generation remains `manual_review` in this first write-capable slice.

The Lambda checks that the configured bucket is unversioned, then transactionally condition-checks the detached snapshot while conditionally claiming the asset. The transaction does not use both `ConditionCheck` and `Update` on the same item. Claims have a five-minute lease, and exact `updatedAt` conditions prevent concurrent callers from stealing the same retry-pending state. The processor already refuses to reuse an asset in `removed` status, so the claimed generation cannot be reactivated through the existing writer. The Lambda re-reads both records after the claim and again immediately before S3 deletion. Final completion or retry state is conditional on the exact attempt id and claimed state, so an older worker cannot overwrite a newer attempt.

S3 access is limited to metadata read and delete on the processed-cover prefix. The function obtains the current ETag with `HeadObject`, validates JPEG MIME and the two-megabyte derivative bound, and sends that exact ETag as `DeleteObject.IfMatch`. It never treats ETag as a content hash. A 403 is inaccessible, a 404 is confirmed missing only after lifecycle validation, a precondition failure is `state_changed`, and an ambiguous timeout remains retryable until a follow-up `HeadObject` proves absence. `cleaned` means an unversioned-bucket conditional delete was followed by confirmed object absence and an exact-attempt ledger finalization; it never means merely attempted.

Runtime bucket-versioning inspection is mandatory. `Enabled` and `Suspended` buckets return `manual_review`; Phase 2H.2 does not create/delete versions, delete markers, or object history, and it never silently falls back to an unconditional delete. The configured developer sandbox bucket was observed as unversioned during implementation, but the gate remains disabled and no cleanup invocation was performed. Hosted bucket behavior and live deletion remain unverified release gates.

Five minimal owner-readable/client-nonwritable coordination fields are added to `PublicImageAsset`: `cleanupAttemptId`, `cleanupAttemptStatus`, `cleanupAttemptStartedAt`, `cleanupAttemptFailureCode`, and `cleanupCompletedAt`. They provide conditional retry safety only and are not a complete audit trail. Report rows and generation bindings are preserved.

The bounded results are `disabled`, `not_eligible`, `already_missing`, `cleaned`, `retry_pending`, `state_changed`, `manual_review`, and `failed`. Responses and logs contain only allow-listed status/failure values and never expose keys, URLs, ETags, version ids, storage metadata, owner/source identifiers, private data, report details, or raw AWS errors.

## Current implementation facts

- Public derivatives use the canonical form `public/passports/{publicPassportSnapshotId}/cover/{publicImageAssetId}.jpg`.
- `PublicImageAsset.id` is already the immutable image-generation identifier. A second generation field is not required for the first reconciliation release.
- `PublicImageAsset` has an index named `publicImageAssetsBySnapshotId`, so a protected service can look up ledger rows for one known snapshot without scanning the table.
- The processor uses a five-minute processing lease, writes the S3 object before the DynamoDB finalization transaction, and attempts an exact-key rollback delete if finalization fails.
- Owner Remove and moderator Remove detach the snapshot projection and mark the matched ledger generation `removed` before exact-key deletion. They retain the canonical key only while cleanup needs a retry.
- Moderator Hide detaches delivery and intentionally retains the processed derivative with `moderationStatus = hidden` for a later explicit Remove or retention decision.
- New public-image reports bind to one immutable `PublicImageAsset` generation and update `lastReportAt`. Report workflow status remains independent from image availability.
- Browsers and API-key callers have no direct Storage grant for the public derivative namespace. The resolver can read only processed public derivatives; cleanup functions can delete only from the public cover prefix.
- Target photos and private source paths remain outside the public image pipeline.

## Threat model and non-negotiable invariants

Phase 2H.1 is not a destructive operator. The future write-capable reconciler would be one, and a false positive could delete the current public derivative or erase retained moderation evidence. The implemented inspection and every future phase therefore follow these rules:

1. No public or API-key authorization. The first operator action should be `admin` only, with a second group check inside the Lambda. Ordinary users and moderators must not receive a general orphan-cleanup tool.
2. Phase 2H.1 accepts only one normalized `PublicImageAsset` generation ID and has no mode or action input. Do not accept keys, paths, URLs, owner IDs, source IDs, snapshot IDs, filenames, image bytes, destination values, or cleanup flags from this query. A future write action requires its own independently reviewed contract.
3. Re-read the asset and associated snapshot from trusted base tables on every inspection. Never trust a prior inspection result when designing or applying future cleanup.
4. Derive the only deletable key from the trusted snapshot ID and immutable ledger asset ID, then require exact equality with any stored key.
5. Operate on one snapshot and, when safe, one exact generation per request. Never issue a wildcard or multi-generation delete.
6. Use conditional or transactional writes so a newer replacement, moderation transition, or projection change wins over a stale reconciliation attempt.
7. Detach a stale or invalid projection before deleting an object. If detachment fails, do not delete.
8. Treat a missing object as idempotent cleanup success only after the trusted binding and lifecycle state are established.
9. Do not read, head, copy, list, or delete `private/equipment/`, `private/targets/`, `PrivateImageAsset.storageKey`, or any private original.
10. Do not automatically delete a hidden generation, a generation with possible report evidence, an unknown/legacy moderation state, or an ambiguous duplicate. Return a bounded `manual_review` outcome.
11. Reconciliation can make an image non-deliverable or finish deletion. It must never restore, republish, unhide, or attach an image.
12. Do not expose internal identifiers or existence-sensitive differences in public UI, API responses, logs, metrics, or notifications.

## Recovery cases and required outcomes

| Case | Trusted checks | Safe Phase 2H outcome |
| --- | --- | --- |
| Snapshot is detached but a `removed` ledger row retains its canonical key | One exact row for the snapshot; `equipment_cover`; key matches canonical path; no current projection | Head/delete the exact object, treat missing as success, conditionally clear the ledger key/alt-text copy, and record a bounded completed outcome. |
| Owner or moderator action returned `cleanup_pending` | Same checks as above, plus current removed state and expected moderation state | Retry idempotently. Never reattach the projection or repeat a delete against a different generation. |
| Hidden derivative remains after snapshot unpublish | One `ready + hidden` generation; snapshot absent or detached | Keep delivery unavailable and retain the derivative by default. Return `retained_moderation_hold`; only a future explicit admin retention/removal policy may purge it. |
| Snapshot fields point to a missing derivative | Projection and ledger agree on one current generation; exact `HeadObject` returns missing | Conditionally detach the projection, mark the generation non-deliverable/removed under the future lifecycle contract, and preserve the sanitized text snapshot. Do not fall back to a private source. |
| Public object remains after snapshot projection was detached | Exactly one clear, removed, failed, or expired generation can be proved from trusted state | Delete only when the state table below permits it. Hidden/reported/unknown generations are retained for review. |
| `PublicImageAsset` exists but its snapshot was unpublished/deleted | Lookup by known snapshot ID returns exact rows; no snapshot projection exists | Remove an unreported clear current/stale object when the generation is unambiguous. Retain hidden or potentially reported generations; fail closed on multiple live candidates. |
| Snapshot is public but account or Equipment Passport is private/ineligible | Re-read the authoritative profile/source records through attribute-limited access | Detach delivery immediately. Queue exact cleanup for eligible clear generations; retain hidden/reported generations for policy review. Returning the account/source to public never republishes automatically. |
| Private original was deleted or replaced | Trusted source event supplies the affected private source record; public binding is re-derived server-side | Detach every exact public generation bound to the source. Delete safe clear/unreported derivatives; preserve report/moderation evidence according to policy. Never touch another private original. |
| Processor wrote S3 but finalization failed | A failed or expired `processing` ledger row deterministically derives the exact key; it is not projected; processing lease is stale | Head/delete only that exact object, then conditionally settle the ledger. A current processing lease is left alone. |
| Processor finalized successfully but client timed out | Snapshot and ledger still agree on `ready + clear`, and the object exists | No cleanup. This is an eligible current derivative, not an orphan. |
| Public object exists with no ledger row | Only an inventory record or manual observation exists | Do not delete in the application action. Classify as `unproven_object` for later protected inventory review; there is no trusted generation binding. |
| Ledger exists but public object is missing | Exact trusted row exists; no object; generation is projected or otherwise active | Detach if projected, settle the generation as non-deliverable, and finish without S3 deletion. |
| Stale remove-first replacement generation remains | Old row belongs to the same snapshot and is not the current projection | Delete only if it is clear/unreported and unambiguous. Retain if hidden, possibly reported, legacy-unknown, or subject to a hold. |
| Interrupted moderation action | Re-read projection plus `status` and `moderationStatus` | `hidden` stays retained; `removed` with a canonical key retries deletion; `removed` without a key is already complete; inconsistent state goes to manual review. |
| Multiple or ambiguous generations | More than one plausible current/cleanup candidate, truncated index result, malformed binding, or conflicting projection | Do not detach or delete. Return `manual_review` and require protected investigation. |
| Legacy row lacks moderation or generation-era fields | State cannot be proven under current rules | Do not infer `clear`. Require controlled backfill/reprocess or manual review before cleanup. |
| Future account deletion | Account lifecycle orchestrator enumerates trusted public snapshots/assets before deleting identity/profile state | Revoke delivery and settle public derivatives before deleting the records needed to prove ownership/binding. Retain minimum report/audit evidence required by policy. Account deletion must not start a bucket scan. |

### State-based deletion decision

- `removed` with a canonical retained key: safe exact retry when the binding is unambiguous.
- `failed` or expired `processing`: safe only when the object key is deterministically derived, the generation is not projected, and no evidence/hold applies.
- `ready + clear` but no longer referenced: safe only after confirming the snapshot is absent/detached or points to a different generation, account/source eligibility does not require a different transition, and no report/hold applies.
- `ready + hidden`: retain. Hidden is a moderation hold, not a cleanup request.
- `removed + moderationStatus = removed`: safe exact retry under the same canonical checks.
- missing/unknown `moderationStatus`: retain for controlled migration or manual review.
- any target-photo-like source, non-`equipment_cover` source, malformed key, foreign binding, or ambiguous set: reject without storage mutation.

`lastReportAt` is a conservative evidence signal, not a complete report index. Its presence is enough to retain a generation in the first release, but its absence is not sufficient for automated deletion once legacy reports are considered. A later protected report-by-generation index or cleanup hold is required before scheduled cleanup can make evidence-aware decisions at scale.

## Architecture options

### Option A: manual protected admin action

Phase 2H.1 implements the read-only half as a group-gated custom AppSync query accepting one known image-generation ID. The Lambda consistently reads that base ledger row and its associated snapshot, derives the canonical key, heads it, re-reads critical state, and returns only a bounded classification. A future explicit write action would be a separate contract that reclassifies from trusted state rather than applying a cached inspection.

Advantages:

- smallest blast radius and easiest behavior to inspect;
- reuses the current snapshot index and exact-key lifecycle rules;
- needs no bucket listing or broad table scan; and
- works for known `cleanup_pending`, unpublished, hidden, and failed-processor cases.

Limitations:

- requires an operator to know the opaque asset-generation ID;
- cannot safely discover ledgerless S3 objects; and
- does not provide durable retries by itself.

### Option B: scheduled or manually invoked protected worker

A backend-only worker consumes durable cleanup tasks and periodically processes a bounded batch. It can retry transient failures and enforce retention windows without user involvement.

Advantages:

- durable retries, metrics, dead-letter handling, and eventual cleanup;
- natural integration point for account-private, private-source, moderation, processor, and account-deletion events; and
- no need for an operator to repeat routine cleanup.

Limitations:

- requires a protected task/audit model or queue, lifecycle indexes, retention policy, and more IAM;
- a scheduler without trusted tasks would encourage scans; and
- automatic deletion is unsafe until report holds and legacy state are resolved.

### Option C: hybrid, recommended

Implement a narrow admin-only manual reconciler first, then add durable protected tasks and a bounded worker. Keep truly unproven or evidence-sensitive cases manual.

This sequence is recommended because it makes known cleanup failures recoverable without granting `ListBucket`, adding a bulk delete path, or inventing policy for hidden/reported generations. The same classification and conditional-transition library can later power a worker, reducing behavior drift.

## Implemented read-only command contract

The Phase 2H.1 backend query is:

```text
inspectPublicImageCleanup(publicImageAssetId)
  -> assessmentStatus + findingCodes + recommendedNextStep + inspectedAt + retryable
```

The contract enforces:

- Cognito user-pool authorization with `admin` group authorization in AppSync and repeated inside the Lambda;
- an exact `img-` plus 40 lowercase hexadecimal generation ID only;
- no key, URL, snapshot/owner/source ID, filename, image data, retention flag, mode, or arbitrary action path;
- no mutation, conditional transition, cleanup invocation, object download, or object delete;
- strongly consistent base reads, exact canonical-key validation, `HeadObject`, and a final critical-state re-read;
- bounded recommendations only: `no_action`, `manual_review`, `retry_inspection`, or `cleanup_candidate_for_future_review`; and
- no echo of identifiers or infrastructure detail in the result.

`cleanup_candidate_for_future_review` is not deletion permission. A later write-capable workflow must use a protected server-created task or independently re-derived exact binding, repeat every state/evidence check, and never treat this point-in-time result as authorization.

## Durable task and data-model plan

No schema change is made in Phase 2H planning. The current `removed` state plus a retained canonical ledger key is sufficient for known manual retries.

Before scheduled cleanup, prefer a new backend/admin-only `PublicImageCleanupTask` instead of placing operational details on the owner-readable `PublicImageAsset`. Candidate fields are:

- opaque task ID;
- protected snapshot and immutable public asset generation bindings;
- allow-listed cause (`owner_remove`, `moderator_remove`, `unpublish`, `replacement`, `account_private`, `source_revoked`, `processor_rollback`, `account_delete`, `reconciliation`);
- status (`pending`, `in_progress`, `retry_wait`, `complete`, `retained_hold`, `manual_review`, `failed`);
- expected lifecycle/moderation revision or condition token;
- bounded attempt count and next-attempt time;
- last-attempt/completed timestamps;
- bounded failure code; and
- retention/hold classification without user content.

Useful indexes would be status plus next-attempt time for the worker and snapshot ID for operator inspection. A protected append-only `PublicImageCleanupAudit` can later record actor class, action, prior/result state, bounded reason/outcome, and timestamp. It must not store keys, URLs, filenames, alt text, private identifiers, report details, or tokens.

Current fields should be interpreted as follows:

- `PublicImageAsset.id` is the generation ID; do not duplicate it merely for naming.
- `publicImageKey` may remain temporarily only on a non-deliverable removed row while exact deletion needs retry, then must be cleared.
- `processingErrorCode` remains a bounded processing/cleanup-facing code; do not overload it with operator notes.
- `lastReportAt` is a conservative retain signal, not a durable moderation hold or cleanup decision.
- `hiddenAt`, `removedAt`, and `moderationStatus` remain moderation/lifecycle evidence and must not be cleared by a generic reconciler.

Adding the protected task/audit models, indexes, or lifecycle fields later will be a schema/backend change requiring sandbox and hosted Amplify redeployment.

## Detection without broad listing or deletion

The recommended discovery order is:

1. Synchronous lifecycle commands create a protected cleanup task when exact S3 deletion/finalization cannot complete.
2. Trusted data-change hooks enqueue tasks for account-private, source revocation, snapshot deletion, and future account deletion.
3. The worker queries only due tasks through a purpose-built index, processes a small bounded page, and checkpoints each result.
4. The admin action handles a known snapshot on demand using `publicImageAssetsBySnapshotId`.
5. A later offline inventory audit may compare S3 Inventory output for the public derivative prefix with protected ledger exports to find objects that have no ledger row.

The first implementation must not call `ListObjectsV2` or perform a DynamoDB table scan. If ledgerless-object discovery becomes necessary, use S3 Inventory delivered to a separate protected operations location, validate every key against the exact canonical grammar, and require manual approval or a trusted generated task before deletion. Never grant the application UI or public resolver access to inventory data.

## Least-privilege IAM plan

### Phase 2H.1 read-only inspector — implemented

- AppSync invocation is limited to Cognito `admin`; the Lambda independently validates the group claim.
- DynamoDB `GetItem` only on `PublicImageAsset` and `PublicPassportSnapshot`, with attribute-limited projections and strongly consistent reads.
- S3 `GetObject` only under `public/passports/{snapshot_id}/cover/*`, used by the handler solely for exact-key `HeadObject` metadata checks.
- No DynamoDB query/scan/write/transaction action; no S3 list/write/copy/delete; no private-prefix, private-record, AppSync data-write, cleanup/moderation invocation, presigning, or Cognito permission.

### Phase 2H.2 controlled removed-generation retry — implemented but disabled

- AppSync invocation limited to Cognito `admin`; Lambda independently validates the group claim.
- Backend-controlled execution is fixed to `false`; the disabled path makes no dependency call.
- Attribute-limited DynamoDB `GetItem` on one `PublicImageAsset` and its named `PublicPassportSnapshot` only; no query or scan.
- Transaction-scoped snapshot `ConditionCheckItem` plus asset `UpdateItem` for the attempt claim, followed only by exact-attempt conditional asset updates.
- S3 `GetBucketVersioning`, exact-key `GetObject` authorization for `HeadObject`, and `DeleteObject` only under `public/passports/*/cover/*.jpg`.
- No `s3:ListBucket`, `PutObject`, copy, ACL, bucket-policy, private-prefix, `PrivateImageAsset`, or Cognito mutation permissions.
- No snapshot content delete, projection mutation, ledger delete, report mutation, or moderation-state change.

### Scheduled worker

- Backend-only invocation from EventBridge/SQS or an equivalent protected trigger; no AppSync/public route is required.
- Read/update only due protected cleanup tasks and exact referenced snapshot/asset records.
- The same exact public-prefix Head/Delete boundary as the manual action.
- Bounded concurrency, batch size, runtime, retry count, and dead-letter destination.
- No bucket listing. If a later inventory-analysis role is introduced, keep it separate from the delete worker and from application roles.

IAM narrows the resource boundary, while application checks narrow the exact object. Because the IAM public-prefix ARN can include many snapshots, the Lambda must require the exact canonical path derived from trusted record IDs before every Head/Delete.

## Idempotency, concurrency, and retry rules

- Derive an idempotency key from operation, snapshot, immutable asset generation, and expected lifecycle revision. Do not accept it from a browser.
- Repeated cleanup after successful deletion returns `already_complete`; S3 missing-object behavior is success after binding validation.
- A current projection, newer `updatedAt`, different asset generation, renewed processing lease, changed moderation state, or changed hold status cancels the stale attempt.
- Detachment and lifecycle-state changes use one DynamoDB transaction. S3 deletion follows only after commit.
- Final ledger key clearing is conditional on the same generation and retained key. Failure leaves a retryable non-deliverable row rather than restoring delivery.
- Worker retries use bounded exponential backoff with jitter. Exhausted tasks enter `manual_review`/dead-letter state rather than looping forever.
- Only one task for the same asset generation may be active; duplicate events converge on the same task/idempotency identity.
- Reconciliation must never delete a newly attached replacement just because it shares a snapshot prefix.

## Interactions with existing workflows

### Owner remove, Unpublish, and replacement

Existing controls continue to detach first and return `cleanup_pending` when exact deletion or finalization fails. A future hook creates a protected cleanup task before an image-bearing snapshot is deleted. Remove-first replacement never waits for an orphan retry to make the old image deliverable; the old generation remains detached while the new generation goes through fresh consent and processing.

### Moderator hide/remove and reports

Hide remains a deliberate retention state. Reconciliation may repair a stale snapshot projection that still points to hidden content, but it does not delete the hidden object. Moderator Remove and owner Remove may create the same kind of exact cleanup task after detachment.

Generation-bound report rows remain intact after image removal. A report status change never triggers cleanup. Until there is a protected report-by-generation lookup and explicit retention policy, `lastReportAt` or an unknown legacy report state forces retention/manual review. The reconciler does not change `Report.status`, report content, or moderation reasons.

### Account visibility and source eligibility

The authoritative private setting is persisted first, so the public resolver fails closed immediately. A backend hook then enumerates trusted snapshots/assets through purpose-built indexes and enqueues cleanup. Making the account or Equipment Passport public again does not restore a derivative; the owner must repeat consent and processing.

### Private original deletion/replacement

The private operation must emit a trusted source-revocation event before discarding the binding needed to find public generations. Public derivative cleanup never reads or deletes the private original. A missing private source is not a reason to derive a private path from public data.

### Account deletion/export

Account deletion must revoke and enqueue public derivatives before deleting UserProfile, snapshots, or ledger bindings. It may wait for bounded cleanup completion or retain protected tasks/audit under the documented legal/moderation policy. Export may describe public-image lifecycle state in safe metadata, but must not include signed URLs, public/private keys, operator notes, or another user's report data.

## Observability and operator safety

Use fixed event names and bounded fields only:

- operation (`inspect`, `detach`, `head`, `delete`, `finalize`);
- outcome/failure code;
- duration bucket;
- retry count bucket; and
- aggregate task counts by safe status.

Do not log or use as metric dimensions snapshot IDs, asset IDs, owner/source IDs, keys, URLs, filenames, alt text, report text/reasons, usernames, profile data, tokens, or object metadata. CloudWatch alarms should cover growing pending/manual-review/dead-letter counts, repeated storage-delete failures, and worker invocation failures without exposing record identity.

The future operator UI should show only a shortened public snapshot reference already permitted in moderation, bounded state, last-attempt time, and safe action copy. It must not render the derivative, ledger, key, URL, source/private record, owner identity, or report contents. Destructive apply requires explicit confirmation and a fresh server recheck.

## Recommended implementation phases

### Phase 2H.1: protected read-only inspection — implemented

- Add admin-only inspection for one persistent public image asset generation ID.
- Reuse a pure classifier/canonical-key validator that can later inform a separately authorized worker.
- Inspect exact metadata and return bounded findings without changing data or storage.
- Retain hidden, possibly reported, legacy, ledgerless, missing-snapshot, replacement-mismatch, and ambiguous cases for manual policy review.
- Add adversarial mocked fixtures; no user-facing product control.

The original plan's `apply` behavior, projection repair, removed-object deletion, and failed-processing rollback are not part of Phase 2H.1. They require a separately reviewed write-capable phase.

### Phase 2H.2: controlled removed-generation retry — implemented, execution disabled

- Add the separate admin-only mutation for one known immutable generation.
- Re-derive current state; do not consume Phase 2H.1 findings as authorization.
- Claim one removed/detached generation conditionally and revalidate immediately before an ETag-bound exact-key delete.
- Refuse versioned/suspended buckets, hidden/legacy/active/replacement states, and every ambiguous binding.
- Keep the backend execution gate disabled until a separate live-test review and approval.

### Phase 2H.3: hosted deployment assurance and controlled-test preparation — complete

- Match the hosted Amplify job to the exact repository, `main` branch, and Phase 2H.2 source commit.
- Inspect the deployed gate, relevant resolver/data source, actual execution roles, tables, and bucket using read-only operations.
- Record configuration evidence separately from pending authenticated/live outcomes.
- Test exact-value gate parsing locally and document an approval-gated, sandbox-only fixture procedure without invoking cleanup.

### Phase 2H.4: durable cleanup tasks and worker

- Add protected cleanup task/audit storage, due-task index, lifecycle hooks, bounded scheduled/SQS worker, retries, metrics, and dead-letter handling.
- Enqueue from owner/moderator cleanup, processor rollback failure, Unpublish, replacement, account-private, source revocation, and future account deletion.
- Keep the worker list-free and exact-key only.

### Phase 2H.5: evidence and legacy policy

- Add a protected report-by-generation lookup or durable hold.
- Define hidden/report evidence retention, expiration, appeal, and legal requirements.
- Backfill legacy moderation state under controlled tooling; do not infer `clear` from absence.
- Add a protected exact-generation moderator review/removal path before allowing automated cleanup of reported generations.

### Phase 2H.6: inventory audit for ledgerless objects

- Use protected S3 Inventory and an offline comparison, not live application listing.
- Create review tasks for canonical unmatched objects.
- Require a trusted binding or explicit operator approval before exact deletion.

### Phase 2H.7: release validation

- Run owner, moderator, admin, signed-out, API-key, concurrent replacement, account-private, source-revoked, missing-object, ambiguous-generation, legacy-row, retry, and dead-letter tests.
- Verify no cleanup path reads/deletes private prefixes or makes a hidden/reported image public.
- Verify current replacement wins over stale reconciliation and all issued delivery URLs expire within the existing 60-second bound.
- Keep Discover/public-profile rendering deferred until lifecycle recovery and moderation gates pass.

## QA checklist

- [x] Mocked tests reject a normal signed-in user, moderator, signed-out visitor, and API-key-shaped caller before any dependency read.
- [x] Mocked tests confirm inspection accepts only one exact asset-generation ID and returns no key, URL, asset/owner/source ID, filename, alt text, or raw error.
- [x] Mocked Phase 2H.2 tests confirm the disabled gate and missing confirmation perform zero reads/writes/deletes; non-admin identities are rejected before dependencies run.
- [x] Mocked Phase 2H.2 tests cover removed/detached cleanup, already-missing convergence, hidden/current/replacement/legacy/target rejection, active lifecycle states, S3 403/404, ETag precondition failure, state races, repeated calls, ambiguous deletion, failed result persistence, stale-attempt protection, versioning refusal, and the no-private/list/copy/download dependency boundary.
- [x] Phase 2H.3 matched the hosted Amplify deployment to commit `5ed4a6863e8cfbd0db19f09a647ae2df394ad861`, confirmed successful deployment, observed the hosted cleanup gate as exactly `false`, confirmed compatible unversioned storage, and inspected deployed authorization/IAM without invoking cleanup.
- [x] The reconciliation suite tests missing and malformed gate values and enables execution only for the exact backend value `true`.
- [ ] Complete the pending authenticated/live outcomes listed in the [deployment assurance report](PUBLIC_IMAGE_PHASE_2H_DEPLOYMENT_ASSURANCE.md) under separate approval and the [controlled test runbook](PHASE_2H_CONTROLLED_CLEANUP_TEST_RUNBOOK.md).
- [ ] Hosted integration must confirm AppSync and Lambda both enforce Admin-only access and the deployed role has only the documented read/head permissions.
- [ ] A separate approval must enable the Phase 2H.2 execution gate before any live cleanup test; this implementation/deployment must not invoke the mutation.
- [ ] Known owner/moderator `cleanup_pending` fixtures converge to completed cleanup; already-missing objects are idempotent success.
- [ ] A current ready derivative is never classified as an orphan after a client timeout.
- [ ] An expired processor rollback object can be removed only when it is unprojected and exact; a current lease is untouched.
- [ ] Hidden, reported, legacy-unknown, duplicate, malformed, ledgerless, and ambiguous cases remain retained/manual-review.
- [ ] Snapshot projection to a missing/removed/hidden asset is detached conditionally and public detail becomes safely text-only.
- [ ] Private account/source revocation prevents new delivery before cleanup and never republishes after visibility is restored.
- [ ] A concurrent replacement or moderation transition makes stale reconciliation fail closed without deleting the new generation.
- [ ] Worker retries are bounded, duplicate tasks are idempotent, and dead-letter/manual-review paths do not loop.
- [ ] IAM has no private-prefix, public write, bucket-list, broad scan, Cognito mutation, or browser/API-key cleanup access.
- [ ] Logs, metrics, task UI, and mutation responses contain no sensitive or internal identity/storage values.

## Explicitly out of scope

Phase 2H.2 does not add general orphan reconciliation, projection repair, cleanup of failed/expired processing rows, hidden-image cleanup, cleanup schedules, queues, task/audit models, indexes, UI, bucket listing, version-history deletion, or broader rendering. It does not add Discover/public-profile images, target-photo publishing, public galleries, feeds/follows, marketplace behavior, destructive account deletion, or any calculator, scope output, hold recommendation, field correction, sight-in instruction, or aiming guidance. Phase 2H.1 remains read-only and its recommendation is never deletion authorization.
