# Data Export Implementation Plan

Updated: 2026-09-05. Status: implementation proposal only; export remains disabled.

## Scope and baseline

This refines [Data Export Plan](DATA_EXPORT_PLAN.md) and [Account Data Lifecycle Plan](ACCOUNT_DATA_LIFECYCLE_PLAN.md). Coordinate with [Account Deletion Implementation Plan](ACCOUNT_DELETION_IMPLEMENTATION_PLAN.md), especially identity mapping, job fencing, retention, and deletion precedence. This task adds documentation only; proposed endpoints, stores, indexes, IAM, UI, and workers do not exist yet. No schema or public image runtime changes are included.

The inventory comes from `amplify/data/resource.ts`, `amplify/storage/resource.ts`, `amplify/auth/resource.ts`, `amplify/backend.ts`, and the username/image helpers. Current explicit indexes cover user profiles by owner and image assets by public snapshot, not an entire account export. Current moderator access covers reports, not private owner records. Public visibility is not export authority.

## Export contract and formats

Ship versioned UTF-8 JSON first, clearly labeled **Records and image inventory (image files not included)**. Add an opt-in ZIP containing the same JSON plus image bytes in a separate phase. Do not present inventory-only JSON as a complete image backup. A user preparing for deletion should see exactly which format is available before confirming deletion.

JSON envelope version `1.0` should define:

- `formatVersion`, opaque `exportId`, `requestedAt`, `captureStartedAt`, `captureCompletedAt`, `generatedAt`, and `consistencyMode`.
- `scope`: selected format, image-byte inclusion, collection names, and policy version.
- `account`: allowlisted account/profile fields; omit internal ownership claims. Include user-facing verified contact attributes from Cognito when applicable, but no authentication secrets, devices, recovery material, or group membership.
- `collections`: explicit arrays for the models below, including empty arrays. Preserve user record IDs and relationships within the export; replace references to unavailable/other-user targets with opaque export-local references and a bounded context status.
- `counts`: captured and exported totals per collection; `files`: image inventory with export-local ID, source record reference, content type, size when verified, availability, optional archive-relative path, and SHA-256 for included bytes.
- `limitations`: known omissions, redactions, missing source files, and capture-window semantics using bounded codes. Unknown read failures are not valid omissions.

Use ISO 8601 UTC timestamps, preserve date-only session dates, preserve numeric/boolean values and units, and document omitted versus null fields. Validate against a versioned export JSON schema maintained with future exporter tests. Do not serialize generated model objects wholesale. Preserve the user's private notes and structured checklist/statistics JSON through a reviewed projection, with bounded size and explicit handling of nested values; never silently truncate them.

ZIP layout: `manifest.json`, `data.json`, `README.txt`, `images/private/<exportImageId>.<ext>`, and optionally `images/public/<exportImageId>.jpg`. Names are generated from safe export-local IDs, never user filenames or raw storage paths. Manifest lists relative paths, byte lengths, checksums, counts, format version, and limitations. Keep all paths relative and traversal-safe. Stream/chunk large archives rather than buffering the entire account in Lambda memory. Define and load-test size/time quotas before launch; exceeding them yields an actionable failure or a documented multipart archive, never missing data marked complete.

## Collection and disclosure matrix

