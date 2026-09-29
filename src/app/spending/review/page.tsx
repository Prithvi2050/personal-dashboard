import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionReview } from "@/components/spending/transaction-review";
import { loadReview } from "@/lib/spending/repository";
export default async function ReviewPage() {
  let data;
  try { data = await loadReview(); } catch {
    return <section className="space-y-4"><h1 className="text-2xl font-bold">Transaction review needs attention</h1><p>Check your login, connection, and Sprint 10 migration. Records could not be loaded; this is not an empty transaction list.</p><Link className="underline" href="/spending/review">Try again</Link></section>;
  }
  return <div className="space-y-6"><PageHeader eyebrow="Sprint 10 · Synthetic sandbox" title="Transaction review" description="Test extraction and corrections without reading your inbox." /><p className="rounded-xl border p-4">All records here are invented test data, not your actual spending. No Gmail or AI service is called. Dashboard totals are not connected to this sandbox. Dates below are explicitly UTC.</p><TransactionReview transactions={data.transactions} rules={data.rules}/></div>;
}
