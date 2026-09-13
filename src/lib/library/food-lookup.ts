import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createUsdaProvider, foodSource, parseFdcId, FoodLookupError } from "@/lib/library/food-data";
import type { FoodSearchState } from "@/lib/library/food-data";
import type { LibraryState } from "@/lib/library/model";

const message = (error: unknown) => error instanceof FoodLookupError ? error.message : "Food lookup is unavailable. Please retry.";

export async function searchFoodData(query: unknown): Promise<FoodSearchState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { status: "error", message: "Please sign in again to search foods.", foods: [] };
    // The adapter validates even requests made directly to the server action.
    if (typeof query !== "string") throw new FoodLookupError("Enter a food name.");
    const foods = await createUsdaProvider(process.env.USDA_API_KEY).search(query);
    return { status: "success", foods, message: foods.length ? `${foods.length} matches with complete nutrition data. Values are per 100 g.` : "No complete matches found. Try a simpler English name, such as cooked lentils, or add the food manually." };
  } catch (error) { return { status: "error", message: message(error), foods: [] }; }
}

export async function importFoodData(rawId: unknown): Promise<LibraryState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "error", message: "Please sign in again before saving." };
    const fdcId = parseFdcId(rawId);
    // A stable owner-scoped ID makes retries/concurrent clicks insert-once without
    // a migration. Never upsert: user edits and calibration references must survive.
    const hash = createHash("sha256").update(`personal-dashboard:usda:${user.id}:${fdcId}`).digest("hex");
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const { data: existing, error: lookupError } = await supabase.from("foods").select("id").eq("user_id", user.id).eq("id", id).maybeSingle();
    if (lookupError) throw new Error("lookup");
    if (existing) return { status: "success", message: "Already in your library. Your saved values and calibrations are unchanged." };
    // Trust only the identifier from the browser; fetch authoritative nutrients again.
    const food = await createUsdaProvider(process.env.USDA_API_KEY).get(fdcId);
    const { error } = await supabase.from("foods").insert({
      id, user_id: user.id, name: food.name.slice(0, 120), serving_basis: "g", serving_quantity: 100,
      calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, source: foodSource(fdcId),
    });
    if (error && error.code !== "23505") throw new Error("save");
    return { status: "success", message: error ? "Already saved. Your existing food is unchanged." : "Saved to your foods. It is now available for utensil calibration." };
  } catch (error) { return { status: "error", message: message(error) }; }
}
