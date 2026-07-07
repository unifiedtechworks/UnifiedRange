# Task 001: Project Bootstrap

## Goal

Create the initial UnifiedRange web app using Next.js, TypeScript, and Tailwind CSS.

## Safety Boundary

Do not implement ballistic calculators, scope adjustment outputs, holdover recommendations, wind corrections, zeroing instructions, or tactical targeting guidance.

## Requirements

1. Initialize a Next.js app in this repository.
2. Use TypeScript.
3. Use Tailwind CSS.
4. Create a clean responsive app shell.
5. Add navigation for:
   - Dashboard
   - Equipment Passports
   - Projectiles / Ammo
   - Optics / Sights
   - Range Sessions
   - Maintenance
   - Hunting Readiness
   - Discover
   - Settings
6. Add mock TypeScript types in `src/types`.
7. Add mock data in `src/data`.
8. Create simple list/detail screens using mock data.
9. Add TODO comments for future Supabase integration.
10. Update README with local run instructions.

## Suggested Screens

- `/`
- `/dashboard`
- `/passports`
- `/passports/[id]`
- `/projectiles`
- `/optics`
- `/sessions`
- `/sessions/[id]`
- `/maintenance`
- `/readiness`
- `/discover`
- `/settings`

## Acceptance Criteria

- App runs locally.
- Navigation works.
- Pages render mock data.
- No ballistic calculator or aiming-correction functionality exists.
- Product copy uses logging, setup, readiness, and discovery language.
