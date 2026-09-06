# Phase 2G Public Image Moderation and Reporting Plan

Last updated: September 5, 2026

## Purpose

Phase 2G adds a safe reporting and moderation lifecycle for the one processed Equipment Passport cover that may render on saved Public Passport detail. It must exist and pass hosted adversarial testing before image rendering is considered for Discover cards or public profile pages.

Phase 2G.1 provides schema and delivery-contract guardrails. Phase 2G.2 adds the first detail-only **Report image** UI using the existing reporter-owned `Report` create path and the safe public snapshot id. Because no trusted binding command exists and the delivery resolver intentionally withholds ledger ids, these first reports are generation-unbound and must remain non-actionable. No dedicated image review UI, moderator action, notification, audit log, or broader image rendering exists.

## Current boundary

Today:

- `PublicPassportImage` receives only a public snapshot id and renders only on saved Public Passport detail.
- `resolvePublicPassportImage` returns a 60-second, non-cacheable URL only when the public snapshot, public profile visibility, source passport, `ready` public-image ledger row, non-blocked moderation state, canonical derivative key, safe alt text, and S3 object all agree.
- `PublicImageAsset` is owner-readable and client-nonwritable. Phase 2G.1 adds an independent owner-readable `clear | hidden | removed` moderation state plus bounded lifecycle timestamps/reason metadata, but does not broaden moderator access to the full ledger.
- Signed-in users can report public snapshots and comments through the existing `Report` model. When an eligible derivative finishes loading on saved Public Passport detail, Phase 2G.2 also offers **Report image** and stores `targetType = public_image` with the safe public snapshot id. `Report.publicImageAssetId` remains unset because the browser cannot safely bind it.
- Admins and moderators can read report metadata and update only `Report.status`. That status change does not hide, delete, or mutate content.
- Owner removal, derivative-aware Unpublish, and remove-first replacement use backend-controlled detachment and preserve the private original.
- Discover cards, public profile cards, and target photos remain image-free.

## Non-negotiable safety invariants

1. A browser reports an image by public snapshot id. It never supplies a private/public S3 key, URL, owner id, source record id, private image asset id, destination path, filename, or image bytes.
2. The report backend binds the report to the exact public image generation current at submission time. A later replacement must not redirect an old report or moderator action to the new image.
3. Moderator UI receives a deliberately limited projection. It never reads `PrivateImageAsset`, the private Equipment Passport, or the full `PublicImageAsset` ledger model directly.
4. Hide/remove revokes new delivery before or atomically with any asynchronous object cleanup. The public snapshot text/setup remains published unless a separate content workflow changes it.
5. The owner-private original is never deleted, copied into moderation storage, exposed, or made readable to a moderator by an image action.
6. `range_session_target`, WebP candidates, demo/sample data, stale candidates, and all non-`equipment_cover` sources remain ineligible.
7. Report status and image availability are separate state machines. `reviewed`, `dismissed`, or `action_needed` never implicitly hides, restores, or removes an image.
8. A stale report cannot hide or remove a replacement generation. The backend returns a bounded `superseded`/`state_changed` result instead.
9. Public and moderation failures are bounded and fail closed. Logs contain fixed event names and reason codes, not ids, keys, URLs, filenames, alt text, report details, profile data, or tokens.
10. There is no fallback to a private image under any failure, missing-object, hidden, removed, private-account, or unpublished state.

## Recommended report contract

### Public input

Add a dedicated authenticated backend command rather than letting the browser construct a `public_image` Report row directly:

```text
reportPublicPassportImage(
  publicPassportSnapshotId,
  reason,
  optional bounded details
)
```

The command should derive reporter identity from Cognito and accept no reporter id, public image asset id, source id, owner id, key, URL, filename, or image bytes. Keep the existing reporter-owned model create path for existing non-image reports until it is intentionally migrated.

Phase 2G.2 does not implement this command. Its constrained interim UI submits only the existing model fields: current Cognito reporter id, `targetType = public_image`, public snapshot id, allow-listed reason, normalized optional details, `status = open`, and creation time. It never obtains or submits an image asset id, key, path, URL, owner/source id, filename, target-photo data, or image bytes. This preserves privacy but does not establish immutable generation binding.

