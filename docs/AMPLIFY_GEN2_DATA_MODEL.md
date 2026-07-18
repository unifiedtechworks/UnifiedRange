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

Amplify owner-based authorization allows an owner to reassign an owner field unless that field is protected with field-level authorization. UnifiedRange protects owner-like fields with read/delete-only field-level owner rules so clients can keep reading owner identity fields without updating them after create.

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
