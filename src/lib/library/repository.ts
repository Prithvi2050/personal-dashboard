import { createClient } from "@/lib/supabase/server";
import { parseFood, parseUtensil, parseCalibration, recordId, validateImage, LibraryValidationError, type LibraryState } from "@/lib/library/model";
const bucket = "utensil-images";

export async function loadLibrary() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { status: "unauthenticated" } as const;
  const [foods, utensils, calibrations] = await Promise.all([
    supabase.from("foods").select("*").eq("user_id", user.id).order("name"),
    supabase.from("utensils").select("*").eq("user_id", user.id).order("name"),
    supabase.from("utensil_food_profiles").select("*").eq("user_id", user.id),
  ]);
  if (foods.error || utensils.error || calibrations.error) return { status: "error" } as const;
  const images = await Promise.all(utensils.data.map(async (utensil) => {
    if (!utensil.reference_image_path) return { ...utensil, imageUrl: null };
    const { data } = await supabase.storage.from(bucket).createSignedUrl(utensil.reference_image_path, 900);
    return { ...utensil, imageUrl: data?.signedUrl ?? null };
  }));
  return { status: "ready", foods: foods.data, utensils: images, calibrations: calibrations.data } as const;
}

export async function saveLibraryRecord(kind: string, form: FormData): Promise<LibraryState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { status: "error", message: "Please sign in again before saving." };
  let uploadPath: string | null = null;
  let uploadSaved = false;
  try {
    // Validation errors are our own bounded messages, never raw provider errors.
    const id = recordId(form);
    if (kind === "food") {
      const values = { ...parseFood(form), user_id: user.id };
      const query = id ? supabase.from("foods").update(values).eq("id", id).eq("user_id", user.id) : supabase.from("foods").insert(values);
      const { data, error } = await query.select("id").single();
      if (error || !data) return { status: "error", message: "Food could not be saved. Check your connection and try again." };
    } else if (kind === "utensil") {
      const values = parseUtensil(form);
      let previousPath: string | null = null;
      if (id) {
        const { data, error } = await supabase.from("utensils").select("reference_image_path").eq("id", id).eq("user_id", user.id).single();
        if (error || !data) return { status: "error", message: "This utensil is unavailable." };
        previousPath = data.reference_image_path;
      }
      const file = form.get("image");
      if (file instanceof File && file.size > 0) {
        const extension = await validateImage(file);
        uploadPath = user.id + "/" + crypto.randomUUID() + "." + extension;
        const { error } = await supabase.storage.from(bucket).upload(uploadPath, file, { contentType: file.type, upsert: false });
        if (error) return { status: "error", message: "The photo could not be uploaded. Re-select it and retry." };
      }
      const record = { ...values, user_id: user.id, reference_image_path: uploadPath ?? previousPath };
      const query = id ? supabase.from("utensils").update(record).eq("id", id).eq("user_id", user.id) : supabase.from("utensils").insert(record);
      const { data, error } = await query.select("id").single();
      if (error || !data) {
        if (uploadPath) await supabase.storage.from(bucket).remove([uploadPath]);
        return { status: "error", message: "Utensil could not be saved. Your previous record is unchanged; please retry." };
      }
      uploadSaved = true;
      if (uploadPath && previousPath) await supabase.storage.from(bucket).remove([previousPath]).catch(() => undefined);
    } else if (kind === "calibration") {
      const values = parseCalibration(form);
      const { error } = await supabase.from("utensil_food_profiles").upsert({ ...values, user_id: user.id }, { onConflict: "utensil_id,food_id" });
      if (error) return { status: "error", message: "Calibration could not be saved. Choose a food and utensil from your own library." };
    } else return { status: "error", message: "Unknown library operation." };
  } catch (error) {
    // Network errors must not expose service messages or credentials.
    if (uploadPath && !uploadSaved) await supabase.storage.from(bucket).remove([uploadPath]).catch(() => undefined);
    const message = error instanceof LibraryValidationError ? error.message : "Could not save. Please retry and re-select any photo.";
    return { status: "error", message };
  }
  return { status: "success", message: "Saved to your personal library." };
}
