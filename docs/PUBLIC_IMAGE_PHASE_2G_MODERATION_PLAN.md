# Phase 2G Public Image Moderation and Reporting Plan

Last updated: September 7, 2026

## Purpose

Phase 2G adds a safe reporting and moderation lifecycle for the one processed Equipment Passport cover that may render on saved Public Passport detail. It must exist and pass hosted adversarial testing before image rendering is considered for Discover cards or public profile pages.

Phase 2G.1 provides schema and delivery-contract guardrails. Phase 2G.2 adds the first detail-only **Report image** UI, and Phase 2G.3 makes those reports understandable in the group-gated moderation queue without embedding an image or reading an image ledger. Phase 2G.4 adds a separate admin/moderator-only action for the derivative currently attached to a public snapshot. Phase 2G.5 replaces the interim direct report create with a trusted action that binds every new product-generated image report to the exact eligible generation current when the transaction commits. Legacy rows remain unbound. The moderator action is still current-snapshot scoped rather than an exact reported-generation action. Exact-generation preview/action, durable cross-generation holds, notification, audit log, and broader image rendering remain unavailable.

## Current boundary

Today:

- `PublicPassportImage` receives only a public snapshot id and renders only on saved Public Passport detail.
- `resolvePublicPassportImage` returns a 60-second, non-cacheable URL only when the public snapshot, public profile visibility, source passport, `ready` public-image ledger row, non-blocked moderation state, canonical derivative key, safe alt text, and S3 object all agree.
- `PublicImageAsset` is owner-readable and client-nonwritable. Phase 2G.1 adds an independent owner-readable `clear | hidden | removed` moderation state plus bounded lifecycle timestamps/reason metadata, but does not broaden moderator access to the full ledger.
- Signed-in users can report public snapshots and comments through the existing `Report` model. When an eligible derivative finishes loading on saved Public Passport detail, **Report image** uses the Phase 2G.5 `createPublicImageReport` mutation. The browser supplies only the safe public snapshot id, an allow-listed reason, and bounded optional details; the backend derives `targetType = public_image`, reporter identity, and the exact current `PublicImageAsset` generation.
- Admins and moderators can read report metadata and update only `Report.status`. Public-image reports receive a distinct safe card and a link to the existing public setup route. Report status remains metadata-only.
- Phase 2G.4 exposes **Hide public image** and **Remove public image** only on those group-gated public-image report cards. The client sends only the public snapshot id, `hide | remove`, and an optional bounded owner-safe reason. The backend derives every ledger/storage identifier and conditionally acts only on the currently attached canonical `equipment_cover` derivative.
- Owner removal, derivative-aware Unpublish, and remove-first replacement use backend-controlled detachment and preserve the private original.
- Discover cards, public profile cards, and target photos remain image-free.

## Non-negotiable safety invariants

1. A browser reports an image by public snapshot id. It never supplies a private/public S3 key, URL, owner id, source record id, private image asset id, destination path, filename, or image bytes.
2. Every report produced by the supported image-report UI is bound by the backend to the exact eligible public image generation current when its transaction commits. Historical/direct-model rows without a binding remain legacy/unbound. The Phase 2G.4 reviewer must still freshly inspect the current public setup because its action is current-snapshot scoped, not report-generation scoped.
3. Moderator UI receives a deliberately limited projection. It never reads `PrivateImageAsset`, the private Equipment Passport, or the full `PublicImageAsset` ledger model directly.
4. Hide/remove revokes new delivery before or atomically with any asynchronous object cleanup. The public snapshot text/setup remains published unless a separate content workflow changes it.
5. The owner-private original is never deleted, copied into moderation storage, exposed, or made readable to a moderator by an image action.
6. `range_session_target`, WebP candidates, demo/sample data, stale candidates, and all non-`equipment_cover` sources remain ineligible.
7. Report status and image availability are separate state machines. `reviewed`, `dismissed`, or `action_needed` never implicitly hides, restores, or removes an image.
8. The current snapshot action conditionally revalidates the attached projection/asset and rejects a concurrent change. The report binding preserves which generation was reported, but preventing an old report card from being used to initiate an action against a later replacement still requires the deferred exact-generation review/action flow.
9. Public and moderation failures are bounded and fail closed. Logs contain fixed event names and reason codes, not ids, keys, URLs, filenames, alt text, report details, profile data, or tokens.
10. There is no fallback to a private image under any failure, missing-object, hidden, removed, private-account, or unpublished state.

