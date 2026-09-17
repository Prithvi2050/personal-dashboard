import Link from "next/link";
import { dayLabel, summarizeHistory, type NutritionDay, type Macros } from "@/lib/nutrition/daily";

const format = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
export function NutritionHistory({ history, goals, selected, demo }: { history: NutritionDay[]; goals: Record<keyof Macros, number | null>; selected: string; demo: boolean }) {
  const summary = summarizeHistory(history);
  const metrics = ["calories", "protein", "carbs", "fat"] as const;
  return <section aria-labelledby="weekly-heading" className="space-y-4 rounded-3xl bg-card p-6 ring-1 ring-border">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="weekly-heading" className="text-2xl font-bold">{demo ? "Sample seven-day overview" : "Seven-day overview"}</h2><Link href="/settings" className="text-sm font-semibold text-primary underline">Edit goals</Link></div>
    <p className="text-sm text-muted-foreground">{summary.loggedDays} of {history.length} days have logged meals. Today is still in progress; other days may also be incomplete. No meals logged does not mean no food eaten.</p>
    <div className="overflow-x-auto rounded-xl focus-visible:outline-2 focus-visible:outline-primary" tabIndex={0} role="region" aria-label="Seven-day nutrition table">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Logged nutrition totals by local date. Calories in kcal; protein, carbs and fat in grams.</caption>
        <thead><tr className="border-b border-border">{["Day", "Meals", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)"].map(label => <th key={label} scope="col" className="whitespace-nowrap p-3">{label}</th>)}</tr></thead>
        <tbody>{summary.days.map(row => <tr key={row.day} className={row.day === selected ? "bg-primary/5" : ""}>
          <th scope="row" className="whitespace-nowrap p-3"><Link aria-current={row.day === selected ? "date" : undefined} className="text-primary underline" href={`/nutrition?date=${row.day}${demo ? "&demo=1" : ""}`}>{dayLabel(row.day, history[0].day)}</Link>{!row.mealCount ? <span className="block text-xs font-normal text-muted-foreground">No meals logged</span> : null}</th>
          <td className="p-3">{row.mealCount}</td>{metrics.map(key => <td key={key} className="p-3">{row.mealCount ? format(row.totals[key]) : "—"}</td>)}
        </tr>)}</tbody>
        <tfoot className="border-t border-border">
          <tr><th scope="row" className="p-3">Logged total</th><td className="p-3">{summary.days.reduce((n, row) => n + row.mealCount, 0)}</td>{metrics.map(key => <td key={key} className="p-3">{format(summary.totals[key])}</td>)}</tr>
          <tr><th scope="row" className="p-3">Average per logged day</th><td className="p-3">—</td>{metrics.map(key => <td key={key} className="p-3">{summary.average ? format(summary.average[key]) : "—"}</td>)}</tr>
          <tr><th scope="row" className="p-3">Current daily goal</th><td className="p-3">—</td>{metrics.map(key => <td key={key} className="p-3">{goals[key] === null ? "Not set" : format(goals[key])}</td>)}</tr>
        </tfoot>
      </table>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">Averages include today when logged and exclude unlogged days. Goals are your current settings, not historical goal snapshots. Select a day to compare its totals with your goals above.</p>
  </section>;
}
