export const mealTypes = ["Breakfast", "Lunch", "Snack", "Dinner", "Other"] as const;
export type MealType = typeof mealTypes[number];
export type Macros = { calories: number; protein: number; carbs: number; fat: number };
export type MealItem = Macros & { name: string; portion: string };
export type Meal = { id: string; type: MealType; time: string; items: MealItem[] };

export function localDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return get("year") + "-" + get("month") + "-" + get("day");
}
export function recentDays(today: string): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - index);
    return date.toISOString().slice(0, 10);
  });
}
export function selectedDay(value: string | string[] | undefined, days: string[]): string {
  return typeof value === "string" && days.includes(value) ? value : days[0];
}
export function totalMacros(items: Macros[]): Macros {
  const total = items.reduce((sum, item) => ({
    calories: sum.calories + item.calories, protein: sum.protein + item.protein,
    carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  return Object.fromEntries(Object.entries(total).map(([key, value]) => [key, Math.round(value * 10) / 10])) as Macros;
}
export function goalProgress(value: number, goal: number | null) {
  if (goal === null || !Number.isFinite(goal) || goal <= 0) return null;
  return { percent: Math.min(100, Math.max(0, value / goal * 100)), difference: Math.round((goal - value) * 10) / 10 };
}
export function groupMeals(meals: Meal[]) {
  return mealTypes.map((type) => ({ type, meals: meals.filter((meal) => meal.type === type).toSorted((a, b) => a.time.localeCompare(b.time)) }));
}
export function dayLabel(day: string, today: string) {
  if (day === today) return "Today";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(day + "T12:00:00Z"));
}