## Implemented report contract

### Public input

The supported product flow uses a dedicated authenticated backend command rather than letting the browser construct a `public_image` Report row directly:

```text
createPublicImageReport(
  publicPassportSnapshotId,
  reason,
  optional bounded details
)
```

The command derives reporter identity from Cognito and accepts no reporter id, public image asset id, source id, owner id, key, URL, filename, or image bytes. The existing reporter-owned model create path remains for non-image reports; manually created or historical unbound `public_image` rows are treated as legacy data rather than proof of a generation.

Historically, Phase 2G.2 used a constrained direct model create and could not establish immutable generation binding. Phase 2G.5 replaced that product path. Those older rows remain clearly labeled legacy/unbound and continue through the metadata/status workflow.

Server validation now:

1. normalize and validate the persistent public snapshot id;
2. verify the snapshot is public and currently projects one eligible image;
3. resolve the exact `PublicImageAsset` through trusted backend records;
4. require `sourceType = equipment_cover`, lifecycle `status = ready`, moderation availability, canonical derivative path, and matching snapshot/asset fields;
5. derive the authenticated reporter owner key and prevent caller-supplied identity;
6. normalize a server allow-listed reason and bounded details; and
7. transactionally create a report bound to both the safe public snapshot id and exact immutable image generation while updating `lastReportAt`.

The mutation returns only `submitted | failed` plus a bounded failure code and never returns a report id, asset id, key, or other internal identifier. Missing, hidden, removed, foreign, and malformed targets collapse to bounded unavailable/failure behavior so the action does not become an existence oracle. Durable duplicate suppression, idempotency, and rate limiting remain deferred.

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

Phase 2G.3 intentionally uses only the existing group-authorized `Report` metadata plus a link to the sanitized public setup route. It does not embed the image, invoke the delivery resolver from moderation, or read `PublicImageAsset`. After trusted exact-generation report binding exists, add a group-authorized query such as `getPublicImageModerationCase(reportId)` or a purpose-built queue projection. Do not add `admin`/`moderator` read authorization to the full `PublicImageAsset` model.

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

Phase 2G.4 uses a separate custom action from owner cleanup:

```text
moderatePublicPassportImage(
  publicPassportSnapshotId,
  action: hide | remove,
  optional bounded owner-safe reason
)
```

The action must be authorized directly to Cognito `admin`/`moderator` groups. Do not broaden `removePublicPassportImage`, impersonate the owner, or let normal users update moderation fields.

The moderation action client sends only the public snapshot id because the Phase 2G.4 action remains deliberately current-snapshot scoped even when the report has a protected generation binding. It must not send or consume that report binding, an asset id, owner id, source id, key, path, URL, filename, or image bytes. The backend resolves the current snapshot projection and current ledger asset, validates exact owner/source/alt/key agreement plus `ready + clear + equipment_cover`, derives the canonical derivative path, and uses conditional writes to reject concurrent changes.

This remains deliberately narrower than an exact-generation action. Phase 2G.5 provides immutable report binding, but the UI still warns the reviewer to inspect the linked current public setup immediately before confirming. A stale report is not automatically associated with a replacement. A future phase must add an exact-generation safe projection/action plus a durable hold/audit workflow.

### Hide

