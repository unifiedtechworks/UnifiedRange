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
- HuntingChecklistItem

Each private model should include an owner identity field tied to Cognito. AppSync authorization should restrict read and write access to the owner.

## Public Discovery Models

- PublicPassportSnapshot
- PublicRangeSessionSummary
- PublicTargetPhotoPlaceholder
- Comment
- Reaction
- Report

PublicPassportSnapshot should be generated from private records through a sanitization workflow. It should duplicate safe public fields instead of joining directly to private records.

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
