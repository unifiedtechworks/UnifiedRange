# Phase 2D Public Image Consent UI Plan

## Implementation status

Phase 2D owner consent UI was implemented on August 18, 2026 without a schema or backend authorization change. Saved Equipment Passport Public Preview now defaults to **Publish without images**, privately loads only the current verified and processor-compatible `equipment_cover` candidate, requires a private source preview, all safety acknowledgements, and alt text up to 140 characters, then calls the deployed Phase 2C processor through a constrained user-pool wrapper.

Public delivery and rendering remain disabled. Target photos, automatic processing, direct public Storage writes, replacement, removal, and derivative-aware backend unpublish cleanup remain unavailable.

The August 29, 2026 hardening pass added request-generation checks so stale Public Preview or candidate responses cannot win after an auth/route/source change, synchronous in-flight locks for snapshot and processor mutations, and broader rejection of URI schemes and slash/backslash private/public storage-path forms in alt text. It did not change schema, backend logic, Storage access, or public rendering.

## Purpose and current boundary

Phase 2D adds an owner-only consent experience for selecting one verified Equipment Passport cover image in Public Preview. It does not make derivatives publicly deliverable and does not render images in Discover, public profiles, or public passport pages.

The Phase 2C processor already exists. It accepts opaque record IDs, revalidates ownership and eligibility, creates a bounded metadata-free JPEG derivative, and updates backend-managed image projection fields. The destination remains processor-only. Until a later delivery/rendering phase passes its release gates, a successful Phase 2D processing result means only that a public-safe derivative is ready in protected backend storage.

The normal and safest choice remains **Publish without images**.

## Goals

- Keep image publishing optional and off by default.
- Let a signed-in owner select at most one currently verified `equipment_cover` candidate for the Equipment Passport being previewed.
- Require an explicit image-safety review before invoking the processor.
- Collect useful public alt text.
- Send only opaque IDs, bounded alt text, and the required consent acknowledgement to the processor.
- Show clear owner-only processing states using bounded, friendly messages.
- Preserve the current sanitized text/setup snapshot payload and every existing private/public boundary.

## Non-goals

Phase 2D must not add:

- public image delivery or public Storage access;
- image rendering in Public Preview's sanitized output, Discover, public profiles, or public passport pages;
- direct browser writes to a public prefix;
- raw S3 keys, URLs, owner IDs, source record IDs, destination paths, or image bytes in processor input;
- Range Session target-photo selection or processing;
- automatic image selection after upload or verification;
- automatic processing during ordinary text snapshot publishing;
- public profile avatars, multi-image galleries, feeds, follows, messaging, or marketplace behavior;
- moderator image actions; or
- calculators, scope outputs, hold recommendations, field corrections, sight-in instructions, or directions for adjusting or aiming equipment.

## Release prerequisite

Do not approve the Phase 2D hosted release until the Phase 2C positive, negative, concurrency, rollback, metadata-removal, IAM, and hosted tests in [PHASE_2C_PROCESSOR_TESTING.md](PHASE_2C_PROCESSOR_TESTING.md) pass.

The implementation may be exercised with disposable development fixtures while those tests run, but it must not be approved for general hosted use before the gate passes.

## Existing contracts that Phase 2D must preserve

### Sanitized text snapshot

`buildPublicPassportSnapshotInput` currently includes only the approved text/setup fields. It omits private image keys and all backend-managed public image fields. Phase 2D must not broaden this builder.

Creating or updating `PublicPassportSnapshot` remains the first operation. The processor requires an existing snapshot ID, so a first-time image choice cannot bypass sanitized text publication.

### Private image candidate

`PrivateImageAsset` is owner-scoped and contains sensitive private storage binding data. The selection helper may inspect an authenticated owner's records, but the React component should receive only a narrow safe view such as:

```ts
type EligibleEquipmentCoverCandidate = {
  id: string;
  status: "verified";
  verifiedAt?: string;
};
```

Do not put `storageKey`, `storageIdentityId`, filenames, owner aliases, source IDs, or signed URLs in form values, processor variables, analytics, error telemetry, or user-visible technical details.

### Processor mutation

The only user-selected identifiers/content sent to `processPublicPassportImage` are:

- `publicPassportSnapshotId`;
- `privateImageAssetId`; and
- optional bounded `altText`.

The deployed mutation also requires `consentConfirmed: true`. This is a protocol acknowledgement derived only after the user completes the checklist; it is not an owner identifier, path, source selector, or client authorization claim. The frontend must never allow a caller to supply an owner ID, source record ID, private/public S3 key, bucket, destination, URL, or image bytes.