1. Re-read the current snapshot and public asset using backend-derived identifiers.
2. Confirm the current generation is exactly bound, canonical, `ready`, `clear`, and `equipment_cover`.
3. Atomically detach `publicImageAssetId`, `publicImageKey`, and `publicImageAltText` from the public snapshot and mark the current asset `hidden`.
4. Preserve the processed public derivative for a later explicit remove action; preserve the private original and public text/setup.
5. Return only the bounded `hidden`, `not_attached`, or `failed` result.

Hiding should not be treated as an automatically reversible UI toggle. Without an approved quarantine/appeal policy, owner re-consent and fresh processing after an audited moderator clearance are safer than restoring the old object.

### Remove

Use the same detach-first checks, mark the public asset lifecycle/moderation state `removed`, and delete only its backend-derived canonical public derivative. A missing S3 object is an idempotent success. If deletion or safe finalization cannot complete after detachment, return `cleanup_pending` so a repeated snapshot-id-only call can retry. Preserve the private original, private source record, report, and sanitized public text/setup.

### Existing 60-second URLs

Detaching the projection stops new resolver URLs immediately. An already-issued S3 URL can remain valid for its remaining lifetime, currently at most 60 seconds. **Remove** attempts exact-object deletion after detachment and reports `cleanup_pending` if that cleanup cannot complete. **Hide** intentionally retains the processed derivative, so it relies on projection detachment plus the resolver's moderation-state check for new requests; previously issued URLs retain the same bounded residual lifetime. A future proxy or CloudFront design could provide stronger immediate revocation if policy requires it.

If a hidden snapshot is later unpublished before a moderator explicitly chooses Remove, the current snapshot-id action no longer has a live snapshot from which to derive the hidden generation. It returns the same safe no-attachment result and does not guess an object key or delete across generations. The retained derivative remains unreachable through the public resolver, but protected orphan reconciliation or exact-generation moderation binding is required to delete it later. This is an intentional fail-closed lifecycle limitation, not permission for owner cleanup to erase a moderation-retained object.

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
- A future durable moderation hold must block immediate reprocessing/replacement of the same source until an audited admin/moderator clearance. The current asset generation cannot be reprocessed after `hidden`/`removed`, but Phase 2G.4 does not yet create a cross-generation hold; an owner can later prepare a distinct generation.
- A future phase should enforce that hold from protected ledger/restriction state, not from client UI. Unpublishing and republishing must not erase it.
- Owners retain full access to their private original and may delete it through its separate private lifecycle. Moderators never gain private access.
- An owner notification/appeal workflow is deferred. A future notification should be in-app, bounded, and omit reporter/moderator identity and private report details.

## Data model foundation

Phase 2G.1 implements only the smallest fields that can remain safe before report and moderation commands exist. It adds no model with wider access and no client mutation for moderation state.

### Report

- `ReportTargetType` includes `public_image`.
- Continue using `targetId` for the safe public snapshot id.
- `Report.publicImageAssetId` is the backend-written immutable reported-generation binding. Its field authorization permits `admin`/`moderator` read and report-owner read/delete while denying reporter create/update and all public/API-key access. Public UI never displays or accepts it; authorized moderation cards show only a shortened reference.
- Phase 2G.5 replaces the Phase 2G.2 interim direct reporter-owned create with `createPublicImageReport`. The browser sends only `publicPassportSnapshotId`, an allow-listed reason, and bounded optional details. The Lambda derives reporter identity and the exact current asset, validates the public snapshot/source/profile graph, then transactionally writes the bound `open` report and `lastReportAt`. Existing unbound rows remain reviewable/status-editable legacy records.
- A new report index is deferred until the trusted binding command and later exact-generation review access patterns are finalized; adding a speculative index now would not make unbound reports safe.

### PublicImageAsset

Processing lifecycle `status` remains separate from the implemented moderation state:

