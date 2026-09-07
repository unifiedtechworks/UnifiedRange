# Moderation Policy

## Purpose

UnifiedRange should support responsible sporting, range, and hunting communities while avoiding harmful or illegal use.

## Disallowed Content

Remove or restrict content involving:

- Threats or intimidation
- Harassment
- Hate or extremist content
- Doxxing
- Exact home locations
- Public serial numbers
- Tactical targeting advice
- Illegal hunting or poaching
- Instructions to manufacture firearms
- Instructions to manufacture ammunition
- Instructions to manufacture explosives
- Restricted accessory manufacturing
- Unsafe reloading recommendations
- Direct firearm or ammunition sales
- Evading laws or app rules

## User Reporting

Users should be able to report:

- Public passports
- Public photos
- Comments
- User profiles
- Range reports

Report reasons:

- Threat or harm
- Illegal hunting
- Unsafe weapon content
- Personal information
- Harassment
- Sales or marketplace activity
- Other

## Current MVP Implementation

- Signed-in users can report sanitized public passport snapshots and comments.
- Cognito `admin` and `moderator` group members can review report metadata at `/moderation/reports`.
- Normal signed-in users cannot access moderation tools.
- Signed-out users can view public setup pages but must sign in before reporting.
- Cognito `admin` and `moderator` group members can update only the report workflow status on `Report`. Normal users cannot update reports.
- Status changes do not delete, hide, suspend, or mutate reported content. Public-image availability uses a separate action and state machine.
- Phase 2G.1 reserves a `public_image` report target and a backend-only immutable image-generation binding. Phase 2G.2 adds **Report image** only beside a successfully loaded derivative on saved Public Passport detail. Signed-in users submit an allow-listed reason and bounded optional details against the safe public snapshot id; signed-out visitors receive a sign-in prompt.
- Phase 2G.2 intentionally does not expose an asset id or add a trusted binding command, so these initial reports have no immutable-generation binding. Report submission never automatically hides or removes an image.
- The public-image ledger now has a separate client-nonwritable `clear | hidden | removed` moderation state. The delivery resolver returns generic unavailable for blocked or unknown states, while a temporary missing-state compatibility path supports pre-2G.1 rows until controlled backfill.
- Phase 2G.3 gives `admin`/`moderator` users a distinct public-image report card with the public snapshot reference, safe report/reporter metadata, status workflow, and a link to the current sanitized public setup. Moderation does not embed the image, call the public image resolver, or read the public/private image ledgers.
- Phase 2G.4 adds a separate `admin`/`moderator` action for the current processed derivative attached to a public snapshot. The client supplies only the public snapshot id, `hide | remove`, and an optional bounded owner-safe reason; the backend derives the current asset and canonical public object. Hide detaches delivery and marks the asset hidden. Remove detaches first, marks it removed, and deletes only the processed public derivative. Both preserve the private original and sanitized public text/setup.
- The Phase 2G.4 control is current-snapshot scoped, not proof of the generation originally reported. Reviewers must freshly inspect the linked public setup before confirming. Trusted report-generation binding, exact-generation moderator preview, cross-generation holds, notifications, and append-only audit remain planned in the [Phase 2G Public Image Moderation Plan](PUBLIC_IMAGE_PHASE_2G_MODERATION_PLAN.md).
- Hide intentionally preserves the processed derivative while revoking all new public delivery. If its sanitized snapshot is later unpublished before moderator Remove, the current action fails closed rather than guessing a detached generation; protected orphan reconciliation is required for later object deletion. The private original remains unchanged throughout.
- Public social features must not expose private passport fields, private images, owner private details, marketplace activity, or direct messaging.

## Admin Review States

- Current stored statuses: `open`, `reviewed`, `dismissed`, `action_needed`.
- Missing or `open` status counts as pending in the moderation UI.
- Report metadata other than `status` remains immutable to moderators through field-level authorization.
- Public-image review links open only the same sanitized Public Passport detail route available to public visitors; they are not privileged image-delivery links.
- Public-image actions never silently change report status. `cleanup_pending` may warrant an explicit `action_needed` workflow choice, but the user chooses it separately.
- Destructive public-text/content actions, warnings, suspensions, and account actions require separate future workflows and are not implied by either report status or derivative moderation.

## Default Public Safety Behavior

- Private by default
- No exact GPS sharing by default
- Strip photo EXIF metadata
- Hide serial numbers
- Hide private notes
- Hide purchase records
- Hide sensitive maintenance notes
