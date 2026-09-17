"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { confirmPhoto } from "@/app/nutrition/photo/actions";
import type { Food, Utensil, Calibration } from "@/lib/library/model";
import type { Analysis } from "@/lib/ai/meal-vision";
import { confidenceLabel, type ReviewedItem, type PhotoState } from "@/lib/nutrition/photo-model";
import { calculatePortion, fractions } from "@/lib/nutrition/quick-meal";
import { mealTypes, totalMacros } from "@/lib/nutrition/daily";
const field = "mt-2 block w-full rounded-xl border border-input bg-background p-3 text-sm";
const initial: PhotoState = { status: "idle", message: "" };
export function PhotoReview({ draftId, analysis, foods, utensils, calibrations }: { draftId: string; analysis: Analysis; foods: Food[]; utensils: Utensil[]; calibrations: Calibration[] }) {
  const [state, action, pending] = useActionState(confirmPhoto, initial);
  const [items, setItems] = useState<ReviewedItem[]>(() => analysis.items.map((d, index) => {
    const food = foods.find(f => f.id === d.food_id);
    const canSuggest = d.confidence >= 0.6 && food;
    const calibrated = canSuggest && food.serving_basis === "g" && d.fraction && calibrations.some(c => c.food_id === food.id && c.utensil_id === d.utensil_id);
    return { food_id: canSuggest ? food.id : "", utensil_id: calibrated ? d.utensil_id : null, fraction: calibrated ? d.fraction : null,
      quantity: canSuggest && !calibrated ? d.quantity : null, source_index: index, reviewed: Boolean(d.confidence > 0.85 && canSuggest && (calibrated || d.quantity)) };
  }));
  const [type, setType] = useState("Lunch");
  const update = (index: number, patch: Partial<ReviewedItem>) => setItems(items.map((item, i) => i === index ? { ...item, reviewed: false, ...patch } : item));
  const calculated = items.map(item => { try { const food = foods.find(f => f.id === item.food_id); return food ? calculatePortion(food, item, calibrations) : null; } catch { return null; } });
  const totals = totalMacros(calculated.flatMap(value => value ? [value] : []));
  const valid = items.length > 0 && items.every((item, i) => calculated[i] && item.reviewed);
  return <form action={action} className="space-y-5">
    <input type="hidden" name="request_id" value={draftId}/><input type="hidden" name="items" value={JSON.stringify(items)}/>
    <h2 className="text-2xl font-bold">Review your meal</h2>
    <p className="text-sm text-muted-foreground">AI suggestions are approximate, not measured quantities. Confirm food preparation and portions, especially hidden oil or ingredients. Calories come from your saved foods—not AI arithmetic.</p>
    {analysis.warning ? <p className="rounded-xl bg-muted p-4 text-sm">{analysis.warning}</p> : null}
    <fieldset disabled={pending} className="space-y-4">
      <legend className="sr-only">Food and portion review</legend>
      {!items.length ? <p className="text-muted-foreground">No foods selected. Add a saved food below, or try another photo.</p> : null}
      {items.map((item, index) => {
        const detection = item.source_index === null ? null : analysis.items[item.source_index];
        const food = foods.find(f => f.id === item.food_id);
        const options = food?.serving_basis === "g" ? calibrations.filter(c => c.food_id === food.id) : [];
        return <section key={index} className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-border">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{detection?.name ?? "Added food"}</h3>{detection ? <><p className="mt-1 text-sm text-primary">{confidenceLabel(detection.confidence)}</p><p className="mt-1 text-xs text-muted-foreground">Model confidence {Math.round(detection.confidence * 100)}% (not a measured accuracy score). {detection.note}</p></> : null}</div><button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} className="text-sm text-primary underline" aria-label={`Remove food ${index + 1}`}>Remove</button></div>
          <label className="block text-sm font-semibold">Match to saved food<select className={field} value={item.food_id} onChange={e => update(index, { food_id: e.target.value, utensil_id: null, fraction: null, quantity: null })}><option value="">Choose the food</option>{foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <label className="block text-sm font-semibold">Portion reference<select className={field} value={item.utensil_id ?? "exact"} onChange={e => update(index, e.target.value === "exact" ? { utensil_id: null, fraction: null, quantity: null } : { utensil_id: e.target.value, fraction: 1, quantity: null })}>
            <option value="exact">Quantity ({food?.serving_basis ?? "choose a food first"})</option>{options.map(c => <option key={c.utensil_id} value={c.utensil_id}>{utensils.find(u => u.id === c.utensil_id)?.name} (calibrated)</option>)}
          </select></label>
          {item.utensil_id ? <div role="group" aria-label={`Fullness for food ${index + 1}`} className="flex gap-2">{fractions.map((f, i) => <button type="button" key={f} onClick={() => update(index, { fraction: f })} aria-pressed={item.fraction === f} className={"rounded-full border px-4 py-2 text-sm " + (item.fraction === f ? "bg-primary text-primary-foreground" : "border-border")}>{["¼", "½", "¾", "Full"][i]}</button>)}</div> : <label className="block text-sm font-semibold">Quantity ({food?.serving_basis ?? "—"})<input className={field} type="number" min="0.01" max="10000" step="0.01" value={item.quantity ?? ""} onChange={e => update(index, { quantity: e.target.value === "" ? null : Number(e.target.value) })}/></label>}
          <p aria-live="polite" className="text-sm text-muted-foreground">{calculated[index] ? `${calculated[index]!.quantity} ${food?.serving_basis} · ${calculated[index]!.calories} kcal · P ${calculated[index]!.protein} g · C ${calculated[index]!.carbs} g · F ${calculated[index]!.fat} g` : "Choose a valid food and portion to calculate nutrition."}</p>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={item.reviewed} disabled={!calculated[index]} onChange={e => update(index, { reviewed: e.target.checked })}/>Food and portion reviewed</label>
        </section>;
      })}
      <div className="flex flex-wrap gap-4"><button type="button" disabled={items.length >= 20} onClick={() => setItems([...items, { food_id: "", utensil_id: null, fraction: null, quantity: null, source_index: null, reviewed: false }])} className="text-sm text-primary underline">Add a missed food</button><Link href="/settings/library" target="_blank" className="text-sm text-primary underline">Find a missing food in the library (new tab)</Link></div>
      <p className="text-xs text-muted-foreground">If you add a library food in another tab, reload this review to see it. Your original analysis stays saved; unsaved review edits reset.</p>
      <label className="block max-w-xs text-sm font-semibold">Meal type<select name="meal_type" value={type} onChange={e => setType(e.target.value)} className={field}>{mealTypes.map(t => <option key={t}>{t}</option>)}</select></label>
      <p aria-live="polite" className="font-bold">{valid ? "Meal total" : "Partial preview — finish the review"}: {totals.calories} kcal · P {totals.protein} g · C {totals.carbs} g · F {totals.fat} g</p>
      <button disabled={!valid || pending} className="rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Saving…" : "Confirm & save meal"}</button>
    </fieldset>
    <p role={state.status === "error" ? "alert" : "status"} className="text-sm text-muted-foreground">{state.message}</p>
  </form>;
}