- `moderationStatus`: `clear`, `hidden`, or `removed`;
- `hiddenAt`, `removedAt`, and `lastReportAt`;
- bounded `moderationReason` suitable for owner-safe display only when policy allows.

`hiddenBy` and `removedBy` are intentionally not added to the owner-readable ledger. Actor identity belongs in the future protected `ModerationActionLog` rather than an owner-visible field.

`reported` is intentionally not a moderation status. Reports and their `open | reviewed | dismissed | action_needed` workflow remain separate records, while `lastReportAt` can support protected queue prioritization later. This prevents report creation or report-status changes from implicitly changing public delivery.

Do not grant group read access to the whole model. A backend resolver/action may use attribute-limited IAM and return a safe custom projection.

The processor initializes new or safely reprocessed rows to `moderationStatus = clear` and refuses to reuse a generation with any other non-empty moderation state. The public resolver permits `clear` and temporarily permits a missing value for legacy pre-2G.1 rows; it returns the same generic unavailable result for `hidden`, `removed`, or unknown values. Phase 2G.4 requires exact `clear` and fails closed for a legacy missing value. Backfill/reprocess eligible legacy rows and then remove the resolver compatibility path in a controlled migration.

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
- Durable retry, dead-letter handling, orphan reconciliation, and optional quarantine remain unimplemented.

## Planned UI

### Public Passport detail only

- Show **Report image** adjacent to an available processed public image, distinct from the existing **Report content** control.
- Signed-in users receive a bounded reason/details form and one submission in flight.
- Signed-out users receive a sign-in prompt.
- Hide the action when no public derivative is available. Do not add it to Discover or public profile cards.
- After submission, show only success/already-reported/unavailable/retry copy. Never show report counts or enforcement state publicly.

### Moderation reports

- **Implemented in Phase 2G.3:** show a distinct `public_image` report card within the existing group-gated queue, including the safe public snapshot reference, reason/details, reporter identity, dates, and report status.
- **Implemented in Phase 2G.3:** link to the existing sanitized public setup route so reviewers can inspect what public visitors currently see. Do not embed an image, invoke an image resolver from moderation, or expose workflow-ledger data.
- **Implemented in Phase 2G.4:** show separate **Hide public image** and **Remove public image** controls on valid persistent public-image report cards only. The existing status selector stays independent.
- **Implemented in Phase 2G.4:** require explicit confirmation and accept an optional 240-character owner-safe reason that rejects URLs/storage paths. **Remove** communicates deletion of only the processed derivative and preservation of the private original/text snapshot.
- **Implemented in Phase 2G.4:** show applying, hidden, removed, not-attached, cleanup-pending, and failed states without raw errors or identifiers.
- Reviewers must inspect the linked current public setup immediately before acting. The trusted report binding is implemented, but a purpose-built safe exact-generation projection/preview/action must replace this convention before report-bound moderation is claimed.
- Do not add delete/suspend/private-record controls.

### Owner Public Preview

- Later show a bounded hidden/removed notice after backend moderation state exists.
- Keep sanitized text/setup controls separate.
- Disable public image processing/replacement while a moderation hold is active.
- Explain that the private original remains private and unchanged and that a future review/appeal path may be required before another public image is prepared.

## Implementation phases

### Phase 2G.1: schema and contract foundation

- **Implemented:** reserve `public_image`, protect `Report.publicImageAssetId`, add the separate owner-readable/client-nonwritable moderation fields, initialize new processing rows to `clear`, and make delivery unavailable for blocked or unknown moderation states.
- **Deferred:** report/queue indexes, durable cross-generation moderation hold, legacy-row backfill, exact-generation moderator projection/action, and audit model.
- Keep full-ledger moderator access unavailable; Phase 2G.3 uses existing report metadata and a public-route link, while any later exact-generation preview must use a purpose-built safe projection.

### Phase 2G.2: public image reporting on detail only

