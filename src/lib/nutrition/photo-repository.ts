import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadLibrary } from "@/lib/library/repository";
import { uuidPattern } from "@/lib/library/model";
import { preparePhoto } from "@/lib/nutrition/photo-image";
import { openAiVision, VisionError, type VisionContext } from "@/lib/ai/meal-vision";
import { parseMealInput, MealValidationError } from "@/lib/nutrition/quick-meal";
import type { PhotoState, ReviewedItem } from "@/lib/nutrition/photo-model";

export async function loadPhotoDrafts(id?: string) {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("Sign in required");
  const { data: drafts, error: readError } = await db.from("photo_drafts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
  if (readError) throw new Error("Apply the Sprint 7 migration first.");
  let draft = null;
  let imageUrl: string | null = null;
  if (id) {
    if (!uuidPattern.test(id)) throw new Error("Invalid draft");
    const result = await db.from("photo_drafts").select("*").eq("id", id).eq("user_id", user.id).single();
    if (result.error) throw new Error("Draft unavailable");
    draft = result.data;
    const signed = await db.storage.from("meal-images").createSignedUrl(draft.photo_path, 900);
    imageUrl = signed.data?.signedUrl ?? null;
  }
  return { drafts, draft, imageUrl };
}

export async function analyzeMealPhoto(form: FormData): Promise<PhotoState> {
  const db = await createClient();
  let claimedId: string | null = null;
  try {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new VisionError("Please sign in again.");
    if (form.get("consent") !== "yes") throw new VisionError("Confirm that this photo and selected references may be sent to OpenAI.");
    const id = form.get("request_id");
    if (typeof id !== "string" || !uuidPattern.test(id)) throw new VisionError("Refresh the photo page and retry.");
    // Read-only retry path: never run the provider twice for the same request ID.
    const existing = await db.from("photo_drafts").select("id,status").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (existing.error) throw new VisionError("Photo logging needs setup. Apply the Sprint 7 migration.");
    if (existing.data) return { status: "success", message: "Opening the saved analysis status.", draftId: id };
    const key = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_VISION_MODEL?.trim();
    if (!key || !model || model.length > 100) throw new VisionError("Add OPENAI_API_KEY and OPENAI_VISION_MODEL to .env.local, then restart the app.");
    const library = await loadLibrary();
    if (library.status !== "ready" || !library.foods.length) throw new VisionError("Save at least one food in your library first.");
    if (library.foods.length > 100) throw new VisionError("Photo matching currently supports up to 100 saved foods. Use quick logging for this larger library.");
    const ids = [...new Set(form.getAll("reference_id"))];
    if (ids.length > 3 || ids.some(id => typeof id !== "string" || !library.utensils.some(u => u.id === id))) throw new VisionError("Choose up to three of your utensils.");
    const file = form.get("image");
    if (!(file instanceof File)) throw new VisionError("Choose a meal photo.");
    let bytes: Buffer;
    try { bytes = await preparePhoto(new Uint8Array(await file.arrayBuffer()), file.type); } catch { throw new VisionError("Choose a valid, non-animated JPEG, PNG or WebP up to 3 MB and 20 megapixels."); }
    const context: VisionContext = { foods: library.foods.map(f => ({ id: f.id, name: f.name, serving_basis: f.serving_basis })), utensils: [] };
    for (const utensil of library.utensils.filter(u => ids.includes(u.id))) {
      let image: string | undefined;
      if (utensil.reference_image_path) {
        const download = await db.storage.from("utensil-images").download(utensil.reference_image_path);
        if (download.error) throw new VisionError("A selected utensil photo could not be loaded. Deselect it or refresh and retry.");
        try { image = "data:image/jpeg;base64," + (await preparePhoto(new Uint8Array(await download.data.arrayBuffer()), download.data.type, 768)).toString("base64"); }
        catch { throw new VisionError("A selected reference photo is invalid. Replace it in the library or deselect it."); }
      }
      context.utensils.push({ id: utensil.id, name: utensil.name, capacity_ml: utensil.capacity_ml, diameter_cm: utensil.diameter_cm, height_cm: utensil.height_cm, image });
    }
    const claim = await db.rpc("claim_photo_analysis", { p_id: id, p_model: model, p_references: ids as string[] });
    if (claim.error) throw new VisionError("Could not start analysis. Check setup or the limit of 20 analysis attempts per 24 hours.");
    if (!claim.data) return { status: "success", message: "Opening existing analysis.", draftId: id };
    claimedId = id;
    const upload = await db.storage.from("meal-images").upload(`${user.id}/${id}.jpg`, bytes, { contentType: "image/jpeg", upsert: false });
    if (upload.error) throw new VisionError("The photo could not be stored. No AI request was sent; start a new upload to retry.");
    const result = await openAiVision(key, model).analyze("data:image/jpeg;base64," + bytes.toString("base64"), context);
    const finish = await db.from("photo_drafts").update({ status: "ready", result }).eq("id", id).eq("user_id", user.id).eq("status", "processing").select("id").single();
    if (finish.error) throw new VisionError("Analysis ran but its result could not be confirmed as saved. Open recent analyses before starting a new attempt.");
    return { status: "success", message: "Ready for review.", draftId: id };
  } catch (error) {
    if (claimedId) await db.from("photo_drafts").update({ status: "failed" }).eq("id", claimedId).eq("status", "processing").then(() => undefined, () => undefined);
    return { status: "error", message: error instanceof VisionError ? error.message : "Photo analysis is unavailable. Please retry or use quick logging." };
  }
}

export async function saveReviewedPhoto(form: FormData): Promise<PhotoState> {
  try {
    const input = parseMealInput(form);
    const raw: unknown = JSON.parse(String(form.get("items")));
    if (!Array.isArray(raw)) throw new MealValidationError("Review the meal first.");
    const items: ReviewedItem[] = input.items.map((item, index) => {
      const row = raw[index];
      if (row.reviewed !== true || !(row.source_index === null || Number.isInteger(row.source_index) && row.source_index >= 0 && row.source_index < 20)) throw new MealValidationError("Confirm every food and portion before saving.");
      return { ...item, reviewed: true, source_index: row.source_index };
    });
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new MealValidationError("Please sign in again.");
    const saved = await db.rpc("save_photo_meal", { p_draft_id: input.requestId, p_meal_type: input.type, p_items: items });
    if (saved.error || !saved.data) throw new MealValidationError("Could not save. Check the review, photo, migration and food calibrations, then retry the same draft safely.");
    return { status: "success", message: "Photo meal saved." };
  } catch (error) { return { status: "error", message: error instanceof MealValidationError ? error.message : "Could not confirm the save. Retry this draft safely; duplicate saves are prevented." }; }
}
