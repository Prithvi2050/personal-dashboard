# Spending direction change: household statement imports

The user's September 2026 decisions supersede the individual-user, Gmail-first spending sections of specifications 01–05 and 09. Nutrition, Google sign-in and the app shell are unchanged.

## Approved behavior

- One PDF multi-file selector, automatic supported-format detection, one combined review and explicit confirmation.
- Statement-based calendar-month reporting for two household members with separate Google logins. Everyone means household members, never the public or all app users.
- All confirmed statement transactions are shared; review drafts stay private to their uploader. Household joining is invitation-based and requires the invited verified email.
- Monthly EMI installments count as expenses. The original financed purchase and later card-bill payment must not count again. Do not automatically infer uncertain EMI links.
- PDFs need not be retained after extraction. This implementation never writes uploads to disk/object storage; it keeps only temporary process memory, structured drafts and confirmed records. The user's local originals are untouched.
- Gmail and Android SMS integration remain deferred. No financial data is sent to an AI provider.

## Initial supported variants

- SBI Card monthly statement, including memo EMI totals, separately listed interest and undated tax rows.
- Axis RuPay card statement with date/details/merchant category/amount plus Dr/Cr, including continuation pages.
- SBI Relationship Summary savings transaction ledger with Credit/Debit/Balance and opening/closing balance reconciliation. Its separate loan ledger is excluded to avoid duplicating the debit from savings.

These are format-specific adapters behind one upload UI. HDFC, ICICI and other layouts are not implemented without representative samples. Scans and encrypted PDFs are explicitly rejected, not guessed.

## Accounting interpretation

### September 25 update — Sprint 11 spending simplification

This supersedes the credit-review and refund-netting behavior below. Only debit rows appear in statement previews and confirmed transaction lists, with no credit toggle. Credits still participate in PDF parsing and bank balance reconciliation, but the application confirmation service excludes them from new imports. Previously confirmed credits and audit records are preserved without being displayed.

The dashboard reports **gross outgoing expenses**, not net-of-refund spending. Credits and refunds never reduce it. Investments are summarized separately; transfers, card repayments, financed purchases and interest already included in an EMI do not increase expenses.

One visible **Category** selector replaces Treatment plus Category in previews and corrections. Purchase categories map to the existing expense kind; EMI, fees, investment and excluded movement choices retain their distinct internal kinds. No new database schema is required and no existing entries are automatically reclassified.

Category bars show amounts and percentages of the selected month's/owner's outgoing expense total. EMI and fees have their own categories rather than being counted again in Bills. This is a scoped Sprint 11 increment; budgets, six-month trends and insights remain deferred.

September 22 addition: Investment is a manually selected transaction treatment for contributions and withdrawals. Both directions remain in shared history but do not affect household expense totals. A withdrawal is not automatically profit/income; users can separately classify actual dividends/interest as income. This is not investment portfolio/performance tracking. Apply the additive investment migration; existing classifications are unchanged.

The metric is monthly expenses under the user's installment convention, not a bank balance or formal accrual ledger. Credits require classification as income/refund/transfer/card repayment. Unclear bank debits require a treatment. A knowingly selected bulk action can classify untouched debit review rows as purchases, but the UI warns about repayments/transfers first.

For SBI memo EMI lines (M), a directly following same-date INTEREST ON EMI debit is included in the EMI total. Keep both source rows, count the total once, and flag the pairing for review. Unpaired memo EMI rows require review. Taxes billed separately count once as fees. If a user excludes or changes the EMI row, they must review the paired interest treatment too.

The statement's displayed row date is used. Do not claim this is the original purchase date where the document does not distinguish posting from purchase date. Statement coverage is shown per account; totals remain provisional. Missing PDFs, excluded rows and mismatched billing cycles prevent certifying completeness.

Exact files are idempotent per account. Matching date/amount/direction/raw-description hashes on overlapping statements are possible duplicates requiring explicit exclusion or distinct-transaction confirmation; same-amount legitimate purchases are not silently discarded. Cross-account transfers and card repayments are reviewed, not matched automatically by amount alone.

## Privacy and permissions

- Household owner creates an email-bound seven-day invitation; no outbound email is sent. Maximum two members and one household per user.
- Owner can revoke an invitation/remove the partner; partner can leave. Existing confirmed records remain with the household, as the UI states. Members can correct shared records; audit entries record the actor. Removing access does not erase copies already seen/downloaded.
- Only nicknames and optional last-four account identifiers are needed. No full bank/card IDs, passwords or OTPs are requested.
- Financial tables use owner-private draft or household-member read RLS. Direct table writes are revoked; authenticated RPCs derive household from the signed-in user. Nutrition and fixture RLS are not relaxed.
- Unconfirmed drafts expire for reading/confirmation after 24 hours; expired rows are physically purged on a subsequent staging operation. No scheduled deletion job exists yet. Confirmed drafts immediately clear their extracted payload.
- No actual statements or extracted financial records belong in repository fixtures/logs. Tests use invented rows only.

## Deliberate limits

5 PDFs / 3 MB combined / 30 pages per PDF / 500 rows per file / 1000 rows per batch / 5 active drafts / 20 accounts. Database reads detect truncation and fail rather than display partial totals. Large-history pagination, automatic recurring merchant rules for real statements, additional formats, robust OCR, encrypted PDF unlock, automatic financed-purchase matching, import undo, account deletion, and a separate household budget remain follow-up work. Existing synthetic merchant rules never classify real household data.