| Source | Include | Exclude / handling |
| --- | --- | --- |
| `UserProfile` | Display/app username, names, location, bio, privacy preferences, timestamps, and other user-entered account fields | Internal owner aliases and infrastructure URLs; private location belongs only in the private export. External avatar URL is not authority to fetch remote data. |
| `EquipmentPassport`, `ProjectileProfile`, `OpticSightProfile` | All user-facing owned data, including private/public notes, lot information, counts, accessories, and linked owned IDs | Replace image storage keys/URLs with export-local image references. |
| `RangeSession`, `TargetPhoto` | Session details, record links, notes, target captions, scores, and photo metadata | Do not fetch unrelated referenced records without independent ownership verification. |
| `MaintenanceLogEntry`, `HuntingChecklist` | All owned maintenance/readiness fields, notes, and structured checklist items | No omission merely because a parent record is missing; mark broken links. |
| `PrivateImageAsset` | Safe source linkage, binding state, verified media metadata, and availability inventory for every owned state | Omit storage identity, owner claims, raw keys, original/sanitized filenames, and internal failure diagnostics. Browser candidates are not proof of object ownership. |
| Private S3 objects | JSON inventory; optional ZIP original bytes after trusted identity/prefix validation, including owned unregistered uploads | No signed URLs. Unknown ownership blocks inclusion. Do not fetch arbitrary `imageUrl`, `coverPhotoUrl`, or `avatarUrl` addresses. |
| `PublicPassportSnapshot` | Owned published snapshot text, public statistics, embedded range-session summaries, placeholders, and safe image references | Raw delivery URL/key and other users' snapshots excluded. No separate public session snapshot model exists today. |
| `PublicUserProfileSnapshot` | Owned username, display name, bio, visibility, timestamps | No other profiles or owner authorization identifiers. |
| `PublicImageAsset` and derivatives | Owned publication status, consent timestamp, safe source/snapshot linkage, and optional existing derivative bytes | Include historical/failed/removed states as metadata where present; do not republish or reprocess. Internal keys/errors excluded. Missing derivatives get explicit availability. |
| `Comment` | Authored body, status, dates, safe target reference, including hidden/reported comments | No other users' comments or full conversations merely because the target is owned. |
| `Reaction` | Authored reaction type, dates, and safe target reference | No received reactions or identities of reacting users. |
| `Report` | Requester's submitted reason/details, submission date, target type/reference, and user-safe workflow status after field-level safety projection | Exclude reports against the user submitted by others, moderator identities/notes, enforcement signals, and unrelated private data. Redact third-party sensitive details even inside submitted text; route uncertain cases to restricted review. |
| `UsernameReservation` | Current and proven owned reserved usernames where applicable | No owner ID, other accounts' reservations, abuse holds, or tombstone registry. Deleted-account tombstones do not grant export entitlement. |
| Lifecycle/moderation audit | User-safe request history/receipt only if supported | No operational job payloads, IAM details, moderator-only audit attribution, evidence vault, or raw infrastructure logs. Current `Report` has no separate review-history model. |

Private originals in an owner-only ZIP should retain original bytes and metadata by default for portability, with a clear notice that originals can contain EXIF/location data. This is separate from public publishing, which uses sanitized derivatives. A future optional stripped copy must be labeled as transformed with its own checksum; never silently alter the original. Do not invoke the public image processor or change consent/ledger state to create an export.

## Backend architecture and identity

Propose authenticated `requestDataExport`, `getDataExportStatus`, and `authorizeDataExportDownload` commands backed by request/status Lambdas, a Step Functions Standard workflow, paginated Lambda workers, an encrypted backend-only job store, and a dedicated private export S3 bucket. These are future resources. Separate the read-only source-data worker role from artifact writes and cleanup; it needs no source-data delete/update permission, publishing permission, or Cognito administration. A narrow coordinator may update lifecycle state for capture locking; moderation projection has separate restricted access.

Require recent interactive re-authentication for requesting an export and authorizing a download, using the deletion plan's proposed five-minute freshness checks. Resolve stable Cognito subject and proven owner aliases from validated server identity, never an input owner ID or app username. Persist only the protected identity mapping needed for the job. Resolve storage identity-pool prefixes independently of the user-pool subject. Validate candidate `PrivateImageAsset` bindings and owning source relationships; also inventory independently proven owner prefixes for unregistered objects. Flag ambiguous historical identity mapping as incomplete and require reconciliation rather than omit it silently.

Accept only bounded format/options and an idempotency key. Status/download operations must authenticate the same subject and recheck lifecycle state; possession of a job ID or a moderator role grants no access. Rate-limit per account and globally, and permit one active export per account by default. No public API-key endpoint, client-generated scan, or user-supplied bucket/key selectors.

