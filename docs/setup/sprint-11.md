# Sprint 11 — statement spending simplification

## Implemented scope

- Hide all credit rows from upload previews and confirmed transaction lists, without a reveal toggle.
- Exclude credits from new application imports and all expense/investment totals. Continue parsing them for bank balance reconciliation. Preserve previously saved records and audit history.
- Replace Treatment and Category with one Category selector in preview and correction forms.
- Show gross outgoing expenses, included EMI, investments separately, and expense category amounts, percentages and bars for the selected month/owner.
- Preserve shared-household access, temporary drafts, duplicate decisions, atomic confirmation and correction audits.

No new SQL migration, environment variable or account configuration is needed. The earlier household and investment migrations must already be applied. Do not rerun them.

## Manual acceptance

1. Refresh Spending. Existing credit transactions must be absent; totals must not subtract refunds.
2. Upload a mixed debit/credit statement. Only debits should appear, retaining source row numbers. Credit-only files should explicitly say there are no debit rows.
3. Select the matching shared account. Choose Grocery/Dining/etc. for purchases; EMI, Investment, Transfer or Card repayment as appropriate. There must be only one Category field per row.
4. Confirm an unresolved included debit: its error should identify the original source row without losing the review. Hidden credits must not block confirmation.
5. Confirm a reviewed mixed batch. Verify only selected debits are imported; retrying an exact file must not duplicate them.
6. Select the statement month and owner. Expense category amounts must sum to outgoing expenses; displayed percentages may differ from 100% slightly due to rounding. Investments appear separately and never inflate the expense bars.
7. Correct an existing debit using the single Category field. Changing a purchase to Investment must remove it from expenses and add it to investments.
8. Check narrow-screen layout, keyboard selection and empty months. Confirm both household members see the same saved result while their drafts remain private.

No real financial imports are submitted by automated tests. Authenticated/manual acceptance is still required.

## Deferred

Budget status, six-month trends, spending insights, HDFC/ICICI parsing, Gmail/SMS ingestion, transfer matching and investment performance. This increment does not claim completion of every item in the original Sprint 11 roadmap.

## Verification — September 25, 2026

- Full suite: 82 passed, zero failures (`pnpm test`).
- Full ESLint and TypeScript checks passed.
- Production build passed.
- Tracked-file `git diff --check` passed, with line-ending warnings only.
- New tests cover unified category mapping, invalid choices, invisible-credit exclusion even with forged form fields, preserved source indexes, credit-only imports, expense/investment arithmetic, rendered preview/correction controls, and actual SQL confirmation using a local synthetic database.
- Existing Node module-type warnings remain non-fatal. No authenticated browser interaction or real statement confirmation was performed.
- No remote migrations, commits or pushes.

Changed implementation files: `src/components/spending/statement-dashboard.tsx`, `src/lib/statements/model.ts`, `src/lib/statements/repository.ts`, new `src/lib/statements/review.ts`, `src/lib/statements/parser.test.mjs`, `src/lib/statements/database.test.mjs`, new `src/lib/statements/review.test.mjs`, and `package.json` (test command only). Documentation: this guide, the household setup/decision records, and `docs/spec/README.md`. Other uncommitted work was preserved.
