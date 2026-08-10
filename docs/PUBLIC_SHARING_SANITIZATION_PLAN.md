# Public Sharing Sanitization Plan

## Purpose

Public sharing should help users discover real-world setups while protecting private records and avoiding unsafe product behavior.

## Allowed Public Fields

- Equipment type
- Nickname or public title
- Manufacturer and model
- Caliber or category
- Optic / sight summary
- Projectile / ammo summary
- Use case tags
- Public notes
- Public range-session summaries marked shareable
- Public target photo placeholders or sanitized public images

## Excluded Fields

- Private notes
- Serial numbers if added later
- Lot numbers
- Purchase records and private inventory details
- Exact home, range, or hunting locations
- Private target photos
- Private maintenance notes
- Image metadata and EXIF data
- Owner private profile details
- Personal documents or sensitive personal info

## Intended Publish Flow

1. Generate sanitized preview from private records.
2. Show hidden-field and public-field lists.
3. Require user confirmation.
4. Save sanitized text/setup fields to `PublicPassportSnapshot`.

Public user pages use a separate `PublicUserProfileSnapshot`, keyed by normalized immutable username. It contains only username, public display name, public bio, and account visibility. It must not broaden `UserProfile` reads or copy email, first/last name, city/state, private settings, private activity, or image data. When an account is private, display name and bio are cleared from the public snapshot rather than merely hidden in the UI.

Public setup cards, details, and comments may resolve their owner/author through this sanitized snapshot. If resolution fails or the account is private, show `UnifiedRange user`; never render raw Cognito IDs as public identity.
5. Keep private source records owner-scoped.
6. Later, run Lambda sanitization workflow for images before any public image is created.
7. Later, strip image metadata, including EXIF GPS/device metadata, before public image release.
8. Later, copy only sanitized derivatives into public discovery storage.

The current app publishing slice publishes sanitized text/setup data only. Phase 1 reserves guarded public-image projection fields and a non-public workflow ledger. Phase 2A adds owner-only private source candidates, and Phase 2B can verify their owner/source/S3 binding through a trusted IAM action. Phase 2C adds a separately authenticated backend action that can revalidate an explicitly consented, verified Equipment Passport cover, decode and re-encode it without source metadata, and populate guarded derivative projections. No client calls that action; the processor-only object namespace has no public delivery rule; and public UI continues to omit image projections and every private key. Verification and normal Public Preview publishing do not publish an image.

## Moderation Placeholders

Reports should support reasons for unsafe weapon content, illegal hunting / poaching, personal information, harassment or threat, sales or marketplace activity, and other.

## Public Social Slice

- Public passport detail pages can show reaction counts for signed-out and signed-in visitors.
- Signed-in users can add or remove reactions, add comments, and submit reports.
- Comments and reactions are scoped to sanitized `PublicPassportSnapshot` records.
- Comment reports target the comment record, while public passport reports target the public snapshot.
- This slice does not publish private S3 images, add direct messages, add marketplace features, or expose owner private details.

## Safety Boundary

Public pages are for setup discovery and range-log sharing. They must stay focused on sanitized documentation and community setup context.