Server validation should:

1. normalize and validate the persistent public snapshot id;
2. verify the snapshot is public and currently projects one eligible image;
3. resolve the exact `PublicImageAsset` through trusted backend records;
4. require `sourceType = equipment_cover`, lifecycle `status = ready`, moderation availability, canonical derivative path, and matching snapshot/asset fields;
5. derive the authenticated reporter owner key and prevent caller-supplied identity;
6. normalize a server allow-listed reason and bounded details; and
7. create an idempotent report bound to both the safe public snapshot id and exact immutable image generation.

Return only a bounded result such as `submitted`, `already_reported`, `unavailable`, or `failed`, plus the reporter-owned report id only if the client needs it. Missing, hidden, removed, foreign, and malformed targets should share an unavailable response where practical so the action is not an existence oracle.

### Report target identity

Recommended representation:

- `Report.targetType = public_image`;
- `Report.targetId = publicPassportSnapshotId`, because it is already a public route identifier; and
- a new backend-written `Report.publicImageAssetId` (name subject to schema review) binds the report to the immutable processed generation.

The generation field is unreadable to public/API-key clients and other users. The report owner has minimum read/delete authorization so existing generated model responses remain compatible, but the product UI should not render it. Moderation UI should normally use it only as an internal backend comparison. A custom moderator projection is safer than broad `PublicImageAsset` group read.

Using only the snapshot id is insufficient: an owner can legitimately replace an image before review, and an old report must continue to identify the old generation without authorizing action against the replacement.

### Report reasons and details

Use a bounded reason allow-list aligned with the moderation policy:

- threat or harm;
- illegal hunting;
- unsafe or prohibited weapon content;
- personal information, serial number, or exact-location exposure;
- harassment or hate;
- sales or marketplace activity; and
- other.

Normalize details with NFKC, remove control characters, collapse whitespace, and enforce a conservative length such as 500 characters. Do not allow details to carry S3/storage paths, data/blob URLs, tokens, or executable markup. Details are untrusted user content in every moderator surface.

### Signed-out behavior

Signed-out visitors may view an eligible public derivative but cannot submit a report. The image action should show a clear sign-in prompt that returns to the same public detail route. It must not leak whether another report already exists.

## Abuse and spam controls

- Permit at most one active report per reporter and immutable public image generation. A deterministic server id or protected uniqueness record is preferable to a client-side duplicate check.
- Treat the same reporter retry as idempotent. A new replacement generation may be reported separately.
- Enforce server-side per-account rate limits and AppSync/WAF request throttles; client button disabling is only a UX safeguard.
- Do not auto-hide based solely on report count. That would permit brigading to remove lawful content.
- Use report volume/severity only for protected queue priority. Do not display public report counts or reporter identities.
- Reject reporting of absent, hidden, removed, superseded, private-account, unpublished, demo/sample, or target-photo content with the same bounded unavailable result.
- The owner should use **Remove public image** for an accidental self-publication. If self-reports are accepted for accessibility, process them through the same backend binding and do not grant additional permissions.

## Moderator/admin review projection

Create a group-authorized query such as `getPublicImageModerationCase(reportId)` or a purpose-built queue projection. Do not add `admin`/`moderator` read authorization to the full `PublicImageAsset` model.

The safe review result may contain:

- report id and workflow status;
- `targetType = public_image`;
- public snapshot title and public snapshot route id;
- current report/image relation: `current`, `superseded`, `hidden`, `removed`, `cleanup_pending`, or `unavailable`;
- a short-lived no-store preview URL for the exact reported processed derivative when policy and object state permit;
- safe public alt text;
- bounded report reason/details;
- friendly reporter identity using the existing `@username`, safe display-name, or short internal-id fallback;
- full internal reporter id only in the existing muted technical detail line;
- report creation/update date; and
- current moderation action availability.

It must not contain:

