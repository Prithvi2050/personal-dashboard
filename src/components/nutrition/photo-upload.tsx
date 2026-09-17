"use client";
import { useActionState, useState } from "react";
import { analyzePhoto } from "@/app/nutrition/photo/actions";
import type { PhotoState } from "@/lib/nutrition/photo-model";
const initial: PhotoState = { status: "idle", message: "" };
type Props = { requestId: string; utensils: { id: string; name: string; reference_image_path: string | null }[] };
export function PhotoUpload(props: Props) {
  const [id, setId] = useState(props.requestId);
  return <Upload key={id} {...props} requestId={id} restart={() => setId(crypto.randomUUID())}/>;
}
function Upload({ requestId, utensils, restart }: Props & { restart: () => void }) {
  const [state, action, pending] = useActionState(analyzePhoto, initial);
  const [error, setError] = useState("");
  return <form action={action} className="space-y-5 rounded-3xl bg-card p-6 ring-1 ring-border">
    <input type="hidden" name="request_id" value={requestId}/>
    <fieldset disabled={pending} className="space-y-5">
      <legend className="text-xl font-bold">Photograph your meal</legend>
      <p className="text-sm text-muted-foreground">Keep the whole meal and utensil visible. Photograph from a slight angle so the portion depth is visible.</p>
      <label className="block text-sm font-semibold">Meal photo<input className="mt-2 block w-full rounded-xl border border-input p-3" name="image" type="file" required accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => {
        const file = event.target.files?.[0];
        if (file && file.size > 3 * 1024 * 1024) { event.target.value = ""; setError("Choose an image up to 3 MB."); } else setError("");
      }}/></label>
      <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · up to 3 MB / 20 megapixels. Images are resized and location metadata is removed. No HEIC or animated images yet.</p>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Utensils in this meal (up to three)</legend>
        {utensils.length ? utensils.map(u => <label key={u.id} className="flex items-center gap-3 text-sm"><input type="checkbox" name="reference_id" value={u.id} defaultChecked={utensils.length <= 3}/>{u.name}{u.reference_image_path ? " · reference photo" : " · dimensions only"}</label>) : <p className="text-sm text-muted-foreground">No saved utensils. The app may ask you for a portion quantity.</p>}
      </fieldset>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" name="consent" value="yes" required className="mt-1.5"/><span>Send this meal photo, selected utensil photos/dimensions and saved food names to OpenAI for analysis. API charges apply. The meal photo and result are retained privately in my Supabase project.</span></label>
      <button disabled={pending || Boolean(error)} className="rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Uploading and analyzing…" : "Analyze photo"}</button>
    </fieldset>
    <p role={state.status === "error" || error ? "alert" : "status"} className="text-sm text-muted-foreground">{pending ? "This may take about a minute. Do not submit again; no meal is saved until you confirm the review." : error || state.message}</p>
    {state.status === "error" ? <button type="button" onClick={restart} className="text-sm text-primary underline">Start a new attempt (may incur another charge)</button> : null}
  </form>;
}
