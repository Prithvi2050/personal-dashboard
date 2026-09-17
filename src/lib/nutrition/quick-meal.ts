import type { Food, Calibration } from "../library/model";

export type QuickItem = { food_id: string; utensil_id: string | null; fraction: number | null; quantity: number | null };
export type QuickMealState = { status: "idle" | "error" | "success"; message: string };
export class MealValidationError extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const fractions = [0.25, 0.5, 0.75, 1] as const;
export function parseMealInput(form: FormData) {
  const requestId = form.get("request_id");
  const type = form.get("meal_type");
  if (typeof requestId !== "string" || !uuid.test(requestId)) throw new MealValidationError("Refresh the page before saving this meal.");
  if (typeof type !== "string" || !["Breakfast", "Lunch", "Snack", "Dinner", "Other"].includes(type)) throw new MealValidationError("Choose a meal type.");
  const raw = form.get("items");
  if (typeof raw !== "string" || raw.length > 12000) throw new MealValidationError("Add between 1 and 20 foods.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new MealValidationError("Choose valid foods and portions."); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) throw new MealValidationError("Add between 1 and 20 foods.");
  const items: QuickItem[] = parsed.map(value => {
    if (!value || typeof value !== "object" || typeof value.food_id !== "string" || !uuid.test(value.food_id)) throw new MealValidationError("Choose a saved food.");
    if (value.utensil_id !== null) {
      if (typeof value.utensil_id !== "string" || !uuid.test(value.utensil_id) || !fractions.includes(value.fraction) || value.quantity !== null) throw new MealValidationError("Choose a calibrated utensil and portion.");
    } else if (value.fraction !== null || typeof value.quantity !== "number" || !Number.isFinite(value.quantity) || value.quantity < 0.01 || value.quantity > 10000 || Math.abs(value.quantity * 100 - Math.round(value.quantity * 100)) > 0.000001) {
      throw new MealValidationError("Enter a quantity from 0.01 to 10,000 with up to two decimal places.");
    }
    return { food_id: value.food_id, utensil_id: value.utensil_id, fraction: value.fraction, quantity: value.quantity };
  });
  return { requestId, type, items };
}

export function calculatePortion(food: Food, item: QuickItem, calibrations: Calibration[]) {
  let quantity = item.quantity;
  if (item.utensil_id) {
    const profile = calibrations.find(c => c.food_id === food.id && c.utensil_id === item.utensil_id);
    if (food.serving_basis !== "g" || !profile || !fractions.includes(item.fraction as typeof fractions[number])) throw new MealValidationError("This food needs a gram-based utensil calibration.");
    quantity = profile.full_serving_grams * item.fraction!;
  }
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 || food.serving_quantity <= 0) throw new MealValidationError("Choose a valid portion up to 10,000 units.");
  const factor = quantity / food.serving_quantity;
  const scaled = (value: number) => Math.round((value * factor + Number.EPSILON) * 10) / 10;
  return { quantity, calories: scaled(food.calories), protein: scaled(food.protein), carbs: scaled(food.carbs), fat: scaled(food.fat) };
}

export type StoredMeal = { id: string; user_id: string; request_id: string; meal_type: string; meal_time: string; total_calories: number; total_protein: number; total_carbs: number; total_fat: number; created_at: string; photo_path?: string | null; photo_draft_id?: string | null };
export type StoredMealItem = { id: string; user_id: string; meal_id: string; food_id: string; utensil_id: string | null; food_name: string; source: string; serving_basis: string; serving_quantity: number; quantity: number; portion_fraction: number | null; utensil_name: string | null; full_serving_grams: number | null; calories: number; protein: number; carbs: number; fat: number; user_confirmed: boolean; position: number; created_at: string };