- private/public storage keys or paths;
- `PrivateImageAsset` data or private candidate id;
- the private original or a private signed URL;
- private target photos;
- owner id or private source record id in visible UI;
- original/sanitized filenames;
- email, first/last name, city/state, private profile fields, private notes, purchase data, or other private passport data; or
- EXIF/GPS metadata or raw infrastructure errors.

The review resolver should accept only `reportId`. It should resolve the protected image-generation binding internally. If that generation is gone, superseded, or no longer eligible, show a bounded unavailable/superseded state and never preview the current replacement as though it were the reported image.

## Moderator image actions

Use a separate custom action from owner cleanup, for example:

```text
moderatePublicPassportImage(
  reportId,
  action: hide | remove,
  reasonCode,
  optional bounded note,
  idempotencyKey
)
```

The action must be authorized directly to Cognito `admin`/`moderator` groups. Do not broaden `removePublicPassportImage`, impersonate the owner, or let normal users update moderation fields.

The client must not send snapshot id, asset id, owner id, source id, key, path, URL, or image bytes. The backend resolves the report, immutable generation, current snapshot projection, and canonical derivative path.

### Hide

1. Re-read the report binding, snapshot, and public asset.
2. Confirm the reported generation is still current. If not, return `superseded` and do not touch the newer image.
3. Conditionally set a moderation hold and detach `publicImageAssetId`, `publicImageKey`, and `publicImageAltText` from the public snapshot.
4. Mark the reported asset `hidden` in its separate moderation state.
5. Delete the delivery object immediately, or move only the processed derivative to a future moderator-only quarantine if an approved evidence-retention policy requires it.
6. Return a bounded `hidden`, `cleanup_pending`, `superseded`, or `failed` result.

Hiding should not be treated as an automatically reversible UI toggle. Without an approved quarantine/appeal policy, owner re-consent and fresh processing after an audited moderator clearance are safer than restoring the old object.

### Remove

Use the same detach-first checks, then permanently delete the processed public derivative and mark the asset moderation state `removed`. Preserve only the minimum protected ledger/audit metadata needed for traceability. Never delete the private original or private source record.

### Existing 60-second URLs

Detaching the projection stops new resolver URLs immediately. An already-issued S3 URL can otherwise remain valid for its remaining lifetime, currently at most 60 seconds. Hide/remove should therefore attempt exact-object deletion immediately after detachment. If deletion fails, return `cleanup_pending`; no new URL is issued, but operator copy must not claim the object is deleted until cleanup succeeds. A future proxy or CloudFront design could provide stronger revocation if policy requires it.

## Report status interaction

Keep the current workflow states:

- `open`: not yet reviewed;
- `reviewed`: review completed;
- `dismissed`: no image action required; and
- `action_needed`: further human or cleanup work remains.

Rules:

- Creating a report starts it as `open`.
- Changing status never changes image availability.
- Dismissing a report never restores a hidden/removed image.
- Hiding/removing an image does not silently choose a report status. After a successful action, the UI may prompt the moderator to explicitly mark the report `reviewed`.
- A `cleanup_pending` result should encourage `action_needed`, but that remains an explicit workflow update until a future audited orchestration is designed.
- Multiple reports bound to the same generation remain separate report records. A successful image action should make every related queue item display the current hidden/removed outcome without automatically rewriting each report's review status.

## Public delivery state table

| Image/snapshot state | Resolver result | Public detail behavior | Moderator behavior |
| --- | --- | --- | --- |
| Lifecycle `ready`, moderation `clear`, exact current projection | Available | Render processed derivative | Preview/action available |
| Reported/open, no moderator action | Available | Continue rendering; reports alone do not auto-hide | Queue as pending |
| Hidden | Unavailable | Text/setup remains, no image | Show hidden state; no private fallback |
| Removed | Unavailable | Text/setup remains, no image | Show removed state |
| Cleanup pending after detachment | Unavailable | Text/setup remains, no image | Show bounded cleanup-pending state/retry |
| Asset/projection mismatch | Unavailable | Text-only, no technical error | Show bounded mismatch/action unavailable |
| Reported generation superseded by replacement | Current image follows its own eligibility; old report never targets it | Do not substitute the replacement in the old report preview | Show superseded; do not action new image |
| Snapshot unpublished/missing | Unavailable | Public detail unavailable | Preserve report/audit per policy |
| Account private or source passport not public | Unavailable | No image | No action that republishes content |
| Derivative object missing | Unavailable | Text-only | Mark/reconcile bounded missing state |

