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
