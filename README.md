# Personal Dashboard

Sprint 12 adds opt-in India/global news sources and a manual, metadata-only Briefing inbox. Apply the new migration and follow [Sprint 12 setup](docs/setup/sprint-12.md). This is not yet the curated, summarized daily briefing; that remains Sprint 13.

Spending now supports a shared two-member household, multi-PDF upload, combined review/confirmation, calendar-month expenses, and audited corrections. Initial parsers cover SBI bank, SBI Card and Axis Card; PDFs are not permanently stored. Apply the new migration and follow [household statement setup](docs/setup/household-statements.md). HDFC/ICICI support is pending samples. The synthetic sandbox remains separate; Gmail is optional/deferred.

Sprint 9 adds a separate Gmail connection, approved sender controls and a manual metadata-only connection check. It does not yet import transactions. Follow [Sprint 9 setup](docs/setup/sprint-9.md) for the new migration, separate Google Cloud project and encrypted-token configuration. Existing Google sign-in is unchanged.

Sprint 8 adds a seven-day nutrition overview with logged totals, averages and current-goal context. No additional migration is required. See [Sprint 8 setup and weighed-meal QA](docs/setup/sprint-8.md) for acceptance checks and remaining real-world validation.

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
- `/spending/review` — Sprint 10 synthetic transaction sandbox (not real spending)
- `/briefing`
- `/settings`
- `/onboarding` — optional first-time setup

## Specification

The implementation handoff is in the adjacent workspace folder `outputs/personal-dashboard-spec`. The documents used for this repository are indexed in `docs/spec/README.md`.

## Authentication and database setup

Sprint 10 adds fixture-only transaction extraction, duplicate prevention, merchant rules and corrections. Apply its migration manually and follow [Sprint 10 setup and acceptance checks](docs/setup/sprint-10.md). It makes no Gmail/AI calls; the deferred Gmail connection issue is not resolved by this sprint. Real Spending dashboard integration remains Sprint 11.

Sprint 2 uses Supabase for PostgreSQL and Google sign-in. Follow `docs/setup/supabase.md` to create the external project, apply the migration, and add local credentials. Protected routes require sign-in; `/sign-in` explains missing configuration.

For Sprint 3, apply the additional migration and follow the verification steps in [the settings setup guide](docs/setup/sprint-3.md). No remote migrations are run automatically.

Sprint 4 adds a daily Nutrition journal with saved goals, timezone-aware date navigation, and an explicit sample-meal preview. No new migration is required. See [Sprint 4 behavior and checks](docs/setup/sprint-4.md). Real meal logging and persistent meal history remain later-sprint work.

Sprint 5 adds the private food/utensil library at /settings/library, reference photo uploads, and food-specific full-serving weights. Apply its migration before use; see [Sprint 5 setup and acceptance checks](docs/setup/sprint-5.md).

The food library now supports USDA search and one-click saving with automatic per-100-g calories/macros. Add a server-only `USDA_API_KEY` and follow [food search setup and checks](docs/setup/food-search.md). Food search itself needs no additional migration. Utensil photos, dimensions, and food-specific calibrations are preserved.

Sprint 6 adds real quick meal logging and saved daily Nutrition totals. Choose saved foods, calibrated utensil fractions or exact quantities, review, and save. Apply the new quick-meals migration before opening Nutrition; see [Sprint 6 setup and acceptance checks](docs/setup/sprint-6.md). Existing utensil photos/calibrations are preserved. Photo analysis remains Sprint 7; Home snapshots and advanced history remain later work.

Sprint 7 adds private meal-photo upload, OpenAI food/portion suggestions using selected utensil references, confidence-aware review, and atomic confirmed saving. It requires its migration plus server-only OpenAI configuration; follow [Sprint 7 setup](docs/setup/sprint-7.md). Quick logging remains available. Live photo accuracy and end-to-end behavior require manual acceptance after setup.