Every unavailable public response remains generic and non-cacheable and contains no key, internal id, owner/source identity, or failure detail.

## Public snapshot and owner behavior

- Hide/remove clears the backend-managed public image projection. The sanitized public text/setup remains unless a separate content action is authorized.
- Public comments, reactions, and reports remain governed by their existing lifecycle; image action does not silently delete them.
- Public Preview should later show the owner only a bounded message such as “This public image is unavailable after moderation review.” It should not reveal reporter identity, moderator identity, private moderation notes, or infrastructure details.
- A moderation hold must block immediate reprocessing/replacement of the same source until an audited admin/moderator clearance. Otherwise an owner could bypass removal by creating a new snapshot or asset generation.
- The processor should enforce the hold from protected ledger/restriction state, not from client UI. Unpublishing and republishing must not erase it.
- Owners retain full access to their private original and may delete it through its separate private lifecycle. Moderators never gain private access.
- An owner notification/appeal workflow is deferred. A future notification should be in-app, bounded, and omit reporter/moderator identity and private report details.

## Data model foundation

Phase 2G.1 implements only the smallest fields that can remain safe before report and moderation commands exist. It adds no model with wider access and no client mutation for moderation state.

### Report

- `ReportTargetType` includes `public_image`.
- Continue using `targetId` for the safe public snapshot id.
- `Report.publicImageAssetId` reserves the backend-written immutable reported-generation binding. Its field authorization permits `admin`/`moderator` read and report-owner read/delete while denying reporter create/update and all public/API-key access. No current UI displays or accepts it.
- Phase 2G.2 temporarily uses the direct reporter-owned model create path for snapshot-level image reports because it cannot establish the protected generation binding. Every such unbound row must be treated as unavailable/non-actionable by future image preview/action code. A later backend hardening phase must add the dedicated report command so reporter identity, initial status, binding, normalization, and idempotency are server-controlled.
- A new report index is deferred until the trusted binding command and Phase 2G.3 queue access patterns are finalized; adding a speculative index now would not make unbound reports safe.

### PublicImageAsset

Processing lifecycle `status` remains separate from the implemented moderation state:

- `moderationStatus`: `clear`, `hidden`, or `removed`;
- `hiddenAt`, `removedAt`, and `lastReportAt`;
- bounded `moderationReason` suitable for owner-safe display only when policy allows.

`hiddenBy` and `removedBy` are intentionally not added to the owner-readable ledger. Actor identity belongs in the future protected `ModerationActionLog` rather than an owner-visible field.

`reported` is intentionally not a moderation status. Reports and their `open | reviewed | dismissed | action_needed` workflow remain separate records, while `lastReportAt` can support protected queue prioritization later. This prevents report creation or report-status changes from implicitly changing public delivery.

Do not grant group read access to the whole model. A backend resolver/action may use attribute-limited IAM and return a safe custom projection.

The processor initializes new or safely reprocessed rows to `moderationStatus = clear` and refuses to reuse a generation with any other non-empty moderation state. The public resolver permits `clear` and temporarily permits a missing value for legacy pre-2G.1 rows; it returns the same generic unavailable result for `hidden`, `removed`, or unknown values. Before Phase 2G.4 can write moderation actions, existing eligible rows must be backfilled to `clear` and the temporary missing-value compatibility path must be removed so delivery requires exact `clear`.

Add a protected source/snapshot lookup or moderation-hold record so the processor can reject reprocessing after a moderator action even if the owner unpublishes and creates a new public snapshot. The hold should be clearable only by a separate audited admin/moderator decision.

### PublicPassportSnapshot