Job state: `requested -> capturing -> packaging -> validating -> ready -> expired`; alternatives `failed`, `cancelled`, and `needsReview`. Persist opaque job ID, protected subject reference, scope hash, policy/format version, lease/fencing generation, per-collection cursor/count, artifact checksum/size, expiry, and bounded failure code. Keep exact keys and captured data in short-lived encrypted staging, not state-machine payloads or logs. Suggested ready-artifact retention is 24 hours, presigned download lifetime at most 60 seconds, and minimal job receipt retention 30 days; confirm these product defaults before enabling the feature.

## Capture consistency and pagination

Do not promise a point-in-time export based on `updatedAt <= requestedAt`, count equality, or consistent scans: concurrent edits/deletes can invalidate those claims. DynamoDB explicitly provides no snapshot isolation for a scan, even with consistent reads. See [DynamoDB Scan](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html).

Recommend `consistencyMode: frozenCapture` for the first release. Acquire an account lifecycle capture lease, gate all owner writes/uploads and relevant backend writers, drain in-flight work, then capture records and image versions/bytes into private staging. Capture only requester-authored social data; coordinate moderation mutations for those rows or explicitly record their separate observation times. Release the capture lease after staging is immutable; packaging can continue without locking the account. Enforce a bounded capture timeout that fails/restarts safely rather than freezing the user indefinitely. Explain the temporary editing pause in the UI.

The current schema, direct model access, and identity-pool S3 writes do not provide that freeze. A future server-enforced barrier covering all writers and outstanding storage credentials is a prerequisite. If that cannot be delivered, the fallback must be explicitly approved and labeled `captureWindow`, with start/end times and limitations; never label it a snapshot or a complete point-in-time backup. Source ETags/versions plus repeat reads help detect change but do not create snapshot isolation. Deletion retains its own stricter fencing and final-sweep requirement.

Inventory all models independently by their owner/author/reporter selectors, not only through a profile's relationships. Discover with existing indexes where available; future owner/author/reporter indexes need backfill and parity checks. Paginate until no continuation key, including pages with zero filtered matches. GSIs are discovery aids; validate source ownership with base-table reads and reconcile against a bounded base-table inventory for completeness after freeze. Any temporary scan fallback must be backend-only, rate-limited, and scoped by an explicit model/field allowlist.

For each collection retain captured row IDs/counts in private staging, then compare the projected output to that same capture, accounting explicitly for exclusions/redactions. Deduplicate alias matches by model and record ID. For images, list every proven prefix page, pin version IDs when available, and copy validated bytes while the capture barrier holds; do not overwrite source metadata or bind unverified assets as a side effect. Independently validate links to prevent cross-account data leakage.

## Execution, retries, download, and expiry

1. Authenticate, check fresh confirmation and account state, and conditionally create/reuse the job by `(subject, idempotencyKey, scopeHash)`. Same key with different options is a conflict. Acquire a mutually exclusive lifecycle capture lease.
2. Capture each collection and media inventory into deterministic private staging chunks; checkpoint only after durable writes. Persist only opaque chunk pointers in orchestration history. Restart an invalid capture generation rather than mixing old and new data.
3. Apply explicit allowlists and report safety projection, validate relationships, and construct JSON or stream ZIP from the captured chunks. A report requiring review enters `needsReview`; do not publish an unsafe or silently incomplete archive.
4. Validate schema, per-collection counts/IDs, media availability, archive paths, lengths/checksums, and forbidden-field/URL checks. Known absent files are represented as `missingAtCapture`; transient S3/DB errors must retry or fail the job. In inventory-only JSON, use `notIncludedInFormat`, not a false missing-file result.
5. Conditionally publish a ready artifact pointer only if the lifecycle/export generation remains valid. Notify in-app/verified channel without attaching the artifact or embedding a download URL.
6. Authorize a short-lived download after fresh authentication, owner match, unexpired artifact, and account-state checks. Use attachment disposition and no-store responses. A presigned URL is a reusable bearer capability until expiry, not single-use authorization; if single-use or immediate revocation is required, use an authenticated streaming gateway. Do not put URLs into analytics, logs, public snapshots, local persistent storage, or emails.
7. On expiry, revoke download authorization immediately, delete all artifact/staging versions and multipart uploads, and verify cleanup. Use scheduled cleanup plus S3 lifecycle as defense in depth; delayed physical expiration must not extend authorization. Retry cleanup failures and alert on overdue artifacts.

