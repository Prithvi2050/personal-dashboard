import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Camera, Flame, Drumstick, Salad, Droplets, Utensils } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Progress } from "@/components/ui/progress";
import { NutritionHistory } from "@/components/nutrition/history-view";
import type { NutritionDay } from "@/lib/nutrition/daily";
import { dayLabel, goalProgress, groupMeals, totalMacros, type Meal, type Macros } from "@/lib/nutrition/daily";

const metrics = [
  { key: "calories", label: "Calories", unit: "kcal", icon: Flame },
  { key: "protein", label: "Protein", unit: "g", icon: Drumstick },
  { key: "carbs", label: "Carbohydrates", unit: "g", icon: Salad },
  { key: "fat", label: "Fat", unit: "g", icon: Droplets },
] as const;
const format = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);

export function DailyNutritionView({ day, days, timezone, meals, goals, demo, quickLog, history }: {
  history: NutritionDay[];
  day: string; days: string[]; timezone: string; meals: Meal[];
  goals: Record<keyof Macros, number | null>; demo: boolean; quickLog?: ReactNode;
}) {
  const totals = totalMacros(meals.flatMap((meal) => meal.items));
  const href = (date: string, sample = demo) => "/nutrition?date=" + date + (sample ? "&demo=1" : "");
  return <div className="space-y-8">
    <PageHeader eyebrow={dayLabel(day, days[0]) + " · " + timezone.replaceAll("_", " ")} title="Nutrition" description="Your daily goals and meals, in one place." />
    <aside className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-semibold">{demo ? "Sample meal preview" : "Your meal journal"}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{demo ? "Illustrative meals, compared with your saved goals. These are not your food records and are never saved." : "Your saved meals and calculated nutrition. Use quick logging below to add a meal for today."}</p></div>
      <Link href={href(day, !demo)} className="shrink-0 rounded-full border border-primary/30 px-4 py-2 text-center text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{demo ? "Exit sample preview" : "Preview sample meals"}</Link>
    </aside>
    <nav aria-label="Select nutrition day" className="flex gap-2 overflow-x-auto pb-2">
      {days.map((date) => <Link key={date} href={href(date)} aria-current={date === day ? "date" : undefined} className={"shrink-0 rounded-full px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " + (date === day ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted")}>{dayLabel(date, days[0])}</Link>)}
    </nav>
    <section aria-label={demo ? "Sample nutrition totals against your goals" : "Nutrition totals"} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(({ key, label, unit, icon: Icon }) => {
        const progress = goalProgress(totals[key], goals[key]);
        return <article key={key} className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/80">
          <Icon aria-hidden="true" className="size-5 text-primary" /><h2 className="mt-6 text-sm font-semibold text-muted-foreground">{label}</h2>
          <p className="mt-2 text-3xl font-bold">{format(totals[key])} <span className="text-base font-medium text-muted-foreground">{unit}</span></p>
          <p className="mt-2 text-sm text-muted-foreground">{goals[key] === null ? "Goal not set" : "Goal: " + format(goals[key]!) + " " + unit}</p>
          {progress ? <><Progress value={progress.percent} aria-label={label + " goal progress"} className="mt-5" /><p className="mt-3 text-xs text-muted-foreground">{progress.difference < 0 ? format(-progress.difference) + " " + unit + " above goal" : progress.difference === 0 ? "Goal reached" : format(progress.difference) + " " + unit + " remaining"}</p></> : <Link href="/settings" className="mt-5 inline-block text-sm font-semibold text-primary underline underline-offset-4">{goals[key] === 0 ? "Edit zero goal" : "Set a goal"}</Link>}
        </article>;
      })}
    </section>
    <Link href="/settings/library" className="inline-block rounded-full border border-border px-5 py-3 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Manage foods & utensils</Link>
    {!demo ? <Link href="/nutrition/photo" className="ml-3 inline-block rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Log meal with a photo</Link> : null}
    <NutritionHistory history={history} goals={goals} selected={day} demo={demo} />
    {!demo ? quickLog : null}
    <section aria-labelledby="meal-history-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="meal-history-heading" className="text-2xl font-bold">{demo ? "Sample meals" : "Meals"} · {dayLabel(day, days[0])}</h2><p className="text-sm text-muted-foreground">{meals.length} {meals.length === 1 ? "meal" : "meals"}</p></div>
      {meals.length === 0 ? <div className="rounded-3xl border border-dashed border-border p-10 text-center"><Utensils aria-hidden="true" className="mx-auto size-7 text-muted-foreground" /><h3 className="mt-4 font-semibold">{demo ? "No sample meals for this day" : "No meals logged yet"}</h3><p className="mt-2 text-sm text-muted-foreground">{demo ? "Choose another day to explore a populated meal journal." : "No saved meals for this day. Choose Today to log a new meal."}</p></div> :
        groupMeals(meals).filter((group) => group.meals.length).map((group) => <section key={group.type} aria-label={group.type} className="space-y-3"><h3 className="text-sm font-bold text-muted-foreground">{group.type}</h3>{group.meals.map((meal) => {
          const total = totalMacros(meal.items);
          return <article key={meal.id} className="rounded-2xl bg-card p-5 ring-1 ring-border/80">
            <div className="flex items-start gap-4">{meal.imageUrl ? <Image unoptimized src={meal.imageUrl} width={56} height={56} alt="Saved meal photo" className="size-14 shrink-0 rounded-2xl object-cover"/> : <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-muted" aria-label={meal.hasPhoto ? "Photo temporarily unavailable" : "No meal photo"}><Utensils aria-hidden="true" className="size-5 text-muted-foreground" /></div>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{meal.items.map((item) => item.name).join(", ")}</h4><time dateTime={day + "T" + meal.time} className="text-sm text-muted-foreground">{meal.time}</time></div><p className="mt-2 text-sm text-muted-foreground">{format(total.calories)} kcal · {format(total.protein)} g protein · {format(total.carbs)} g carbs · {format(total.fat)} g fat</p></div></div>
            <details className="mt-4 border-t border-border pt-4"><summary className="cursor-pointer rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Food and portion details</summary><ul className="mt-4 space-y-3">{meal.items.map((item, index) => <li key={index} className="flex flex-col justify-between gap-1 text-sm sm:flex-row"><span>{item.name} <span className="text-muted-foreground">· {item.portion}</span></span><span className="text-muted-foreground">{format(item.calories)} kcal · P {format(item.protein)} g · C {format(item.carbs)} g · F {format(item.fat)} g</span></li>)}</ul></details>
          </article>;
        })}</section>)}
    </section>
    <div className="flex items-start gap-3 rounded-2xl bg-muted/60 p-5 text-sm leading-6 text-muted-foreground"><Camera aria-hidden="true" className="mt-1 size-5 shrink-0" /><p>Photo analysis suggests foods and portions using selected utensil references. Review the estimates before saving; quick logging remains available. Update goals in <Link href="/settings" className="font-semibold text-primary underline">Settings</Link>.</p></div>
  </div>;
}
