"use client";
import Link from "next/link";
import Image from "next/image";
import { useActionState, useState } from "react";
import { saveQuickMeal } from "@/app/nutrition/actions";
import { calculatePortion, fractions, type QuickItem, type QuickMealState } from "@/lib/nutrition/quick-meal";
import { mealTypes, totalMacros } from "@/lib/nutrition/daily";
import type { Food, Utensil, Calibration } from "@/lib/library/model";
const button = "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4";
const field = "mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";
const initial: QuickMealState = { status: "idle", message: "" };
type Props = { foods: Food[]; utensils: (Utensil & { imageUrl: string | null })[]; calibrations: Calibration[]; requestId: string };

export function QuickMealForm(props: Props) {
  const [generation, setGeneration] = useState(props.requestId);
  return <MealDraft key={generation} {...props} requestId={generation} onNew={() => setGeneration(crypto.randomUUID())}/>;
}
function MealDraft({ foods, utensils, calibrations, requestId, onNew }: Props & { onNew: () => void }) {
  const [state, action, pending] = useActionState(saveQuickMeal, initial);
  const [foodId, setFoodId] = useState(foods[0]?.id ?? "");
  const food = foods.find(f => f.id === foodId);
  const available = food?.serving_basis === "g" ? calibrations.filter(c => c.food_id === food.id) : [];
  const [mode, setMode] = useState(available[0]?.utensil_id ?? "exact");
  const [fraction, setFraction] = useState(1);
  const [quantity, setQuantity] = useState(String(food?.serving_quantity ?? 100));
  const [items, setItems] = useState<QuickItem[]>([]);
  const [type, setType] = useState("Lunch");
  const [error, setError] = useState("");
  const utensil = utensils.find(u => u.id === mode);
  const current: QuickItem = { food_id: foodId, utensil_id: mode === "exact" ? null : mode, fraction: mode === "exact" ? null : fraction, quantity: mode === "exact" ? Number(quantity) : null };
  let preview;
  try { preview = food ? calculatePortion(food, current, calibrations) : null; } catch { preview = null; }
  const totals = totalMacros(items.flatMap(item => {
    const selected = foods.find(f => f.id === item.food_id);
    try { return selected ? [calculatePortion(selected, item, calibrations)] : []; } catch { return []; }
  }));
  const locked = pending || state.status === "success";
  if (!foods.length) return <div className="rounded-3xl bg-card p-6 ring-1 ring-border"><h2 className="text-xl font-bold">Log a meal</h2><p className="mt-3 text-muted-foreground">Save a food first—nutrition lookup fills in its values automatically.</p><Link href="/settings/library" className="mt-4 inline-block text-primary underline">Find foods and set up utensils</Link></div>;
  return <section id="quick-log" className="space-y-5 rounded-3xl bg-card p-6 ring-1 ring-border">
    <h2 className="text-xl font-bold">Log a meal for today</h2>
    <p className="text-sm text-muted-foreground">Choose food → portion → add → confirm. Calibrations estimate food weight; millilitres are never assumed to equal grams.</p>
    <fieldset disabled={locked} className="space-y-4">
      <legend className="sr-only">Choose food and portion</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Food<select className={field} value={foodId} onChange={event => {
          const next = foods.find(f => f.id === event.target.value)!;
          setFoodId(next.id); setQuantity(String(next.serving_quantity)); setFraction(1);
          setMode(next.serving_basis === "g" ? calibrations.find(c => c.food_id === next.id)?.utensil_id ?? "exact" : "exact");
        }}>{foods.map(f => <option value={f.id} key={f.id}>{f.name}</option>)}</select></label>
        <label className="text-sm font-medium">Measure with<select className={field} value={mode} onChange={event => setMode(event.target.value)}>
          {available.map(c => <option key={c.utensil_id} value={c.utensil_id}>{utensils.find(u => u.id === c.utensil_id)?.name} (calibrated)</option>)}
          <option value="exact">Exact quantity ({food?.serving_basis})</option>
        </select></label>
      </div>
      {mode === "exact" ? <label className="block max-w-xs text-sm font-medium">Quantity ({food?.serving_basis})<input className={field} type="number" min="0.01" max="10000" step="0.01" value={quantity} onChange={event => setQuantity(event.target.value)}/></label> : <div className="flex flex-wrap items-center gap-4">
        {utensil?.imageUrl ? <Image unoptimized src={utensil.imageUrl} alt={`${utensil.name} reference`} width={64} height={64} className="size-16 rounded-xl object-cover"/> : null}
        <div role="group" aria-label="Utensil fullness" className="flex gap-2">{fractions.map((value, index) => <button type="button" key={value} aria-pressed={fraction === value} className={fraction === value ? button : "rounded-full border border-border px-4 py-2 text-sm"} onClick={() => setFraction(value)}>{["¼", "½", "¾", "Full"][index]}</button>)}</div>
      </div>}
      <p aria-live="polite" className="text-sm text-muted-foreground">{preview ? `${preview.quantity} ${food?.serving_basis} · ${preview.calories} kcal · P ${preview.protein} g · C ${preview.carbs} g · F ${preview.fat} g` : "Choose a valid food and quantity."}</p>
      {!available.length ? <Link href="/settings/library#calibrations" className="block text-sm text-primary underline">Set up a food-specific utensil weight for faster portions</Link> : null}
      <button type="button" disabled={!preview || items.length >= 20} className={button} onClick={() => {
        if (mode === "exact" && !/^\d+(\.\d{1,2})?$/.test(quantity)) { setError("Use up to two decimal places."); return; }
        setItems([...items, current]); setError("");
      }}>Add food to meal</button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </fieldset>
    <form action={action} className="space-y-4 border-t border-border pt-5">
      <input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="items" value={JSON.stringify(items)}/>
      <label className="block max-w-xs text-sm font-medium">Meal type<select name="meal_type" value={type} onChange={e => setType(e.target.value)} disabled={locked} className={field}>{mealTypes.map(t => <option key={t}>{t}</option>)}</select></label>
      <ul className="space-y-2">{items.map((item, index) => <li key={index} className="flex items-center justify-between gap-3 text-sm"><span>{foods.find(f => f.id === item.food_id)?.name} · {item.utensil_id ? `${item.fraction! * 100}% ${utensils.find(u => u.id === item.utensil_id)?.name}` : `${item.quantity} ${foods.find(f => f.id === item.food_id)?.serving_basis}`}</span><button type="button" disabled={locked} aria-label={`Remove item ${index + 1}`} onClick={() => setItems(items.filter((_, i) => i !== index))} className="text-primary underline">Remove</button></li>)}</ul>
      <p className="font-semibold" aria-live="polite">Meal total: {totals.calories} kcal · P {totals.protein} g · C {totals.carbs} g · F {totals.fat} g</p>
      <p className="text-xs text-muted-foreground">Saved with the current time in your journal. Values are recalculated from your saved foods and calibrations when you confirm.</p>
      <button disabled={locked || !items.length} className={button}>{pending ? "Saving…" : state.status === "success" ? "Saved" : "Confirm & save meal"}</button>
      <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{state.message}</p>
      {state.status === "success" ? <button type="button" onClick={onNew} className="text-sm font-semibold text-primary underline">Log another meal</button> : null}
    </form>
  </section>;
}
