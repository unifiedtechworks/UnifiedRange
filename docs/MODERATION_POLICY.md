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
- Cognito `admin` and `moderator` group members can update report workflow status only. Normal users cannot update reports.
- Status changes do not delete, hide, suspend, or mutate reported content.
- Phase 2G.1 reserves a `public_image` report target and a backend-only immutable image-generation binding. There is no supported public-image report command/button yet; a directly created unbound row is non-actionable.
- The public-image ledger now has a separate client-nonwritable `clear | hidden | removed` moderation state. The delivery resolver returns generic unavailable for blocked or unknown states, while a temporary missing-state compatibility path supports pre-2G.1 rows until controlled backfill.
- Public-image review UI and moderator/admin image actions remain unimplemented. Moderators do not receive broad ledger or private-original access. Their planned safe projection, immutable-generation checks, private-original preservation, and audited actions are documented in the [Phase 2G Public Image Moderation Plan](PUBLIC_IMAGE_PHASE_2G_MODERATION_PLAN.md).
- Public social features must not expose private passport fields, private images, owner private details, marketplace activity, or direct messaging.

## Admin Review States

- Current stored statuses: `open`, `reviewed`, `dismissed`, `action_needed`.
- Missing or `open` status counts as pending in the moderation UI.
- Report metadata other than `status` remains immutable to moderators through field-level authorization.
- Destructive content actions, warnings, and suspensions require separate future workflows and are not implied by report status.

## Default Public Safety Behavior

- Private by default
- No exact GPS sharing by default
- Strip photo EXIF metadata
- Hide serial numbers
- Hide private notes
- Hide purchase records
- Hide sensitive maintenance notes
