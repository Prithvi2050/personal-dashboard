import { createClient } from "@/lib/supabase/server";
import type { SettingsValues } from "@/lib/settings/validation";

export async function loadSettings() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { status: "unauthenticated" } as const;
  const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
  if (error || !data) return { status: "error" } as const;
  return { status: "ready", settings: data, email: user.email ?? "Google account" } as const;
}

export async function persistSettings(values: SettingsValues) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { status: "unauthenticated" } as const;
  // Identity is derived by the function from auth.uid(), never from form input.
  const { error } = await supabase.rpc("save_user_settings", {
    p_calories: values.daily_calorie_goal!, p_protein: values.daily_protein_goal!,
    p_carbs: values.daily_carbs_goal, p_fat: values.daily_fat_goal,
    p_budget: values.monthly_spending_budget!, p_timezone: values.timezone,
  });
  return { status: error ? "error" : "success" } as const;
}