- **Implemented:** add **Report image** only after an eligible image loads on saved Public Passport detail, with allow-listed reasons, normalized 500-character details, bounded success/failure copy, and a signed-out sign-in prompt.
- **Implemented:** send the safe public snapshot id through the existing reporter-owned model path without any key, path, URL, asset/owner/source id, filename, target-photo data, or image bytes.
- **Historical limitation:** reports created before Phase 2G.5 remain generation-unbound. The Phase 2G.4 control is explicitly current-snapshot scoped. Client-only duplicate blocking is per rendered view; durable idempotency/rate limiting remains deferred.
- Discover/public profiles remain image-free, and report submission never auto-hides or removes an image.

### Phase 2G.3: admin/moderator review UI

- **Implemented:** add distinct public-image report cards to the existing group-gated queue with a human-friendly target label, muted public snapshot reference, reason/details, safe reporter identity, timestamps, and report status.
- **Implemented:** provide an external-tab link to the current sanitized Public Passport detail page. Moderation does not embed the derivative, call private models, invoke the public image resolver, or expose keys, paths, ledger fields, content-owner identifiers, source identifiers, filenames, or private profile data.
- **Implemented:** retain pending sorting/counting and the `open | reviewed | dismissed | action_needed` workflow; status changes remain metadata-only and show bounded failures.
- **Limitation:** legacy reports remain snapshot-bound/generation-unbound. New bound reports identify the historical generation, but Phase 2G.4 can still act only on the freshly reviewed current snapshot image; exact-generation preview and report-bound image mutation remain deferred.

### Phase 2G.4: backend-controlled moderator hide/remove

- **Implemented:** add the separately group-authorized `moderatePublicPassportImage(publicPassportSnapshotId, action, reason?)` mutation with duplicate group validation inside the Lambda.
- **Implemented:** derive and validate the current attached asset/canonical key server-side; reject demo/sample ids, target photos, missing/unknown moderation state, projection mismatches, ambiguous multi-generation cleanup, non-ready assets, and concurrent state changes with bounded results.
- **Implemented:** Hide atomically detaches delivery and marks the current asset hidden while retaining the derivative; Remove detaches first, marks removed, deletes only the canonical public object, and supports idempotent/cleanup-pending retry behavior.
- **Implemented:** add confirmed UI controls only to valid `public_image` moderation cards. Client input contains no asset/source/owner id, key, path, URL, filename, or image bytes.
- **Implemented:** pin the client mutation to Cognito user-pool authorization rather than relying on the app's default auth mode; AppSync and the Lambda still enforce `admin`/`moderator` membership independently.
- **Implemented:** preserve `Report.status`, the public text snapshot, private source records, and private original. The function has no private-table or private-prefix permission.
- **Implemented:** if final ledger confirmation fails after detach/delete, return retry-safe `cleanup_pending` instead of leaking a transient DynamoDB failure as an ambiguous raw error.
- **Limitation:** this remains a current-snapshot action even when the report is generation-bound. Conditional writes protect against concurrent replacement, but exact reported-generation targeting and a durable cross-generation moderation hold remain future work.
- **Limitation:** Hide retains the processed derivative. If the owner unpublishes the now-text-only snapshot before moderator Remove, delivery remains unavailable but deletion requires later protected orphan reconciliation because the snapshot-id action will not guess a detached generation.
- **Deployment gate:** eligible rows require `moderationStatus = clear`; legacy missing-state rows fail closed until controlled backfill/reprocess. Run hosted moderator/admin authorization and lifecycle tests before relying on the action.

### Phase 2G.5: generation-bound report creation

