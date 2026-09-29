"use client";
import { useActionState } from "react";
import { reviewAction } from "@/app/spending/review/actions";
import { categories, fixtureSender, type MerchantRule, type Transaction, type SpendingState } from "@/lib/spending/model";
const initial: SpendingState = { status: "idle", message: "" };
const inputStyle = "mt-1 block w-full rounded-lg border bg-background p-2";
const buttonStyle = "rounded-lg border bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50";
export function TransactionReview({ transactions, rules }: { transactions: Transaction[]; rules: MerchantRule[] }) {
  const [state, action, pending] = useActionState(reviewAction, initial);
  return <div className="space-y-6">
    {state.message && <p role={state.status === "error" ? "alert" : "status"} className="rounded-xl border p-4">{state.message}</p>}
    <form action={action} className="space-y-4 rounded-xl border p-5">
      <h2 className="text-xl font-bold">Import synthetic examples</h2>
      <input type="hidden" name="operation" value="import"/>
      <label className="block">Batch<select name="batch" className={inputStyle}><option value="initial">Initial examples (3 valid transactions)</option><option value="followup">Follow-up cafe example (test your saved rule)</option></select></label>
      <label className="flex items-start gap-2"><input type="checkbox" name="consent" value="yes" required/>Approve {fixtureSender} for this synthetic import only. This does not approve any real financial sender.</label>
      <p className="text-sm text-muted-foreground">Repeated imports skip existing records, including corrected ones. Initial examples also test duplicates, an unapproved sender, a refund, and an invalid date.</p>
      <button className={buttonStyle} disabled={pending}>Import fixtures</button>
    </form>
    <section className="space-y-4"><h2 className="text-xl font-bold">Synthetic transactions · {transactions.length}</h2>
      {!transactions.length && <p>No fixtures imported yet.</p>}
      {transactions.map(row => <article key={`${row.id}:${row.revision}`} className="space-y-4 rounded-xl border p-5">
        <h3 className="text-lg font-bold">{row.normalized_merchant} · {row.currency} {(row.amount_minor / 100).toFixed(2)}</h3>
        <p className="text-sm">{row.category} · {row.payment_method} · {new Date(row.transaction_time).toISOString()} · {row.corrected_at ? `Manually corrected (revision ${row.revision})` : `Classification: ${row.classification_source} (${Math.round(row.classification_confidence * 100)}% confidence)`}</p>
        <details><summary className="cursor-pointer underline">Original extraction and source</summary><dl className="mt-2 space-y-1 text-sm"><dt>Message ID</dt><dd>{row.email_message_id}</dd><dt>Original merchant / category</dt><dd>{row.original.merchant} → {row.original.normalized_merchant} / {row.original.category}</dd><dt>Original timestamp / account</dt><dd>{row.original.transaction_time} / {row.original.account_identifier || "No account label"}</dd><dt>Original description / classification</dt><dd>{row.original.raw_description} / {row.original.classification_source} ({row.original.classification_confidence})</dd></dl></details>
        <details><summary className="cursor-pointer underline">Correct transaction</summary>
          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="operation" value="correct"/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="revision" value={row.revision}/>
            <label className="block">Merchant<input name="normalized_merchant" defaultValue={row.normalized_merchant} maxLength={100} required className={inputStyle}/></label>
            <label className="block">Category<select name="category" defaultValue={row.category} className={inputStyle}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label className="block">Transaction date and time (UTC)<input name="transaction_time" type="datetime-local" step="1" defaultValue={new Date(row.transaction_time).toISOString().slice(0,19)} required className={inputStyle}/></label>
            <label className="block">Account label (at most four digits; never a full account number)<input name="account_identifier" defaultValue={row.account_identifier} maxLength={40} className={inputStyle}/></label>
            <label className="block">Short description (no sensitive details)<input name="raw_description" defaultValue={row.raw_description} maxLength={200} className={inputStyle}/></label>
            <label className="flex items-start gap-2"><input name="save_rule" type="checkbox" value="yes"/>Remember this merchant and category for future fixtures matching “{row.merchant_key}”. Existing transactions will not change.</label>
            <button className={buttonStyle} disabled={pending}>Save correction</button>
          </form>
        </details>
      </article>)}
    </section>
    <section className="space-y-3"><h2 className="text-xl font-bold">Fixture merchant rules</h2>{!rules.length && <p>No rules saved.</p>}{rules.map(rule => <form action={action} key={rule.merchant_key} className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><input type="hidden" name="operation" value="remove-rule"/><input type="hidden" name="merchant_key" value={rule.merchant_key}/><p className="flex-1">{rule.merchant_key} → {rule.normalized_merchant} · {rule.category}</p><button className={buttonStyle} disabled={pending}>Remove rule</button></form>)}</section>
  </div>;
}
