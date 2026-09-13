export class LibraryValidationError extends Error {}
export type Food = { id: string; user_id: string; name: string; serving_basis: string; serving_quantity: number; calories: number; protein: number; carbs: number; fat: number; source: string; created_at: string };
export type Utensil = { id: string; user_id: string; name: string; type: string; capacity_ml: number | null; diameter_cm: number | null; height_cm: number | null; reference_image_path: string | null; created_at: string };
export type Calibration = { user_id: string; utensil_id: string; food_id: string; full_serving_grams: number };
export type LibraryState = { status: "idle" | "error" | "success"; message: string };
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (form: FormData, key: string, max = 120) => {
  const value = form.get(key);
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new LibraryValidationError("Enter " + key.replaceAll("_", " ") + " (up to " + max + " characters).");
  return value.trim();
};
const number = (form: FormData, key: string, positive = false, optional = false) => {
  const raw = form.get(key);
  if (optional && (raw === null || raw === "")) return null;
  if (typeof raw !== "string" || !/^\d+(\.\d{1,2})?$/.test(raw.trim())) throw new LibraryValidationError("Enter a valid " + key.replaceAll("_", " ") + " with up to 2 decimal places.");
  const value = Number(raw);
  if (!Number.isFinite(value) || value > 1000000 || value < (positive ? 0.01 : 0)) throw new LibraryValidationError(key.replaceAll("_", " ") + " is outside the allowed range.");
  return value;
};
export function recordId(form: FormData, name = "id", optional = true) {
  const value = form.get(name);
  if (optional && (value === null || value === "")) return null;
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new LibraryValidationError("Choose a valid record.");
  return value;
}
export function parseFood(form: FormData) {
  const serving_basis = text(form, "serving_basis");
  if (!["g", "ml", "piece"].includes(serving_basis)) throw new LibraryValidationError("Choose grams, millilitres, or pieces.");
  return { name: text(form, "name"), serving_basis, serving_quantity: number(form, "serving_quantity", true)!, calories: number(form, "calories")!, protein: number(form, "protein")!, carbs: number(form, "carbs")!, fat: number(form, "fat")!, source: text(form, "source", 240) };
}
export function parseUtensil(form: FormData) {
  const type = text(form, "type");
  if (!["bowl", "plate", "cup", "glass", "spoon", "other"].includes(type)) throw new LibraryValidationError("Choose a valid utensil type.");
  return { name: text(form, "name"), type, capacity_ml: number(form, "capacity_ml", true, true), diameter_cm: number(form, "diameter_cm", true, true), height_cm: number(form, "height_cm", true, true) };
}
export function parseCalibration(form: FormData) {
  return { utensil_id: recordId(form, "utensil_id", false)!, food_id: recordId(form, "food_id", false)!, full_serving_grams: number(form, "full_serving_grams", true)! };
}
export async function validateImage(file: File): Promise<string> {
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) throw new LibraryValidationError("Choose an image smaller than 3 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
  const webp = String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  if (file.type === "image/jpeg" && jpeg) return "jpg";
  if (file.type === "image/png" && png) return "png";
  if (file.type === "image/webp" && webp) return "webp";
  throw new LibraryValidationError("Choose a JPEG, PNG, or WebP image with matching file contents.");
}
