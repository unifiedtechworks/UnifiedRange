# First Prompt for Codex

You are building the MVP for UnifiedRange.

UnifiedRange is a privacy-first range logbook, setup passport, hunting readiness, and setup discovery app for target shooters, hunters, and future archery users.

Before coding, read:

- `README.md`
- `docs/PRODUCT_VISION.md`
- `docs/MVP_SCOPE.md`
- `docs/SAFETY_AND_COMPLIANCE_BOUNDARIES.md`
- `docs/DATA_MODEL.md`
- `tasks/001-project-bootstrap.md`

Important safety boundary:
Do not implement ballistic firing solutions, scope adjustment calculators, holdover outputs, wind hold recommendations, zeroing instructions, or any feature that tells a user how to aim or adjust a firearm.

Build the initial Next.js + TypeScript + Tailwind app structure.

Tasks:
1. Initialize the app if it does not exist yet.
2. Create the base app layout with a clean dashboard.
3. Add navigation for:
   - Dashboard
   - Equipment Passports
   - Projectiles / Ammo
   - Optics / Sights
   - Range Sessions
   - Maintenance
   - Hunting Readiness
   - Discover
   - Settings
4. Create TypeScript types for the main data models in `src/types`.
5. Create mock data in `src/data`.
6. Build basic list/detail screens using mock data.
7. Make the UI responsive and mobile-friendly.
8. Update `README.md` with run instructions.
9. Add comments/TODOs where AWS Amplify, Cognito, AppSync, DynamoDB, S3, and Lambda integration will be added later.
10. Keep product language focused on logging, documentation, readiness, and setup discovery.

Do not add any ballistic calculator or aiming-correction functionality.
