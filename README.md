# UnifiedRange

UnifiedRange is a privacy-first range logbook, setup passport, and outdoor readiness app for target shooters, hunters, and later archery users.

The product is centered on:

- Setup documentation
- Range-session logging
- Target photo history
- Ammo and gear tracking
- Maintenance records
- Hunting readiness
- Optional public setup discovery
- Community knowledge around real-world setups

## Important Safety Boundary

UnifiedRange is **not** a firing-solution calculator.

The app must not provide:

- Scope adjustment instructions
- Holdover/hold-under recommendations
- Wind hold recommendations
- Live shot guidance
- Zeroing instructions
- Tactical targeting guidance
- Instructions for manufacturing firearms, ammunition, explosives, or restricted accessories

The app may store user-entered logs, setup details, target photos, range notes, and historical performance records.

## Suggested MVP Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase for auth/database/storage
- PostgreSQL
- Row Level Security
- Vercel deployment

A mobile app can come later using Expo/React Native against the same backend.

## Local Development

Install dependencies and run the Next.js development server:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run build
```

## MVP App Structure

The initial web app uses:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Mock data in `src/data`
- Domain types in `src/types`
- Responsive app navigation for dashboard, passports, projectiles/ammo, optics/sights, range sessions, maintenance, hunting readiness, discovery, and settings

Supabase integration is intentionally left as TODOs for a later task. Private records, target photo storage, row-level security, and sanitized public setup snapshots should be implemented at the data boundary before replacing mock data.

## Project Docs

Start here:

1. `docs/PRODUCT_VISION.md`
2. `docs/MVP_SCOPE.md`
3. `docs/SAFETY_AND_COMPLIANCE_BOUNDARIES.md`
4. `docs/DATA_MODEL.md`
5. `docs/USER_FLOWS.md`
6. `docs/SOCIAL_FEATURES.md`
7. `docs/MODERATION_POLICY.md`
8. `tasks/001-project-bootstrap.md`
