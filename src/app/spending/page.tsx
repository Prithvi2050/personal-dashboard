import { ArrowDownRight, ReceiptText, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function SpendingPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="September" title="Spending" description="Your monthly position and latest activity." />
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]" aria-label="Spending summary">
        <Card className="border-0 bg-slate-950 text-white shadow-xl shadow-slate-950/10 ring-0"><CardContent><div className="flex justify-between"><WalletCards aria-hidden="true" className="size-5 text-cyan-300" /><span className="text-sm text-white/60">46% used</span></div><p className="mt-10 text-sm text-white/60">Month to date</p><p className="mt-1 text-4xl font-bold">₹32,450</p><p className="mt-2 text-sm text-white/60">₹37,550 remaining</p><Progress value={46} aria-label="Monthly budget used" className="mt-6 [&_[data-slot=progress]]:bg-white/15 [&_[data-slot=progress-indicator]]:bg-cyan-300" /></CardContent></Card>
        <Card className="border-0 shadow-sm ring-border/80"><CardContent><ArrowDownRight aria-hidden="true" className="size-5 text-emerald-600" /><p className="mt-10 text-sm font-semibold text-muted-foreground">Yesterday</p><p className="mt-1 text-3xl font-bold">₹2,340</p><p className="mt-2 text-sm text-emerald-700">Within your daily average</p></CardContent></Card>
      </section>
      <Card className="border-0 shadow-sm ring-border/80"><CardHeader><CardTitle>Recent activity</CardTitle></CardHeader><CardContent className="space-y-3">{[["Swiggy","Dining","₹845"],["Local Market","Grocery","₹1,120"],["Metro","Transport","₹375"]].map(([merchant, category, amount]) => <div key={merchant} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-4"><span className="grid size-10 place-items-center rounded-xl bg-card"><ReceiptText aria-hidden="true" className="size-4 text-primary" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{merchant}</p><p className="text-sm text-muted-foreground">{category}</p></div><p className="font-bold">{amount}</p></div>)}</CardContent></Card>
    </div>
  );
}
