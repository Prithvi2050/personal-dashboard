export const numberFields = ["daily_calorie_goal", "daily_protein_goal", "daily_carbs_goal", "daily_fat_goal", "monthly_spending_budget"] as const;
export type NumberField = typeof numberFields[number];
export type SettingsField = NumberField | "timezone";
export type SettingsValues = Record<NumberField, number | null> & { timezone: string };
export type FieldErrors = Partial<Record<SettingsField, string>>;
export type SaveState = { status: "idle" | "error" | "success"; message: string; errors?: FieldErrors };

export function validateSettings(input: Record<string, unknown>):
  { success: true; data: SettingsValues } | { success: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const values: SettingsValues = { daily_calorie_goal: null, daily_protein_goal: null, daily_carbs_goal: null, daily_fat_goal: null, monthly_spending_budget: null, timezone: "" };
  for (const field of numberFields) {
    const raw = input[field];
    const optional = field === "daily_carbs_goal" || field === "daily_fat_goal";
    if (typeof raw !== "string") { errors[field] = "Enter a number."; continue; }
    const value = raw.trim();
    if (!value && optional) continue;
    if (!value) { errors[field] = "This field is required."; continue; }
    const parsed = Number(value);
    const minimum = field === "daily_calorie_goal" || field === "daily_protein_goal" ? 0.01 : 0;
    if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(parsed) || parsed < minimum || parsed > 1_000_000_000) {
      errors[field] = minimum > 0 ? "Enter a positive number with up to 2 decimal places (maximum 1 billion)." : "Enter zero or a positive number with up to 2 decimal places (maximum 1 billion).";
    } else values[field] = parsed;
  }
  const timezone = typeof input.timezone === "string" ? input.timezone.trim() : "";
  try {
    if (!timezone || timezone.length > 100 || /^[+-]/.test(timezone)) throw new Error("Invalid timezone");
    values.timezone = new Intl.DateTimeFormat("en", { timeZone: timezone }).resolvedOptions().timeZone;
  } catch { errors.timezone = "Choose a valid timezone, such as Asia/Kolkata."; }
  return Object.keys(errors).length ? { success: false, errors } : { success: true, data: values };
}