Use leases, fencing generations, idempotent chunk names, conditional ready transitions, and bounded exponential backoff/jitter for transient failures. Check individual batch failures and unprocessed records. Reconcile abandoned executions and incomplete uploads on a schedule; expose only safe status codes. Never allow a stale worker to overwrite a newer artifact or republish one after cancellation.

Deletion wins when requested: atomically fence the export, cancel queued/active jobs, revoke download issuance, remove ready/staging objects, and include them in deletion verification. A request racing the final ready transition must fail its lifecycle-generation condition. Previously issued URLs can remain valid until object removal or their short expiry; disclose this bounded window. Starting an export never delays deletion indefinitely, and deleting an account never produces a surprise archive. Cancellation of deletion does not revive an old export automatically.

## Privacy, audit, and retention

Encrypt source captures/artifacts at rest and in transit, block public access, separate export storage from public derivatives, and apply least-privilege IAM and protected key access. No credential/token material, raw authorization claims, infrastructure endpoints/keys, signed URLs, other users' private records, or moderator-only evidence in artifacts. Do not treat a user's group membership as permission for a bulk moderation export. Report redaction decisions should be recorded using policy codes without copying the narrative into operational logs.

Audit request, capture, validation, ready, download authorization, cancellation, failure, and physical purge using opaque job ID, actor class, timestamp, policy version, counts/bytes, and bounded outcome. Download authorization is not proof the user downloaded the file. Restrict execution history, metrics dimensions, and debug logs so data/identities/keys are not duplicated there. Apply the same 24-hour maximum to abandoned staging, with shorter cleanup on failure/cancellation; retain only minimized 30-day receipts unless a specifically scoped exception applies. Backup/replication inventory must include export storage and restore suppression so expired artifacts cannot return to service.

Moderator/report retention remains governed by the deletion plan: an export does not grant access to restricted cases, alter retention, or bypass a hold. An access request that needs additional privacy review should have a separate authenticated review path; this self-service format is a defined product scope, not a claim that every possible disclosure obligation is satisfied.

## Delivery sequence and acceptance gates

1. Approve projection schema, report disclosure rules, freshness checks, retention/quota defaults, image policy, and consistency mode.
2. Implement/test shared ownership inventory, future indexes, job store, capture barrier, and least-privilege read workers as separately reviewed runtime work.
3. Ship JSON capture/projection/validation and secure artifact expiry behind a feature flag; then authenticated Settings request/status/download UX with explicit image limitations.
4. Add ZIP media streaming and large-account behavior separately, reading existing originals/derivatives without changing public-image processing or consent.
5. Exercise deletion/export concurrency and retention cleanup before enabling deletion.

Acceptance tests must cover empty and large accounts, every model/asset state, multi-page and empty filtered pages, duplicate aliases, stale/missing relationships, orphan uploads, historical storage identities, forged keys/owners, other-user public and private data, report redactions, missing versus transiently unreadable images, unsafe filenames, ZIP checksums, schema compatibility, failed/replayed chunks, worker timeout, source edits during capture, failed freeze, expired authentication, cross-account job guessing, download expiry, multipart cleanup, deletion at every job state, and stale-worker artifact recreation. Verify logs and artifact contents for forbidden fields. Test TTL/lifecycle delays and backup restore without re-exposing exports.

For this documentation-only change run `npm run amplify:typecheck`, `npm run lint`, `npm run build`, and `git diff --check`. Future runtime release additionally requires integration/failure-injection evidence, storage permission checks, projection fixtures, and an operations runbook; repository build checks alone cannot prove export privacy or completeness.
