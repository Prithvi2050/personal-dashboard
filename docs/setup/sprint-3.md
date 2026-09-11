# Sprint 3: Settings and lightweight onboarding

## Apply the new migration

Sprint 2 must already be applied. In Supabase SQL Editor, review and run the complete contents of `supabase/migrations/202609110001_settings_onboarding.sql` once. Do not rerun the Sprint 2 migration.

This adds a nullable onboarding completion timestamp and the authenticated `save_user_settings` function. Existing rows and goal values are preserved. The function derives identity from `auth.uid()`, uses caller RLS, validates inputs, and updates the profile timezone and settings in one transaction. It has no user-ID parameter. Anonymous execution is revoked.

The migration has not been applied remotely by the coding agent. Until it is applied, reading existing settings can work, but saving will return a recoverable error.

## User workflow

- Home offers Quick setup while onboarding is incomplete.
- /onboarding shows calorie/protein goals, optional carbohydrate/fat goals, monthly budget, and timezone in one short form.
- Set up later returns to Home without writing anything; the reminder remains.
- Saving either Settings or onboarding records completion. Onboarding then returns to Home.
- /settings loads saved values and supports edits, clearing optional fields, pending/error/success feedback, and retry without losing form entries.
- Business, Technology, Finance remain fixed default categories. Gmail and food/utensil setup are explicitly deferred.

## Assumptions

Budget uses INR to match the existing app; multi-currency settings are out of scope. Goals are user-entered, with no recommended health values. Calorie and protein goals must be positive; budget and optional goals can be zero. Blank optional goals become NULL. Numeric values allow at most two decimal places and a technical maximum of one billion. Timezones are IANA names validated through Intl and PostgreSQL.

The profile and settings timezone are synchronized by the application save function. Direct administrative SQL writes can bypass that application workflow. Onboarding is optional and is offered through Home rather than forcing a login redirect. Saving existing settings also completes onboarding.

Home, Nutrition, Spending and Briefing metrics remain Sprint 1 fixtures. Saving preferences does not turn those fixtures into live calculations; their implementation belongs to later sprints.

## Verification

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

After applying the migration, manually verify:

1. Sign in and open Home > Quick setup; verify empty goals and current timezone.
2. Use Set up later; verify Home remains accessible and the reminder remains.
3. Save your own goals, budget, and timezone. Verify return to Home and reminder removal.
4. Open Settings, refresh, and confirm saved values persist.
5. Change the timezone and verify both public.users and public.user_settings have the same value.
6. Clear optional carbs/fat, save, and verify NULL values. Zero remains zero.
7. Confirm negative/invalid inputs are rejected; required goals cannot be blank.
8. Confirm onboarding_completed_at stays unchanged on subsequent saves and updated_at advances.
9. Sign out; /settings and /onboarding must require authentication.
10. Repeat the Sprint 2 RLS checks: another identity cannot read/update your records.

No live credentials or personal data should be added to test fixtures. Automated tests cover numeric validation, optional-value semantics, timezone handling, and rejection of caller-supplied identity fields. Live persistence and database transaction behavior require the manual migration and checks above.
