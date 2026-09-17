import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localDate, mealTypes, type Meal, type MealType } from "@/lib/nutrition/daily";
import { parseMealInput, MealValidationError, type QuickMealState } from "@/lib/nutrition/quick-meal";

export async function loadMeals(day: string, timezone: string, includePhotos = true): Promise<Meal[]> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Sign in required");
  // Broad UTC bounds cover every timezone (including DST); exact local-day
  // filtering below avoids assuming that each local day is exactly 24 hours.
  const anchor = Date.parse(day + "T00:00:00Z");
  const { data: rows, error, count } = await supabase.from("meals").select("*", { count: "exact" }).eq("user_id", user.id)
    .gte("meal_time", new Date(anchor - 86400000).toISOString())
    .lt("meal_time", new Date(anchor + 2 * 86400000).toISOString()).order("meal_time");
  if (error || count !== rows.length) throw new Error("Meals unavailable or truncated");
  const meals = rows.filter(row => localDate(new Date(row.meal_time), timezone) === day);
  if (!meals.length) return [];
  const { data: items, error: itemError, count: itemCount } = await supabase.from("meal_items").select("*", { count: "exact" }).eq("user_id", user.id).in("meal_id", meals.map(meal => meal.id)).order("position");
  if (itemError || itemCount !== items.length) throw new Error("Meal items unavailable or truncated");
  const photos = new Map(await Promise.all(meals.filter(meal => includePhotos && meal.photo_path).map(async meal => {
    const signed = await supabase.storage.from("meal-images").createSignedUrl(meal.photo_path!, 900);
    return [meal.id, signed.data?.signedUrl ?? null] as const;
  })));
  return meals.map(meal => ({
    imageUrl: photos.get(meal.id), hasPhoto: Boolean(meal.photo_path),
    id: meal.id, type: mealTypes.includes(meal.meal_type as MealType) ? meal.meal_type as MealType : "Other",
    time: new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(meal.meal_time)),
    items: items.filter(item => item.meal_id === meal.id).map(item => ({
      name: item.food_name,
      portion: item.utensil_name ? `${item.portion_fraction! * 100}% ${item.utensil_name} · ${item.quantity} g` : `${item.quantity} ${item.serving_basis}`,
      calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat,
    })),
  }));
}

export async function persistQuickMeal(form: FormData): Promise<QuickMealState> {
  try {
    const input = parseMealInput(form);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Please sign in again before saving." };
    const { data, error } = await supabase.rpc("save_quick_meal", { p_request_id: input.requestId, p_meal_type: input.type, p_items: input.items });
    if (error || !data) return { status: "error", message: "Meal could not be saved. Check the Sprint 6 migration, connection, and food calibrations, then retry. No partial meal is saved." };
    return { status: "success", message: "Meal saved. Today's nutrition totals are updated." };
  } catch (error) {
    return { status: "error", message: error instanceof MealValidationError ? error.message : "Could not confirm the save. Retry the same meal safely; duplicate submissions are prevented." };
  }
}
