"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { analyzeMealPhoto, saveReviewedPhoto } from "@/lib/nutrition/photo-repository";
import type { PhotoState } from "@/lib/nutrition/photo-model";
export async function analyzePhoto(_previous: PhotoState, form: FormData): Promise<PhotoState> {
  let state: PhotoState;
  try { state = await analyzeMealPhoto(form); } catch { state = { status: "error", message: "Photo logging is unavailable. Please retry." }; }
  if (state.status === "success" && state.draftId) redirect(`/nutrition/photo?draft=${state.draftId}`);
  return state;
}
export async function confirmPhoto(_previous: PhotoState, form: FormData): Promise<PhotoState> {
  const state = await saveReviewedPhoto(form);
  if (state.status === "success") { revalidatePath("/nutrition"); revalidatePath("/nutrition/photo"); redirect("/nutrition"); }
  return state;
}
