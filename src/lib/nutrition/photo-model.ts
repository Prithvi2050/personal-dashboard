import type { Analysis } from "../ai/meal-vision";
import type { QuickItem } from "./quick-meal";
export type PhotoDraft = { id: string; user_id: string; status: "processing" | "ready" | "failed"; photo_path: string; model: string; result: Analysis | null; reference_ids: string[]; meal_id: string | null; created_at: string };
export type PhotoState = { status: "idle" | "error" | "success"; message: string; draftId?: string };
export type ReviewedItem = QuickItem & { source_index: number | null; reviewed: boolean };
export function confidenceLabel(value: number): string { return value > 0.85 ? "Suggested — still an estimate" : value >= 0.6 ? "Please verify food and portion" : "Uncertain — choose the food and portion"; }
