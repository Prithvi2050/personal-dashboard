import Link from "next/link";
import { StatementDashboard } from "@/components/spending/statement-dashboard";
import { loadStatements } from "@/lib/statements/repository";
export default async function StatementsPage() {
  let data;
  try {data=await loadStatements();} catch {
    return <section className="space-y-4 rounded-2xl border p-6"><h1 className="text-2xl font-bold">Statement spending needs setup</h1><p>Apply the household-statements migration, then check your login and connection. No totals are shown because the data could not be loaded.</p><p><Link href="/spending" className="underline">Retry</Link> · <Link href="/spending/review" className="underline">Open existing synthetic sandbox</Link></p></section>;
  }
  return <StatementDashboard data={data} defaultMonth={new Date().toISOString().slice(0,7)}/>;
}