Invoke the mutation with user-pool authentication explicitly. Never fall back to API-key or guest authorization.

### Backend authority

Client filtering is only a usability measure. The processor remains authoritative for:

- signed-in Cognito identity and canonical owner aliases;
- public snapshot ownership and source Equipment Passport relationship;
- account visibility, public sharing, and immutable username ownership;
- candidate ownership and `verified` binding status;
- `equipment_cover` source type;
- current source record and private key binding;
- S3 object existence, MIME type, bytes, dimensions, and decoded format;
- derivative path generation and guarded projection updates.

The frontend must not interpret a visible candidate as authorization.

## Eligibility lookup plan

Run candidate lookup only when all of these are true:

1. the route is showing a saved, persistent Equipment Passport rather than demo/sample data;
2. the user is signed in;
3. the loaded Equipment Passport belongs to the signed-in owner's accepted aliases;
4. the passport has a current `privateCoverPhotoKey`; and
5. the owner is viewing `/passports/[passportId]/public-preview`.

Query the owner's `PrivateImageAsset` rows for the current record, then retain only rows that satisfy:

- `sourceType === "equipment_cover"`;
- `sourceRecordId` matches the current Equipment Passport;
- `bindingStatus === "verified"`; and
- the candidate's private binding matches the passport's current private cover image.

The last comparison must happen in a private data helper. It may use `storageKey` internally, but must immediately map the result to the narrow safe candidate view before returning it to UI state. This prevents an older verified candidate from being offered after the owner replaces the private cover photo.

If duplicate verified registrations bind the same current image, select the newest valid verification deterministically and show one choice. Candidate history is not part of Phase 2D.

Never query or offer `range_session_target`. Even if a target candidate is verified by Phase 2B, it remains ineligible and the processor rejects it before reading S3.

## Proposed Public Preview layout

Add an owner-only **Optional public image** card near the existing publish controls. It should be visually separate from both the private passport summary and the sanitized public text preview.

The card begins with two choices:

- **Publish without images** — selected by default; and
- **Use my verified equipment cover** — enabled only when one current verified candidate is available.

Supporting copy:

> Images are optional. Your private original stays private. If you choose an image, UnifiedRange creates a separate public-safe derivative after you review the image-safety checklist.

Because public delivery is not part of Phase 2D, a successful developer/owner status must add:

> The public-safe derivative is ready, but images are not displayed publicly in this phase.

Do not relabel the current private image as public and do not place a private signed URL in the sanitized public preview.

### Owner-only source preview

A private source preview is useful for a meaningful safety review. It may reuse the current authenticated private-image display path under these conditions:

- it is labeled **Private source preview**;
- it is rendered only for the signed-in owner;
- its signed URL remains ephemeral and is never stored in the public snapshot, candidate selection value, mutation variables, logs, or analytics;
- failure to load the preview blocks consent rather than offering a blind publish; and
- the preview is not presented as the future public derivative.

If these conditions cannot be met cleanly in the first UI slice, show no image-processing control. A label alone is insufficient consent when the user cannot review the selected image.

## Detailed user flow

### 1. Open Public Preview

The owner opens the saved Equipment Passport's Public Preview. The existing sanitized text/setup preview loads normally. Candidate lookup runs privately in parallel and must not block text-only publishing.

Default state:

- **Publish without images** is selected;
- no candidate is preselected;
- checklist confirmations are false;
- alt text is empty; and
- ordinary publish/update continues to send the existing text-only payload.

### 2. Choose whether to include an image

If no current verified Equipment Passport cover is available, keep **Publish without images** selected. Explain that the owner can upload and verify a private equipment cover from the saved passport page. Do not suggest that a Range Session target photo can be used.

If one is available, enable **Use my verified equipment cover**. Choosing it reveals the owner-only source preview, checklist, and alt-text field. Merely choosing it performs no mutation and creates no derivative.

Changing back to **Publish without images** clears the local candidate selection, checklist state, and unsaved alt text. It must not invoke a backend remove operation.

### 3. Review the image-safety checklist

Require the owner to affirm every item before processing:

- I checked that no serial number is visible.
- I checked that no exact location, address, coordinate, distinctive location detail, or location document is visible.
- I checked that no license plate is visible.
- I checked that no face of a bystander is visible.
- I checked that no private document is visible.
- I checked that no sensitive personal information is visible.
- I understand this selected image is intended for public sharing and contains nothing I want to keep private.

Supporting warning:

