# Amplify Gen 2 Data Model Plan

## Private Owner-Scoped Models

- UserProfile
- EquipmentPassport
- ProjectileProfile
- OpticSightProfile
- RangeSession
- TargetPhoto
- MaintenanceLogEntry
- HuntingChecklist

Each private model should include an `ownerId` identity field tied to Cognito. AppSync authorization should use `allow.ownerDefinedIn("ownerId")` or the model-specific owner field so private reads and writes stay scoped to the signed-in owner.

## Owner Field Reassignment Guard

Amplify owner-based authorization allows an owner to reassign an owner field unless that field is protected with field-level authorization. UnifiedRange protects owner-like fields with create/read/delete field-level owner rules so clients can set owner identity fields during create and keep reading them later without updating them after create.

Protected owner-like fields:

- `UserProfile.ownerId`
- `EquipmentPassport.ownerId`
- `ProjectileProfile.ownerId`
- `OpticSightProfile.ownerId`
- `RangeSession.ownerId`
- `TargetPhoto.ownerId`
- `MaintenanceLogEntry.ownerId`
- `HuntingChecklist.ownerId`
- `PublicPassportSnapshot.ownerId`
- `Comment.authorId`
- `Reaction.userId`
- `Report.reporterId`

`UserProfile.username` is collected during setup and treated as immutable in the frontend after creation. Username uniqueness is checked through a separate reservation model so private profiles do not need to be globally queryable.

`UsernameReservation` stores normalized username claims separately from private `UserProfile` records. The reservation record uses the normalized username as its record id for an MVP uniqueness guard, stores no profile details, and is created before profile setup writes the username. Existing profiles can create a matching reservation when loaded; conflicts require manual/admin resolution.

`UserProfile.nameLastChangedAt` supports a lightweight client-side monthly limit for first and last name edits. This is a UX guard only; use a server-side workflow if stronger enforcement becomes necessary.

User privacy and account defaults are stored on `UserProfile` so they remain owner-scoped account data. Defaults should stay private-first: account visibility and default passport visibility default to private, public preview is required before publishing, and public-sharing sanitization should hide exact locations, ammo lot numbers, purchase details, private notes, and image metadata.

Public read exceptions remain intentionally narrow:

- `PublicPassportSnapshot` can be read with API key for sanitized discovery.
- `Reaction` can be read with API key so public pages can show public-safe reaction counts.

Private records remain owner-scoped and should not expose private notes, private image keys, lot numbers, purchase details, exact locations, maintenance records, readiness records, or owner private profile details through public flows.

## Public Discovery Models

- PublicPassportSnapshot
- PublicRangeSessionSummary
- PublicTargetPhotoPlaceholder
- Comment
- Reaction
- Report

PublicPassportSnapshot should be generated from private records through a sanitization workflow. It should duplicate safe public fields instead of joining directly to private records.

Comments and reactions can be readable to signed-in users for community workflows, but create/update/delete access should remain scoped to the author. Reports should stay scoped to the reporter until an admin/moderation workflow exists.

## DynamoDB Access Patterns

- List user Equipment Passports by owner.
- Read a single private passport by owner and id.
- List Range Sessions by owner and equipmentPassportId.
- List Maintenance records by owner and equipmentPassportId.
- List Hunting Readiness checklists by owner.
- List Public Passport snapshots by filters such as equipment type, category, manufacturer, use case tags, and beginner-friendly tags.
- Read public snapshot detail by public id.

## Notes

Private notes, lot numbers, purchase details, exact locations, maintenance details, and image metadata must not be copied into public records.

Run this local validation before deploying a sandbox:

```bash
npm run amplify:typecheck
```

Run the local sandbox only after AWS credentials are configured:

```bash
npm run amplify:sandbox
```