- **Implemented:** add the Cognito-authenticated `createPublicImageReport(publicPassportSnapshotId, reason, details?)` mutation. The browser never supplies reporter id, asset id, owner/source id, key/path, URL, filename, target-photo data, or image bytes.
- **Implemented:** derive the reporter from Cognito and the current generation from trusted snapshot/asset records; require an exact canonical `ready + clear + equipment_cover` binding plus public Equipment Passport and profile visibility.
- **Implemented:** normalize and bound details to 500 characters, reject links/storage paths, and allow only the six documented reason values. Responses/logs contain only bounded status/failure codes and no identifiers or report content.
- **Implemented:** conditionally and transactionally create the `open` Report with the derived `publicImageAssetId` while updating `PublicImageAsset.lastReportAt`. Concurrent removal, replacement, unpublish, or visibility changes fail closed without creating an unbound report.
- **Implemented:** remove API-key model read access from raw public snapshot image projection fields and add explicit sanitized selection sets to public snapshot queries. The delivery resolver remains the only public image delivery path.
- **Implemented:** label moderation cards **Generation-bound report** or **Legacy/unbound report** and show at most a shortened generation reference. No image preview or new moderation action is added.
- **Limitation:** generic direct `Report.create` remains available for other report target types, so historical or externally created unbound `public_image` rows may still exist and are handled as legacy/unbound. The supported product image-report path always uses the trusted action.
- **Limitation:** binding proves the generation current at report submission; the existing moderator Hide/Remove control still targets only the current attached generation after fresh public-route review.

### Phase 2G.6: lifecycle cleanup and audit hardening

- Add append-only action audit, idempotency, durable retries, metrics, dead-letter handling, and owner-safe status/notification planning.
- Reconcile missing objects, stale projections, superseded assets, and incomplete cleanup without private-source access.
- Define retention/quarantine/appeal policy before retaining processed image evidence.

### Phase 2G.7: consider Discover card images

- Run owner, reporter, signed-out, normal-user, moderator, admin, stale-generation, concurrent-action, missing-object, private-account, and cleanup-pending hosted QA.
- Confirm no private data or internal ledger fields cross the public/moderation boundary.
- Only after those gates pass, separately plan whether Discover card images should render. Public profile images and target photos remain separate deferred decisions.

## QA outline

- Report an active image signed in; confirm the mutation input contains only snapshot id, reason, and optional details, while the created report is bound to the exact current generation server-side.
- Attempt signed-out, duplicate, rapid, foreign, malformed, missing, hidden, removed, superseded, private-account, unpublished, demo, and target-photo reports.
- Replace an image after it is reported; confirm the report retains its original binding while the moderator UI warns that the current action targets the newly attached image and requires a fresh public-route review.
- Verify an open report alone does not hide an image.
- Hide/remove through moderator and admin accounts; verify a normal account cannot call either action.
- Verify detachment stops new URLs and exact deletion invalidates an already-issued URL as soon as S3 observes deletion; test the bounded 60-second residual risk when cleanup fails.
- Verify public text/setup, comments, reactions, and reports remain unless separately moderated.
- Verify owner removal/unpublish/replacement races converge safely with moderator action.
- Verify the private original, private key, `PrivateImageAsset`, private source record, target photos, and owner private profile remain unreadable to moderators and public clients.
- Inspect DOM, GraphQL variables/responses, S3 requests, browser storage, console, and CloudWatch logs for prohibited identifiers/content. Audit rows do not exist yet.
- Verify status updates never mutate image state and image actions never silently rewrite report status.

## Deferred and out of scope

- report/queue indexes, exact-generation moderator projection/action UI, cross-generation hold, cleanup orchestration, notification, and audit implementation;
- automated report-count hiding or other brigading-sensitive enforcement;
- broad moderator access to private records or the full public/private image ledgers;
- owner notification center, appeal, warning, suspension, or account action;
- approved evidence quarantine and retention policy;
- scheduled cleanup/reconciliation;
- Discover or public profile image rendering;
- target-photo publishing or moderation;
- galleries, feeds/follows, direct messaging, marketplace behavior, or account deletion; and
- calculators, scope outputs, hold recommendations, field corrections, sight-in instructions, or aiming/adjustment guidance.
