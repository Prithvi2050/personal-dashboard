# Personal Dashboard

A personal web application that brings nutrition tracking, automated spending analysis, and a concise daily news briefing into one calm workspace.

## MVP

- **Home:** yesterday's nutrition and spending snapshot, today's briefing, and one insight
- **Nutrition:** meal logging, calibrated utensils, calories/macros, and seven-day history
- **Spending:** approved financial-email ingestion, categorization, corrections, and six-month analytics
- **Briefing:** five Business, five Technology, and five Finance stories with source links
- **Settings:** goals, integrations, trusted sources, foods, and utensils

Sprints 0–2 provide the app shell and Supabase Google authentication. Sprint 3 adds saved preferences and optional onboarding. Dashboard metrics remain demonstration data until their later feature sprints.

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
pnpm test
pnpm build
```

## Routes

- `/` — Home
- `/nutrition`
- `/spending`
- `/briefing`
- `/settings`
- `/onboarding` — optional first-time setup

## Specification

The implementation handoff is in the adjacent workspace folder `outputs/personal-dashboard-spec`. The documents used for this repository are indexed in `docs/spec/README.md`.

## Authentication and database setup

Sprint 2 uses Supabase for PostgreSQL and Google sign-in. Follow `docs/setup/supabase.md` to create the external project, apply the migration, and add local credentials. Protected routes require sign-in; `/sign-in` explains missing configuration.

For Sprint 3, apply the additional migration and follow the verification steps in [the settings setup guide](docs/setup/sprint-3.md). No remote migrations are run automatically.

Sprint 4 adds a daily Nutrition journal with saved goals, timezone-aware date navigation, and an explicit sample-meal preview. No new migration is required. See [Sprint 4 behavior and checks](docs/setup/sprint-4.md). Real meal logging and persistent meal history remain later-sprint work.
