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
5. Keep private source records owner-scoped.
6. Later, run Lambda sanitization workflow for images before any public image is created.
7. Later, strip image metadata, including EXIF GPS/device metadata, before public image release.
8. Later, copy only sanitized derivatives into public discovery storage.

The current public publishing slice publishes sanitized text/setup data only. It does not publish images, expose public image access, or strip metadata yet.

## Moderation Placeholders

Reports should support reasons for unsafe weapon content, illegal hunting / poaching, personal information, harassment or threat, sales or marketplace activity, and other.

## Safety Boundary

Public pages are for setup discovery and range-log sharing. They must stay focused on sanitized documentation and community setup context.
