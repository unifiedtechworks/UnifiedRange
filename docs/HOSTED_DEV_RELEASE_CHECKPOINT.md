# Hosted Dev Release Checkpoint

Checkpoint date: August 3, 2026

UnifiedRange is deployed as an AWS Amplify Gen 2 hosted-development MVP. This checkpoint records the current product surface after the full-site UX polish pass. It is a documentation snapshot only and does not introduce application or schema changes.

## Current Capabilities

### Accounts and identity

- Amazon Cognito email/password sign-up, confirmation, sign-in, and sign-out.
- Required owner-only profile setup before saved account workflows.
- Immutable app-level usernames with global `UsernameReservation` enforcement.
- Safe conflict diagnostics and an owner-facing repair flow for legacy accounts whose profile username is owned by another reservation.
- Private profile hub, profile editing, privacy settings, and account settings.

### Private records and images

- Owner-scoped Equipment Passport create, view, edit, and delete workflows.
- Owner-scoped Projectile / Ammo and Optics / Sights records.
- Owner-scoped Range Sessions linked to saved equipment, projectile, and sight records.
- Owner-scoped Maintenance and Hunting Readiness records linked to saved Equipment Passports.
- Private S3 Equipment Passport photos and Range Session target photos.
- Private records, notes, image keys, images, lot numbers, purchase details, and exact locations are not included on public pages.

### Public sharing and discovery

- Sanitized `PublicPassportSnapshot` preview, publish, update, view, and unpublish workflows.
- Public profiles at `/u/[username]` using limited public profile snapshots and immutable usernames.
- Public account visibility controls, safe missing/private states, public setup counts, and published setup lists.
- Discover browsing with client-side search and filters.
- Public setup detail pages use sanitized snapshot fields and safe owner fallbacks rather than raw Cognito identifiers.
- Eligible processed Equipment Passport cover derivatives may render only on saved Public Passport detail through the short-lived resolver.
- Private originals are not published through public profiles, Discover, or Public Passport snapshots; profile/Discover cards and all target-photo surfaces remain image-free.

### Community and moderation

- Reactions, comments, and reports on published Public Passport snapshots.
- Safe public username/display-name resolution for comments where a public identity exists.
- Cognito `admin` and `moderator` group-gated moderation navigation and report review.
- Friendly reporter identity display with a technical internal ID retained for moderator traceability.
- Report workflow statuses: `open`, `reviewed`, `dismissed`, and `action_needed`.
- Moderators can update report status only; status changes do not delete, hide, suspend, or mutate reported content.
- Missing or `open` reports count as pending.

### Account lifecycle placeholders

- Account settings explain the planned data-export and account-deletion lifecycle.
- Export and deletion controls are visibly unavailable and do not perform destructive actions.
- Planning documents define privacy, retention, confirmation, and backend-workflow requirements for later implementation.

### Onboarding checklist

- Signed-in users see a helpful onboarding checklist on Dashboard and Profile; signed-out visitors continue to see public and sample experiences only.
- Nine completion milestones are derived from the existing profile, privacy settings, private record counts, private photo records, and public snapshots. No onboarding model is required.
- Discover remains a link-only tenth step and is intentionally not tracked.
- The checklist emphasizes that records and photos are private by default, sanitized publishing is optional, and private photos are never public.
- Mostly complete checklists collapse automatically and can be expanded again at any time.

## Hosted Smoke Test Checklist

Run this checklist against the current Amplify Hosting development URL after each release:

Use the role-based [Manual QA Checklist](MANUAL_QA_CHECKLIST.md) for the comprehensive release pass, including CRUD isolation, username conflict repair, Phase 2B private source verification, the Phase 2C derivative processor, Phase 2D owner consent, moderation authorization, responsive coverage, and public/private response inspection.

