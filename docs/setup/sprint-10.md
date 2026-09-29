# Sprint 10 — Synthetic transaction pipeline

## Scope and status

This is a fixture-only implementation of extraction, normalization, categorization, duplicate prevention, corrections, and reusable merchant rules. It does not read Gmail, call AI, or process real financial messages. Sprint 9's live Gmail OAuth issue remains deferred, not resolved. The Spending dashboard remains sample UI until Sprint 11.

No new environment variables or dependencies are required. Existing Supabase login must work. Gmail credentials are not needed for this sandbox.

## Manual database setup

1. Open your existing Supabase project → SQL Editor → New query.
2. Copy the complete contents of `supabase/migrations/202609180001_fixture_transactions.sql` into the editor.
3. Run it once. “Success. No rows returned” is expected. This migration requires the Sprint 2 `public.users` table and Supabase authentication roles. Do not rerun a migration that already succeeded.
4. Confirm the `transactions`, `merchant_rules`, and `transaction_corrections` tables exist with RLS enabled. Do not disable RLS or expose service-role credentials.
5. Use the existing development server at http://localhost:3000. If none is running, start `pnpm dev` from the app folder. Do not start a second server on another port.

The migration has not been applied to your remote project by this implementation.

## Acceptance walkthrough

1. Sign in and open Spending → **Open synthetic transaction review**, or `/spending/review`.
2. Select **Initial examples**, explicitly approve `alerts@fixture-bank.example` for this fixture import, and import.
3. Expect **3 added, 1 duplicate skipped, 3 rejected**. The invented cafe and market use INR; the unknown studio uses USD and falls back to Other. Currencies are never combined into one total.
4. Repeat the initial import. Expect **0 added, 4 duplicates skipped, 3 rejected**; still 3 records.
5. Expand the cafe's correction form. Change its displayed merchant and category, optionally edit date/time (explicitly UTC), short account label, or short description. Check **Remember this merchant and category** and save.
6. Expand its original extraction: the original values remain unchanged. Reimport the initial batch; the correction must remain intact.
7. Import **Follow-up cafe example** for the first time. Expect 1 new record, using the saved merchant/category rule. If imported before the rule existed, it intentionally stays unchanged on retries; rules only affect new records.
8. Remove the rule. Existing records/corrections must stay unchanged. Unknown merchants still use Other without an AI provider.
9. With a different signed-in user, verify their sandbox is empty until they import their own fixtures. Signing out must protect `/spending/review`.
10. An unavailable database/missing migration must show an explicit loading error, not zero transactions. A stale correction from another tab must ask you to refresh.

These authenticated browser checks remain manual until the migration is applied. Automated tests exercise the actual SQL locally in PGlite, not your hosted project.

## Data and security

- `transactions`: owner, fixture-only source, message ID, sender, integer minor-unit amount, currency, original and normalized merchant, category, timestamp, payment method, short account label, generated short description, classification confidence/source, immutable original structured facts, revision and timestamps.
- `merchant_rules`: owner + fixture source + normalized original merchant key; preferred merchant/category for future imports only.
- `transaction_corrections`: append-only before/after correction snapshots and revision. The original amount, currency, source, payment method, and message ID cannot be edited through the correction operation.
- RLS permits owner-only reads. Authenticated clients cannot write tables directly. Three authenticated-only security-definer RPCs with empty search paths import fixtures, atomically correct/save a rule, or remove an owned rule. Ownership comes from `auth.uid()`, never submitted user IDs.
- Import uniqueness is `(user_id, source_mode, email_message_id)`. Conflict handling does nothing, preserving manual corrections. Each batch is atomic. Stale revisions are rejected.
- Fixture sender approval is explicit per import, separate from real `financial_senders`. Import forms select fixed server-side fixtures; they accept no email body or arbitrary transaction batch from the browser. SQL additionally restricts source IDs and sender to the fixture namespace. This sandbox is not an authenticity boundary for financial records.
- Only supported invented debit templates are extracted; refunds, ambiguous messages, invalid dates and unapproved senders are rejected. Whole email bodies are never persisted or logged. These are not production bank parsers.
- Classification order: user rule → known synthetic merchant → optional classifier interface → Other. No live classifier is configured; tests use fake adapters. Confidence shown is a classification signal, not a verified financial fact.
- The table source constraint currently permits only `fixture`. Real ingestion needs a separately reviewed schema/workflow change; fixture records must never be included in real spending totals.

## Deferred

Live Gmail connection recovery, approved real-sender ingestion, real-bank parsing, Gmail pagination/retry state, production AI classifier and consent, spending dashboard/budgets, scheduling, and real-data end-to-end acceptance. No remote migration, commit, or push is performed here. No fixture cleanup UI is included; do not delete real nutrition/profile data to reset this sandbox.

## Implementation verification — 2026-09-18

- `pnpm test`: passed, 69 tests, including six new spending tests. Existing Node module-type warnings remain non-fatal.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js`: passed.
- `node node_modules/next/dist/bin/next build`: passed, including `/spending/review`.
- `git diff --check`: passed (Git reported line-ending conversion warnings only).
- The initial `pnpm exec tsc --noEmit` could not locate its command launcher; the installed TypeScript entry point above was run successfully instead.
- Hosted migration and authenticated UI acceptance have not been run. No inbox or live AI calls were made.

Sprint 10 files: `src/lib/spending/model.ts`, `repository.ts`, `model.test.mjs`, `database.test.mjs`; `src/app/spending/review/page.tsx`, `actions.ts`, `loading.tsx`; `src/components/spending/transaction-review.tsx`; `src/app/spending/page.tsx`; `src/types/database.ts`; `supabase/migrations/202609180001_fixture_transactions.sql`; `package.json`; `README.md`; this guide. Existing Sprint 9 changes were preserved.
