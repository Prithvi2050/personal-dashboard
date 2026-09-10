import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const categories = [
  { name: "Business", story: "Global firms reconsider growth plans as demand patterns shift", source: "Reuters · Bloomberg" },
  { name: "Technology", story: "AI infrastructure investment enters its next phase", source: "Reuters · The Verge" },
  { name: "Finance", story: "Markets focus on the path for rates and liquidity", source: "Financial Times · CNBC" },
];

export default function BriefingPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Prepared this morning" title="Daily briefing" description="Fifteen important stories, condensed into three focused categories." />
      <section className="grid gap-4 lg:grid-cols-3" aria-label="Briefing categories">{categories.map(({ name, story, source }) => <Card key={name} className="border-0 shadow-sm ring-border/80"><CardContent><Badge className="rounded-full bg-primary/10 text-primary">{name}</Badge><h2 className="mt-8 text-xl leading-7 font-bold">{story}</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">A concise, source-backed summary will appear here once briefing services are connected.</p><div className="mt-8 flex items-center justify-between border-t border-border pt-4"><span className="text-xs font-semibold text-muted-foreground">{source}</span><ArrowUpRight aria-hidden="true" className="size-4 text-primary" /></div></CardContent></Card>)}</section>
    </div>
  );
}