> Metadata stripping cannot remove sensitive details that are visible in the pixels. Public images may be copied or shared by others.

All checklist items must reset when the selected candidate changes, the underlying private cover changes, or the user leaves the page. Do not persist consent in local storage.

The current processor records the required acknowledgement and a consent timestamp, but it does not store a consent-policy version. The first Phase 2D slice should use that deployed contract and must not claim that consent is versioned. If versioned evidence becomes a release requirement, add a backend-owned policy version to the action/ledger in a separately reviewed schema change; do not accept an arbitrary policy version as trusted client input.

### 4. Provide alt text

The backend accepts optional bounded alt text, but the Phase 2D UI should require meaningful alt text for an intentionally public setup image unless a reviewed accessibility decision permits an empty decorative label.

Recommended client rules:

- trim surrounding whitespace;
- require 1–140 characters when an image is selected;
- describe the visible setup plainly;
- discourage serial numbers, precise locations, personal names, or other sensitive data; and
- send `undefined`, not an empty string, if an optional-empty policy is later approved.

The backend remains responsible for its own length and input validation.

### 5. Save the sanitized snapshot

For a new public setup, first create the sanitized text/setup snapshot with the existing builder. For an existing public setup, update it with the same existing text/setup builder.

Do not add `publicImageAssetId`, `publicImageKey`, `publicImageAltText`, a private key, or any candidate binding field to this create/update payload.

If the text snapshot save fails, do not invoke image processing.

### 6. Invoke processing after explicit consent

Only invoke the processor when:

- the user explicitly chose the verified equipment cover;
- the source preview loaded successfully;
- every safety acknowledgement is checked;
- alt text passes the selected UI policy;
- the sanitized snapshot save succeeded and returned an ID; and
- the user activates an image-specific confirmation such as **Create public-safe image**.

Recommended mutation shape:

```ts
await client.mutations.processPublicPassportImage(
  {
    publicPassportSnapshotId: snapshot.id,
    privateImageAssetId: candidate.id,
    altText: normalizedAltText || undefined,
    consentConfirmed: true
  },
  { authMode: "userPool" }
);
```

No private or public path should ever be constructed in the browser.

### 7. Report a two-step outcome accurately

Text snapshot publication and image processing are separate operations. If text publication succeeds but processing fails, show both facts:

> Your setup is published without an image. The image could not be processed. Review the message below and try the image again.

Do not report the overall action as rolled back. Do not automatically unpublish the text snapshot, delete the private original, or retry in a loop.

## UI state model

| State | Owner-facing behavior | Allowed actions |
| --- | --- | --- |
| Publish without images | Default; explain that private images stay private | Publish/update sanitized text snapshot |
| No verified equipment image | Explain that no eligible image is ready; link to the private Equipment Passport page | Continue without image |
| Verified image available | Offer one current verified equipment cover; do not preselect it | Select it or continue without image |
| Selected | Show private source preview, checklist, and alt text; no backend action yet | Confirm checklist, edit alt text, clear selection |
| Processing | Show “Creating a public-safe derivative…” and disable duplicate image actions | Wait for the bounded result; text-only navigation may remain available after save |
| Processed successfully | Say the protected derivative is ready for saved Public Passport detail while Discover/profile cards remain image-free | Return to text-only view; replacement/removal deferred as described below |
| Failed | Show a friendly bounded message; retain no sensitive technical data | Retry after correction, choose no image, or return to the private source page |
| Source changed | Clear consent and selection because the previous verification no longer matches the current cover | Re-verify the current private cover or continue without image |

The processing button must guard against double submission. Do not automatically poll unless the processor becomes asynchronous in a later backend revision. The current mutation returns a bounded terminal `ready` or `failed` result for the request.

## Friendly bounded failure mapping

Never render raw GraphQL errors, Lambda exceptions, S3 responses, record contents, or identifiers. Map the processor's bounded codes into a few actionable owner messages.

| Bounded codes | Suggested message |
| --- | --- |
| `unauthorized` | “We could not verify access to this snapshot and image. Refresh your session and try again.” |
| `invalid_request`, `invalid_alt_text`, `consent_required` | “Review the selected image, safety confirmations, and alt text, then try again.” |
| `candidate_not_verified` | “This private equipment image is not currently verified. Verify it from the saved passport before trying again.” |
| `unsupported_source` | “Only a verified Equipment Passport cover image can be processed.” |
| `source_not_found`, `source_mismatch`, `invalid_storage_key`, `metadata_mismatch`, `object_not_found` | “The private source changed or is no longer available. Return to the passport, upload or verify the current cover, and try again.” |
| `profile_not_public`, `username_unresolved` | “Public sharing is not currently available for this account. Review profile visibility and username ownership.” |
| `unsupported_content_type`, `file_too_large`, `invalid_image`, `animated_image`, `dimensions_exceeded`, `output_too_large` | “This image cannot be prepared safely. Use a different supported JPEG or PNG equipment cover.” |
| `storage_write_failed`, `state_changed`, `unknown_error` | “The public-safe image could not be completed. Your private original was not changed. Try again later.” |

