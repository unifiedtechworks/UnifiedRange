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
- Public-image-specific reports and moderator/admin image actions are not implemented. Their proposed privacy, immutable-generation binding, and private-original preservation rules are documented in the [Phase 2G Public Image Moderation Plan](PUBLIC_IMAGE_PHASE_2G_MODERATION_PLAN.md).
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