Consider an owner/group-readable, API-key-hidden bounded moderation status for Public Preview. Normal clients cannot write it. Public viewers need only the absence of an image projection, not an explanation.

### ModerationActionLog

A future append-only backend-written model should record:

- action id and idempotency key;
- report id and protected image-generation binding;
- action (`hide`, `remove`, later `clear_hold`);
- actor Cognito subject or canonical internal key, never email;
- bounded reason code and separately bounded note;
- prior/new moderation state;
- detachment and cleanup outcome;
- timestamp and safe correlation id.

Do not store S3 keys, URLs, private candidate/source ids, filenames, alt text, image bytes, profile data, or tokens in the audit row. Normal users and API-key clients receive no audit access. Moderator/admin read access should follow retention and least-privilege policy.

## IAM, storage, and logging

- Report command: authenticated invocation; read only the public snapshot/current public asset projection needed for validation; create only the normalized report/binding.
- Review query: `admin`/`moderator` invocation; attribute-limited reads of Report, sanitized public snapshot, and public-image moderation fields; S3 read only for the exact processed public derivative or a dedicated short-lived resolver.
- Moderator action: `admin`/`moderator` invocation; conditional snapshot/asset updates, protected audit create, and delete only under `public/passports/*/cover/*.jpg` after canonical validation.
- No Phase 2G function receives private-prefix read/write/delete or bucket-wide list permission.
- Browser/API-key principals retain no direct Storage access to the derivative namespace.
- Reconciliation permissions, if later required, belong to a separate worker—not the public resolver, moderation UI, or normal owner client.
- Log only fixed event names, bounded action/outcome/failure codes, duration, and aggregate metrics. Keep identifiers and user content out of logs and metric dimensions.

## Cleanup and retry behavior

- Detach the public projection conditionally before public-object deletion.
- If detachment fails, do not delete an object that may still be current.
- If detachment succeeds and deletion fails, keep delivery revoked, mark cleanup pending, and retry idempotently.
- Treat `NoSuchKey` as successful deletion.
- Never roll a hidden/removed projection back because cleanup failed.
- A retry accepts report/action id and idempotency key, not a key or asset id from the browser.
- Concurrent owner removal, unpublish, replacement, and moderator action converge on a non-deliverable result. A moderation action must not delete a newer replacement object.
- Durable retry, dead-letter handling, orphan reconciliation, and optional quarantine are Phase 2G.5 work and remain unimplemented now.

## Planned UI

### Public Passport detail only

- Show **Report image** adjacent to an available processed public image, distinct from the existing **Report content** control.
- Signed-in users receive a bounded reason/details form and one submission in flight.
- Signed-out users receive a sign-in prompt.
- Hide the action when no public derivative is available. Do not add it to Discover or public profile cards.
- After submission, show only success/already-reported/unavailable/retry copy. Never show report counts or enforcement state publicly.

### Moderation reports

- Add a `public_image` report card/section within the existing group-gated queue.
- Show the safe review projection and exact reported-generation preview only while available.
- Keep the existing status selector separate from **Hide public image** and **Remove public image**.
- Require confirmation for image actions and a bounded reason. **Remove** should communicate permanence for the public derivative and preservation of the private original.
- Show removing, hidden, removed, superseded, cleanup-pending, failed, and retry states without raw errors or identifiers.
- Do not add delete/suspend/private-record controls.

### Owner Public Preview

- Later show a bounded hidden/removed notice after backend moderation state exists.
- Keep sanitized text/setup controls separate.
- Disable public image processing/replacement while a moderation hold is active.
- Explain that the private original remains private and unchanged and that a future review/appeal path may be required before another public image is prepared.

## Implementation phases

### Phase 2G.1: schema and contract foundation

- **Implemented:** reserve `public_image`, protect `Report.publicImageAssetId`, add the separate owner-readable/client-nonwritable moderation fields, initialize new processing rows to `clear`, and make delivery unavailable for blocked or unknown moderation states.
- **Deferred:** the report command, report/queue indexes, durable cross-generation moderation hold, legacy-row backfill, moderator projection/action, and audit model.
- Keep full-ledger moderator access unavailable; Phase 2G.3 must use a purpose-built safe projection.

