import { Camera, Drumstick, Flame, Salad } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const metrics = [
  { label: "Calories", value: "1,340", goal: "2,200 kcal", progress: 61, icon: Flame },
  { label: "Protein", value: "78 g", goal: "120 g", progress: 65, icon: Drumstick },
  { label: "Carbs", value: "146 g", goal: "Goal not set", progress: 48, icon: Salad },
];

export default function NutritionPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Today" title="Nutrition" description="A simple view of today's progress and meals." />
      <section aria-label="Nutrition summary" className="grid gap-4 md:grid-cols-3">
        {metrics.map(({ label, value, goal, progress, icon: Icon }) => <Card key={label} className="border-0 shadow-sm ring-border/80"><CardContent><Icon aria-hidden="true" className="size-5 text-primary" /><p className="mt-8 text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p><p className="mt-1 text-sm text-muted-foreground">of {goal}</p><Progress value={progress} aria-label={`${label} progress`} className="mt-5" /></CardContent></Card>)}
      </section>
      <Card className="border-0 shadow-sm ring-border/80"><CardHeader><CardTitle>Today&apos;s meals</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-muted/70 p-4"><p className="text-sm font-semibold text-muted-foreground">Breakfast · 8:30 AM</p><p className="mt-2 font-semibold">Ragi, curd, banana</p><p className="mt-1 text-sm text-muted-foreground">430 kcal · 24 g protein</p></div><div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4"><Camera aria-hidden="true" className="size-5 text-primary" /><p className="mt-2 font-semibold">Next meal</p><p className="mt-1 text-sm text-muted-foreground">Photo capture arrives in a later sprint.</p></div></CardContent></Card>
    </div>
  );
}
