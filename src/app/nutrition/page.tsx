import { redirect } from "next/navigation";
import { loadSettings } from "@/lib/settings/repository";
import { localDate, recentDays, selectedDay, type NutritionDay } from "@/lib/nutrition/daily";
import { sampleMeals } from "@/data/nutrition-fixtures";
import { DailyNutritionView } from "@/components/nutrition/daily-view";
import { QuickMealForm } from "@/components/nutrition/quick-meal-form";
import { loadLibrary } from "@/lib/library/repository";
import { loadMeals } from "@/lib/nutrition/repository";

export default async function NutritionPage({ searchParams }: { searchParams: Promise<{ date?: string | string[]; demo?: string | string[] }> }) {
  let result;
  try { result = await loadSettings(); } catch { result = { status: "error" } as const; }
  if (result.status === "unauthenticated") redirect("/sign-in?next=/nutrition");
  if (result.status === "error") return <section role="alert" className="rounded-3xl bg-card p-8"><h1 className="text-2xl font-bold">Nutrition is temporarily unavailable</h1><p className="mt-3 text-muted-foreground">We could not load your goals. Please try again.</p><a href="/nutrition" className="mt-5 inline-block rounded-full bg-primary px-5 py-3 text-primary-foreground">Try again</a></section>;
  const settings = result.settings;
  const days = recentDays(localDate(new Date(), settings.timezone));
  const query = await searchParams;
  const day = selectedDay(query.date, days);
  const demo = query.demo === "1";
  let meals;
  let history: NutritionDay[];
  let quickLog;
  try {
    history = await Promise.all(days.map(async date => ({ day: date, meals: demo ? sampleMeals(date, days) : await loadMeals(date, settings.timezone, date === day) })));
    meals = history.find(row => row.day === day)!.meals;
  } catch {
    return <section role="alert" className="rounded-3xl bg-card p-8"><h1 className="text-2xl font-bold">Meal journal needs attention</h1><p className="mt-3 text-muted-foreground">Check your connection and apply the Sprint 6 quick-meals migration if you have not done so. We could not load meals; no zero totals are being assumed.</p><a href="/nutrition" className="mt-5 inline-block text-primary underline">Try again</a></section>;
  }
  if (!demo && day === days[0]) {
    let library;
    try {
      library = await loadLibrary();
    } catch { library = { status: "error" } as const; }
    quickLog = library.status === "ready" ? <QuickMealForm foods={library.foods} utensils={library.utensils} calibrations={library.calibrations} requestId={crypto.randomUUID()}/> : <p role="alert">Your food library could not be loaded. Refresh to retry; saved meals are shown below.</p>;
  }
  return <DailyNutritionView history={history} day={day} days={days} timezone={settings.timezone} demo={demo} meals={meals} quickLog={quickLog} goals={{ calories: settings.daily_calorie_goal, protein: settings.daily_protein_goal, carbs: settings.daily_carbs_goal, fat: settings.daily_fat_goal }} />;
}
