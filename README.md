# Personal Dashboard

A personal web application that brings nutrition tracking, automated spending analysis, and a concise daily news briefing into one calm workspace.

## MVP

- **Home:** yesterday's nutrition and spending snapshot, today's briefing, and one insight
- **Nutrition:** meal logging, calibrated utensils, calories/macros, and seven-day history
- **Spending:** approved financial-email ingestion, categorization, corrections, and six-month analytics
- **Briefing:** five Business, five Technology, and five Finance stories with source links
- **Settings:** goals, integrations, trusted sources, foods, and utensils

Sprint 0 contains only the project foundation and placeholder routes. It intentionally has no database, authentication, AI, Gmail, news integration, jobs, or polished product UI.

## Stack

- Next.js and React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Supabase PostgreSQL and Google authentication

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Routes

- `/` — Home
- `/nutrition`
- `/spending`
- `/briefing`
- `/settings`

## Specification

The implementation handoff is in the adjacent workspace folder `outputs/personal-dashboard-spec`. The documents used for this repository are indexed in `docs/spec/README.md`.

## Authentication and database setup

Sprint 2 uses Supabase for PostgreSQL and Google sign-in. Follow `docs/setup/supabase.md` to create the external project, apply the migration, and add local credentials. Until those values are configured, the dashboard remains available in setup-preview mode and `/sign-in` explains what is missing.