Log only a bounded operation name, status, and failure code through the project's approved telemetry policy. Do not log IDs, usernames, paths, URLs, filenames, tokens, alt text, or record data.

## Removal and replacement plan

There are two different meanings of “remove,” and the UI must distinguish them.

### Before processing

**Remove selection** is local-only. It returns the form to **Publish without images** and clears checklist/alt-text state. It does not mutate a snapshot, ledger row, private record, or S3 object.

### After processing

Do not expose an enabled **Remove public image** or **Replace public image** action until a backend lifecycle command exists. Normal clients cannot safely clear guarded snapshot fields or delete processor-owned derivatives. The implemented UI disables direct Unpublish and replacement when the snapshot already has a prepared derivative.

A later backend action should:

1. authenticate and revalidate the snapshot owner;
2. detach the public projection conditionally;
3. mark the public image ledger row removed or superseded;
4. delete or queue deletion of the derivative without touching the private original;
5. invalidate any future public delivery cache; and
6. return only a bounded status.

Replacement should process a newly consented candidate, attach it conditionally, and then retire the superseded derivative. Consent must be completed again for each replacement.

The current direct client deletion used by **Unpublish** must also move behind backend cleanup before public image delivery is enabled. Until that lifecycle work exists, Phase 2D processing should remain a gated test/review capability rather than a general release.

## Proposed implementation structure

The exact filenames can change during implementation, but responsibilities should remain separated.

### `PublicPassportPreview.tsx` — implemented

- Continue owning sanitized text snapshot create/update.
- Render the consent panel only for a signed-in owner and a saved record.
- Pass the returned snapshot ID to the image-specific flow only after text save succeeds.
- Keep `buildPublicPassportSnapshotInput` unchanged.
- Keep demo and signed-out preview paths text-only.

### Private candidate helper — implemented

Add an owner-authenticated helper in `privateImageAssetData.ts` or a dedicated private module that:

- loads only candidates for the signed-in owner/current Equipment Passport;
- rejects demo/sample IDs and all target-photo sources;
- matches the current private cover binding;
- returns a narrow safe candidate view; and
- never logs or exposes the private binding data it inspects.

### Consent panel — implemented

Add a component such as `PublicPassportImageConsentPanel.tsx` that owns:

- the no-image/image choice;
- owner-only source preview state;
- checklist confirmations;
- alt-text validation;
- local selected/processing/success/failure state; and
- friendly bounded failure mapping.

It should receive only the current passport ID, a safe candidate view, the sanitized snapshot ID when available, and callbacks needed to save the text snapshot. Avoid passing `privateCoverPhotoKey` through component layers when the private helper/preview component can encapsulate it.

### Processor client wrapper — implemented

Add a narrow wrapper such as `processPublicPassportImageSelection` that accepts only:

```ts
{
  publicPassportSnapshotId: string;
  privateImageAssetId: string;
  altText?: string;
}
```

The wrapper should set `consentConfirmed: true` internally only after the consent panel calls it, force user-pool auth, return only bounded result fields, and translate transport failures to `unknown_error`. It must not expose a generic input escape hatch.

## Privacy, security, and accessibility requirements

- Records and original images remain private by default.
- Processing creates a separate derivative; it never changes or deletes the private original.
- Candidate and snapshot IDs are opaque selectors, not authorization. The backend revalidates them.
- Private keys, signed URLs, storage identities, filenames, and source record IDs never appear in processor variables or public models/pages.
- Public image projection fields remain backend-managed and absent from normal snapshot create/update payloads.
- Target photos remain excluded in candidate queries, UI copy, mutation wrappers, and backend processing.
- Checklist controls need associated labels, keyboard access, visible focus, and an error summary.
- Processing state should use an accessible live region without repeatedly announcing progress.
- The private preview requires private-safe descriptive text; its temporary URL must not be copied into alt text automatically.
- Long alt text and messages must wrap on mobile without horizontal scrolling.
- No consent checkbox may be prechecked, inferred from earlier text publication, or persisted across source changes.
- Older Public Preview and candidate requests must be ignored after auth, route, owner, or private-source dependencies change.
- Snapshot publish/unpublish and processor actions must use synchronous in-flight guards in addition to disabled button state so rapid repeated input cannot create concurrent mutations.
- Alt text must reject URI schemes and recognizable private/public storage paths using either slash style; none may be forwarded to the processor.

