# Household statement imports — setup and acceptance

## Before you start

Investment option: after the household migration, run `supabase/migrations/202609220001_statement_investment.sql` once. Refresh Spending, then select **Investment** under Category. It is available in draft review and saved-transaction corrections. Investment debits appear separately from household expenses; no existing records are reclassified. The September 25 debit-only update is documented in [Sprint 11](sprint-11.md); previously saved credits are preserved but hidden.

This replaces the sample Spending dashboard with real, confirmed statement totals. The existing synthetic sandbox remains at `/spending/review` and is never included in household totals. No remote migration, commit or push is performed automatically.

1. In Supabase SQL Editor, open a new query and run the complete `supabase/migrations/202609210001_household_statements.sql` once. Requires the existing Sprint 2 users/authentication foundation. Do not rerun a successful migration.
2. Install dependencies with `pnpm install` if pulling these changes elsewhere. PDF parsing uses `pdf-parse` locally on the server, not a cloud AI service. `next.config.ts` externalizes the package for its native Node runtime.
3. Restart the existing development server after dependency/config changes. Use the existing port 3000; do not start competing servers on 3001.
4. Open `/spending` (or `/spending/statements`). Missing migration/connection errors show a setup message, not false zero balances.

No new secret or environment variable is required. Existing Supabase Google login must work. Do not add a service-role key or bank credentials.

## Household setup

1. Sign in with your Google account. Create the household after reading the sharing notice.
2. Expand **Household & accounts**. Save an invitation addressed to your wife's exact Google sign-in email. No email is sent by the app.
3. Your wife signs in on the same deployed app (or the same locally reachable app with correctly configured auth URLs), opens Spending and accepts the invitation within seven days. She should not create a separate household first.
4. Add account nicknames: for example SBI savings, SBI Card and Axis RuPay. Select the owner and format; last four digits are optional. Everyone in the household can view confirmed imports.
5. An iPhone cannot reach your computer using its own `localhost`. Cross-device household acceptance needs a reachable app URL with matching authentication redirects; deployment/network configuration is separate from this implementation.

## Single upload and review

1. Select up to five unlocked, text-based PDFs together (3 MB combined), approve temporary processing/sharing, then choose **Extract and preview**.
2. Supported files appear in one combined review; unsupported or unreadable files get numbered error messages. No file is partially imported. Files are numbered in selection order; original filenames are not stored.
3. Assign each file to the matching shared account. One matching account is selected automatically; choose carefully if you have multiple cards with the same format. Changing the account resets that file's review fields.
4. Review debit dates, amounts and the single Category field. Edit the merchant/category if needed. Credits are hidden and excluded automatically. Bank debits with unclear purpose remain **Needs review**; uncheck or classify them before saving.
5. Classify UPI purchases as expenses, actual monthly installments as EMI, card-bill payments as card repayments, household/self transfers as transfers, and original financed purchases as excluded financed purchases. Do not count an EMI and its included interest twice. For SBI memo EMIs, the parser proposes that separation and asks for verification.
6. Potential duplicates are initially unchecked. Include one only after explicitly marking it as a distinct transaction. Exact previously confirmed PDFs are skipped. Overlap checks are per account, not across different account owners.
7. Confirm the combined import. All selected files are saved atomically; an error must not leave a partial batch. Corrections survive repeated uploads.
8. Select the relevant calendar month and account owner on the dashboard. All totals are INR and remain provisional. Outgoing expenses are gross debit expenses: credits/refunds never reduce them. Investments are separate, and category bars show each expense category’s amount and percentage. Coverage dates are not proof that every row/account is complete.
9. Expand a confirmed transaction to correct its merchant or Category. The amount/date/source remain immutable; the original extraction and before/after correction audit are retained. A stale edit must ask you to refresh.

## Retention

The application never saves uploaded PDFs to disk or Supabase Storage. Server memory is released after extraction; the user's Downloads files are never deleted. No bank data is sent to Gmail/OpenAI or another parsing service.

Only structured review rows are saved temporarily. Drafts become inaccessible after 24 hours; a later upload purges expired drafts. Discard removes a draft immediately. Confirmation clears the draft payload immediately and retains confirmed transaction facts, import hashes/coverage and correction history. This is not a guarantee of immediate physical deletion from provider backups or process memory.

## Acceptance checklist

- Import the SBI bank, SBI Card and Axis examples in one selection. Check the preview manually against your originals before confirmation.
- Check mixed valid/unsupported files: valid previews remain available, and each failure is reported.
- Repeat an exact confirmed PDF: zero duplicate transactions, no correction overwritten.
- Upload overlapping statements: possible matches require a decision; distinct same-value purchases can be retained.
- Verify a card payment does not increase expenses. Verify monthly EMI totals include interest only once, with separately billed tax included once.
- Verify malformed/scanned/password-protected PDFs are reported and never silently become an empty successful import.
- Cancel/discard a draft and confirm no transaction was saved.
- Verify the invited partner can see confirmed household data, but not your private unconfirmed drafts.
- Verify an unrelated third account sees none of the household's accounts/entries/drafts/history and cannot confirm or correct them.
- Remove/leave membership: access ends; existing shared history remains.
- Verify missing migration/network failure does not display zero as a successful result.

## Current limitations

HDFC/ICICI need redacted layout samples. No OCR, Gmail/SMS ingestion, bank API integration, automatic household transfer reconciliation, real-statement merchant rule learning, account removal/import undo, or budget dashboard is included. Excluded rows of an already confirmed PDF cannot currently be added by reuploading that exact PDF. Review carefully before confirming. Do not use database deletion to reset a household without a separately reviewed recovery plan.

The local automated tests use synthetic data and the actual migration in PGlite. Hosted Supabase acceptance, partner login and authenticated browser walkthrough still require the manual steps above.

## Verification and changed files — 2026-09-22

- Full test suite: 77 passed, 0 failed. Includes in-memory synthetic PDF extraction, debit/credit and EMI arithmetic, wrapped bank rows/balance reconciliation, actual SQL migration, invitations, private drafts, household isolation, atomic rollback, idempotency, possible duplicate decisions, and correction audits/stale revisions.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` passed.
- Full lint: `node node_modules/eslint/bin/eslint.js` passed.
- Production build: `node node_modules/next/dist/bin/next build` passed with `/spending` and `/spending/statements` routes.
- `git diff --check` passed; Git reported line-ending conversion warnings only. Node's existing module-type warnings are non-fatal.
- Supplied PDF layouts were inspected locally using the PDF skill and exercised through the parser without importing or retaining their records in fixtures. They are not a substitute for your final manual financial review.
- No hosted migration or authenticated end-to-end UI test has been run. No commit or push was made. Existing Sprint 9/10 work was preserved.

Implementation files: `src/lib/statements/{model,parser,pdf,repository}.ts`, `src/lib/statements/{parser,database}.test.mjs`, `src/components/spending/statement-dashboard.tsx`, `src/app/spending/statements/{page,loading,actions}.tsx/ts`, the Spending entry/loading routes, `src/types/database.ts`, and `supabase/migrations/202609210001_household_statements.sql`. Configuration/documentation changes: `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, `README.md`, `docs/spec/README.md`, this guide and the household-statements decision record.
