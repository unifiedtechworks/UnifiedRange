# Tech Stack Recommendation

## Recommended MVP Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Supabase Storage
- Vercel

## Why This Stack

### Next.js

Good for fast web app development, routing, server components, API routes, and eventual SEO-friendly public pages.

### TypeScript

Strong typing will help keep data models clean as the app expands from rifles to pistols and archery.

### Tailwind CSS

Fast UI styling and responsive layout.

### Supabase

Provides authentication, PostgreSQL database, file storage, and Row Level Security.

### Vercel

Simple deployment for a Next.js app.

## Architecture Direction

Start as a web app.

Later, build a mobile app with Expo/React Native using the same Supabase backend.

## Suggested App Structure

```txt
src/
  app/
    dashboard/
    passports/
    projectiles/
    optics/
    sessions/
    maintenance/
    readiness/
    discover/
    settings/
  components/
  lib/
  types/
  data/
  styles/
```

## First Implementation Principle

Build the UI with mock data first.

After screens and data models feel right, wire up Supabase auth, database tables, Row Level Security, and storage.