### Phase 2G.2: public image reporting on detail only

- **Implemented:** add **Report image** only after an eligible image loads on saved Public Passport detail, with allow-listed reasons, normalized 500-character details, bounded success/failure copy, and a signed-out sign-in prompt.
- **Implemented:** send the safe public snapshot id through the existing reporter-owned model path without any key, path, URL, asset/owner/source id, filename, target-photo data, or image bytes.
- **Limitation:** reports remain generation-unbound and non-actionable until a trusted backend command validates the current derivative and writes `Report.publicImageAssetId`. Client-only duplicate blocking is per rendered view; durable idempotency/rate limiting is deferred with that command.
- Discover/public profiles remain image-free, and report submission never auto-hides or removes an image.

### Phase 2G.3: admin/moderator review UI

- Add the group-authorized safe review projection bound to report id and exact image generation.
- Add public-image report cards and safe processed-derivative preview.
- Preserve current friendly reporter identity and report-status workflow.
- Do not add image mutation until review/auth/privacy QA passes.

### Phase 2G.4: backend-controlled moderator hide/remove

- Add the separate group-authorized action and narrow IAM.
- Implement conditional generation checks, moderation hold, detach-first revocation, exact public-object cleanup, and bounded retries.
- Add confirmed UI controls only after deployed action testing.
- Preserve the public text snapshot and private original.

### Phase 2G.5: lifecycle cleanup and audit hardening

- Add append-only action audit, idempotency, durable retries, metrics, dead-letter handling, and owner-safe status/notification planning.
- Reconcile missing objects, stale projections, superseded assets, and incomplete cleanup without private-source access.
- Define retention/quarantine/appeal policy before retaining processed image evidence.

### Phase 2G.6: consider Discover card images

- Run owner, reporter, signed-out, normal-user, moderator, admin, stale-generation, concurrent-action, missing-object, private-account, and cleanup-pending hosted QA.
- Confirm no private data or internal ledger fields cross the public/moderation boundary.
- Only after those gates pass, separately plan whether Discover card images should render. Public profile images and target photos remain separate deferred decisions.

## Future QA outline

- Report an active image signed in; confirm exact-generation binding and no client-supplied internal id/key.
- Attempt signed-out, duplicate, rapid, foreign, malformed, missing, hidden, removed, superseded, private-account, unpublished, demo, and target-photo reports.
- Replace an image after it is reported; confirm review marks the old report superseded and cannot action the replacement.
- Verify an open report alone does not hide an image.
- Hide/remove through moderator and admin accounts; verify a normal account cannot call either action.
- Verify detachment stops new URLs and exact deletion invalidates an already-issued URL as soon as S3 observes deletion; test the bounded 60-second residual risk when cleanup fails.
- Verify public text/setup, comments, reactions, and reports remain unless separately moderated.
- Verify owner removal/unpublish/replacement races converge safely with moderator action.
- Verify the private original, private key, `PrivateImageAsset`, private source record, target photos, and owner private profile remain unreadable to moderators and public clients.
- Inspect DOM, GraphQL variables/responses, S3 requests, browser storage, console, CloudWatch logs, and audit rows for prohibited identifiers/content.
- Verify status updates never mutate image state and image actions never silently rewrite report status.

## Deferred and out of scope

- trusted report-binding Lambda/IAM, indexes, moderator projection/action UI, cleanup orchestration, notification, and audit implementation;
- automated report-count hiding or other brigading-sensitive enforcement;
- broad moderator access to private records or the full public/private image ledgers;
- owner notification center, appeal, warning, suspension, or account action;
- approved evidence quarantine and retention policy;
- scheduled cleanup/reconciliation;
- Discover or public profile image rendering;
- target-photo publishing or moderation;
- galleries, feeds/follows, direct messaging, marketplace behavior, or account deletion; and
- calculators, scope outputs, hold recommendations, field corrections, sight-in instructions, or aiming/adjustment guidance.
