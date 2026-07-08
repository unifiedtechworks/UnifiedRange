# Task 002: Data Model Types

## Goal

Create strong TypeScript models for the MVP entities.

## Entities

- UserProfile
- EquipmentPassport
- ProjectileProfile
- OpticSightProfile
- RangeSession
- TargetPhoto
- MaintenanceLogEntry
- HuntingChecklist
- PublicPassportSnapshot
- Comment
- Reaction
- Report

## Requirements

1. Put shared types in `src/types`.
2. Use broad equipment naming so the app can support rifles, pistols, bows, and crossbows later.
3. Add mock data for each major entity.
4. Ensure no model implies firing solutions or aiming corrections.

## Acceptance Criteria

- Types compile.
- Mock data renders on existing screens.
- Models are documented enough for future Amplify Gen 2, AppSync, and DynamoDB schema planning.
