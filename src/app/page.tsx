import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stories = {
  Business: ["Markets weigh the week ahead", "Global firms reset growth plans"],
  Technology: ["AI infrastructure spending accelerates", "A new chapter for personal computing"],
  Finance: ["Rate outlook shapes investor focus", "Banks prepare for the next policy cycle"],
};

export default function Home() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Tuesday, 9 September" title="Good morning" description="Your completed day at a glance." />

      <section aria-label="Yesterday's summary" className="grid gap-4 md:grid-cols-2">
        <MetricCard href="/nutrition" label="Nutrition" value="2,080 kcal" detail="116 g protein · 4 meals" progress={95} accent="blue" />
        <MetricCard href="/spending" label="Spending" value="₹2,340" detail="₹32,450 of ₹70,000 this month" progress={46} accent="cyan" />
      </section>

      <Card className="border-0 bg-primary text-primary-foreground shadow-xl shadow-primary/15 ring-0">
        <CardContent className="flex items-start gap-4 py-1">
          <span className="rounded-2xl bg-white/15 p-3"><Sparkles aria-hidden="true" className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold text-white/70">Daily insight</p>
            <p className="mt-1 max-w-3xl text-base leading-7 font-medium">You stayed close to your calorie target yesterday. Protein was 4 g short, while spending remained comfortably within the monthly plan.</p>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="briefing-title" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-sm font-semibold text-primary">Today</p><h2 id="briefing-title" className="text-2xl font-bold tracking-tight">Morning briefing</h2></div>
          <Link href="/briefing" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">All 15 stories <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Object.entries(stories).map(([category, items]) => (
            <Card key={category} className="border-0 shadow-sm ring-border/80">
              <CardHeader><CardTitle>{category}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {items.map((story, index) => <p key={story} className="border-t border-border/70 pt-4 text-[0.95rem] leading-6 first:border-0 first:pt-0"><span className="mr-2 text-xs font-bold text-primary">0{index + 1}</span>{story}</p>)}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
