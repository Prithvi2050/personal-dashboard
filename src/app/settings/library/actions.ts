"use server";
import { revalidatePath } from "next/cache";
import { saveLibraryRecord } from "@/lib/library/repository";
import type { LibraryState } from "@/lib/library/model";
import { searchFoodData, importFoodData } from "@/lib/library/food-lookup";
import type { FoodSearchState } from "@/lib/library/food-data";
export async function searchFoods(_previous: FoodSearchState, form: FormData): Promise<FoodSearchState> {
  return searchFoodData(form.get("query"));
}
export async function importFood(_previous: LibraryState, form: FormData): Promise<LibraryState> {
  const state = await importFoodData(form.get("fdcId"));
  if (state.status === "success") revalidatePath("/settings/library");
  return state;
}
export async function saveLibrary(kind: string, _previous: LibraryState, form: FormData): Promise<LibraryState> {
  try {
    const state = await saveLibraryRecord(kind, form);
    if (state.status === "success") revalidatePath("/settings/library");
    return state;
  } catch { return { status: "error", message: "The library is unavailable. Please retry." }; }
}