1. Open `/` while signed out. Confirm the landing page explains the private logbook, Equipment Passports, Hunting Readiness, Discover, and privacy-first sharing.
2. Open `/auth/sign-in`. Test sign-up/confirmation with a test account or sign in with an existing test account, refresh, and confirm the session persists.
3. For a new test account, complete `/profile/setup`. Confirm the username is normalized, reserved, and read-only afterward.
4. Open `/profile`, `/profile/edit`, `/settings`, and `/settings/privacy`. Confirm owner-only profile and privacy changes persist after refresh.
5. While signed in, confirm Dashboard and Profile show the onboarding checklist with nine derived milestones and an untracked Discover link. Create a test record and confirm progress updates; sign out and confirm the checklist is absent.
6. If a legacy username-conflict fixture is available, confirm `/profile/username-repair` permits only the conflicted owner to reserve an available replacement username and never changes the existing owner's reservation.
7. Create, view, edit, and delete a test record in Equipment Passports, Projectiles / Ammo, Optics / Sights, Range Sessions, Maintenance, and Hunting Readiness. Confirm records remain scoped to the signed-in owner.
8. Upload an Equipment Passport photo and Range Session target photo. Refresh, then sign out and confirm private images, image keys, and upload controls are not exposed publicly.
9. Preview and publish a sanitized Equipment Passport snapshot. Confirm **Publish without images** is the default. With a disposable verified JPEG/PNG equipment cover, test the optional consent flow and confirm only saved Public Passport detail renders the eligible processed derivative. Use a text-only snapshot for the current unpublish test.
10. Open `/u/[username]` while signed out. Confirm the public profile respects account visibility and shows only sanitized identity and published setup activity.
11. Test Discover search and filters on desktop and mobile. Open a public setup and confirm private notes, private images, lot numbers, purchase details, exact locations, and raw owner IDs are absent.
12. While signed in, add and remove a reaction, submit a test comment, and submit a test report. While signed out, confirm public content remains readable and write actions show sign-in prompts.
13. Sign in as an `admin` or `moderator`. Confirm Moderation navigation appears, `/moderation/reports` loads metadata only, pending counts are correct, and all supported report statuses persist after refresh.
14. Sign in as a normal user and confirm Moderation navigation is hidden and moderation routes do not expose report data or status actions.
15. Open `/settings/account`. Confirm export and deletion remain disabled placeholders and no destructive account action is available.
16. Complete a desktop, tablet, and mobile sweep. Confirm navigation remains usable, long content wraps, forms fit the viewport, and pages do not introduce unintended horizontal scrolling.
17. Sign out and confirm `/profile` and private workflows show appropriate sign-in prompts while public profiles and Discover continue to work.

## Known Limitations

- Account deletion and account data export are planned but not implemented.
- Public image rendering is limited to eligible processed Equipment Passport covers on saved Public Passport detail. Uploaded originals remain private, and Discover/profile cards and target photos remain image-free. There is no direct public Storage rule, replacement/removal/unpublish cleanup, or image-moderation lifecycle. See the [Public Image Publishing Plan](PUBLIC_IMAGE_PUBLISHING_PLAN.md).
- Feeds and follows are not implemented.
- A notification center is not implemented.
- Moderation has report metadata review and status workflow only. It has no destructive content removal, hiding, suspension, or account actions.
- Username sign-in is planned but not implemented. Current Cognito login remains email/password; any future username lookup must not expose account email addresses.
- Public profiles and Discover intentionally expose a limited sanitized view rather than private `UserProfile` or owner-scoped records.

## Next Roadmap Options

1. Implement protected account data export and account deletion workflows based on the existing lifecycle plans.
2. Polish public profiles with improved safe empty states, presentation, and published-setup organization.
3. Complete hosted Phase 2D consent testing, then design the public delivery boundary, rendering, removal/unpublish lifecycle, image reporting/moderation, cache behavior, and cleanup described in the Public Image Publishing Plan.
4. Add moderation report counts by status and target, plus filtering and sorting, without coupling status changes to destructive content actions.
5. Improve Discover search, filters, result organization, and public setup browsing while preserving sanitized snapshot boundaries.
6. Implement username sign-in only through the privacy-preserving server-side lookup described in the Username Sign-In Plan; email/password remains the current Cognito login.

## Release Boundary

This checkpoint does not add schema changes or new features. UnifiedRange remains a privacy-first recordkeeping, readiness, and sanitized setup-discovery product. It does not provide ballistic calculators, scope outputs, hold recommendations, field corrections, sight-in instructions, or instructions for adjusting or aiming equipment.
