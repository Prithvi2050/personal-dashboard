import { redirect } from "next/navigation";
import { loadSettings } from "@/lib/settings/repository";
import { localDate, recentDays, selectedDay } from "@/lib/nutrition/daily";
import { sampleMeals } from "@/data/nutrition-fixtures";
import { DailyNutritionView } from "@/components/nutrition/daily-view";

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
  return <DailyNutritionView day={day} days={days} timezone={settings.timezone} demo={demo} meals={demo ? sampleMeals(day, days) : []} goals={{ calories: settings.daily_calorie_goal, protein: settings.daily_protein_goal, carbs: settings.daily_carbs_goal, fat: settings.daily_fat_goal }} />;
}