## Implementation phases

### Phase 2D.0: release-gate confirmation — manual validation pending

- Complete and record Phase 2C hosted success/adversarial tests.
- Confirm processor IAM, rollback, metadata stripping, and no-public-delivery boundaries.
- Decide whether Phase 2D remains development-gated until removal/unpublish cleanup exists.

### Phase 2D.1: private candidate presentation — implemented

- Add the narrow eligible-candidate helper.
- Add the owner-only card with **Publish without images** default.
- Add the private source preview and no-candidate/source-changed states.
- Do not invoke the processor yet.

### Phase 2D.2: consent and accessibility — implemented

- Add required safety acknowledgements.
- Add bounded public alt-text validation.
- Add keyboard, screen-reader, error-summary, mobile, and state-reset behavior.
- Confirm no sensitive values enter UI telemetry or browser-persisted state.

### Phase 2D.3: gated processor invocation — implemented

- Add the narrow user-pool mutation wrapper.
- Sequence text snapshot save before image processing.
- Add double-submit protection and bounded success/failure messages.
- Keep public rendering and public Storage delivery disabled.

### Phase 2D.4: lifecycle commands before general release — not implemented

- Add backend-controlled remove, replace, and unpublish cleanup.
- Test races between source replacement, visibility changes, processing, removal, and unpublish.
- Add orphan/superseded derivative reconciliation.

### Later public delivery/rendering phase

- Add narrowly scoped derivative delivery only after separate security review.
- Render only backend-ready projected derivatives, never private fallbacks.
- Add public-image reporting, moderator removal, caching, and signed-out privacy tests.

## Hosted manual acceptance checklist

### Default and empty states

- A signed-in owner sees **Publish without images** selected on every fresh visit.
- A user can publish/update sanitized text without candidate lookup or processing succeeding.
- No photo, unregistered photo, unverified photo, and stale replaced photo each show a safe no-eligible-image state.
- Demo, signed-out, and other-owner views expose no consent panel or candidate details.

### Candidate boundaries

- Only the current verified `equipment_cover` candidate is offered.
- Older cover candidates are not offered after replacement.
- `range_session_target` is never queried into the choice list or accepted by the wrapper.
- Modified candidate/snapshot IDs fail without revealing whether another owner's record exists.
- Changing routes, private sources, or auth accounts while candidate lookup is pending never allows an older response to populate the current owner UI.

### Consent

- Selecting an image performs no backend processing.
- Every checklist item and valid alt text is required by the selected UI policy.
- Changing/clearing the selection resets consent.
- The source preview must load before confirmation is enabled.
- Network inspection shows only the snapshot ID, candidate ID, bounded alt text, and required consent boolean.

### Outcomes

- First publication creates the sanitized snapshot before processor invocation.
- A text-save failure prevents processor invocation.
- An image failure after text success clearly says the setup is public without an image.
- Duplicate clicks create no concurrent client requests.
- A concurrent text publish/unpublish click cannot race the snapshot save performed for image processing.
- Bounded backend failures render only friendly messages.
- Success says the derivative is ready but not publicly displayed in Phase 2D.

### Public/private regression

- `buildPublicPassportSnapshotInput` still omits all image fields.
- Public Preview's sanitized output, Discover, public profiles, and public passport pages render no image and request no processor-only object.
- Public/API-key clients cannot read `PrivateImageAsset` or the derivative Storage prefix.
- Private pages still display the original private image normally.
- No private key, signed URL, filename, owner ID, source ID, alt text, or token appears in logs or friendly errors.

## Schema and deployment expectation

The first consent UI slice can use the current `processPublicPassportImage` action and existing models without a schema change. It must send the action's required `consentConfirmed: true` control flag after checklist completion.

Backend lifecycle work for removal/replacement/unpublish is intentionally separate and may require new custom actions and a backend redeploy. Public delivery and rendering also require a later Storage/backend change and separate release review.

The Phase 2D implementation changes owner-only frontend behavior and documentation. It does not change the schema, Lambda, IAM, Storage authorization, or public availability, so the backend does not require redeployment for this phase. Hosted Amplify must deploy the frontend before the consent UI can be tested there.
