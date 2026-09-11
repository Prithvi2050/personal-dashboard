"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { persistSettings } from "@/lib/settings/repository";
import { validateSettings, type SaveState } from "@/lib/settings/validation";

export async function saveSettings(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const parsed = validateSettings(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields. Your changes have not been saved.", errors: parsed.errors };
  let result;
  try { result = await persistSettings(parsed.data); }
  catch { return { status: "error", message: "We could not save your settings. Please try again; your entries are still here." }; }
  if (result.status === "unauthenticated") return { status: "error", message: "Your session has expired. Sign in again before saving." };
  if (result.status === "error") return { status: "error", message: "Settings could not be saved. Please retry. If this continues, contact the dashboard administrator." };
  revalidatePath("/settings");
  revalidatePath("/onboarding");
  revalidatePath("/");
  if (formData.get("intent") === "onboarding") redirect("/");
  return { status: "success", message: "Settings saved. Your preferences will be here when you return." };
}
