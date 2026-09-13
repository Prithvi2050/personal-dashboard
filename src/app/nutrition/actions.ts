"use server";
import { revalidatePath } from "next/cache";
import { persistQuickMeal } from "@/lib/nutrition/repository";
import type { QuickMealState } from "@/lib/nutrition/quick-meal";
export async function saveQuickMeal(_previous: QuickMealState, form: FormData): Promise<QuickMealState> {
  const state = await persistQuickMeal(form);
  if (state.status === "success") revalidatePath("/nutrition");
  return state;
}
