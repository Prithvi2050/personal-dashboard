import { BellOff, Database, Mail, Target, Utensils } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

const groups = [
  { title: "Nutrition goals", detail: "Calories, protein, carbs and fat", icon: Target },
  { title: "Foods & utensils", detail: "Personal foods and calibrated kitchenware", icon: Utensils },
  { title: "Spending connection", detail: "Email and approved financial senders", icon: Mail },
  { title: "Briefing sources", detail: "Trusted publications and categories", icon: Database },
  { title: "Notifications", detail: "Not included in the MVP", icon: BellOff },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Preferences" title="Settings" description="The controls that will shape your personal dashboard." />
      <section className="grid gap-3 md:grid-cols-2" aria-label="Settings groups">{groups.map(({ title, detail, icon: Icon }) => <Card key={title} className="border-0 shadow-sm ring-border/80"><CardContent className="flex items-center gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-5" /></span><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div></CardContent></Card>)}</section>
    </div>
  );
}
