"use client";

import { useActionState, useState } from "react";
import { importFood, searchFoods } from "@/app/settings/library/actions";
import type { FoodMatch, FoodSearchState } from "@/lib/library/food-data";
import type { LibraryState } from "@/lib/library/model";

const button = "rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4";
const initialSearch: FoodSearchState = { status: "idle", message: "", foods: [] };
const initialSave: LibraryState = { status: "idle", message: "" };

function FoodResult({ food }: { food: FoodMatch }) {
  const [state, action, pending] = useActionState(importFood, initialSave);
  return <li className="space-y-3 rounded-2xl border border-border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h4 className="break-words font-semibold">{food.name}</h4>
        <p className="mt-1 text-xs text-muted-foreground">USDA · {food.dataType} · Per 100 g</p>
      </div>
      <form action={action}>
        <input type="hidden" name="fdcId" value={food.fdcId}/>
        <button className={button} disabled={pending || state.status === "success"} aria-label={`Save ${food.name} to my foods`}>
          {pending ? "Saving…" : state.status === "success" ? "Saved" : "Save to my foods"}
        </button>
      </form>
    </div>
    <p className="text-sm">{food.calories} kcal · Protein {food.protein} g · Carbs {food.carbs} g · Fat {food.fat} g</p>
    <a className="text-xs text-primary underline underline-offset-4" href={`https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`} target="_blank" rel="noreferrer">View USDA source (new tab)</a>
    <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{state.message}</p>
  </li>;
}

export function FoodSearch() {
  const [state, action, pending] = useActionState(searchFoods, initialSearch);
  const [query, setQuery] = useState("");
  return <div className="space-y-4 rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/80">
    <div><h3 className="text-lg font-bold">Find a food — no nutrient typing</h3>
      <p className="mt-2 text-sm text-muted-foreground">Search USDA, choose the matching preparation, and save once for reuse. Match cooked with cooked and raw with raw. Generic dish values are estimates; recipes vary.</p></div>
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1"><label htmlFor="food-query" className="mb-2 block text-sm font-medium">Food name</label>
        <input id="food-query" name="query" value={query} onChange={event => setQuery(event.target.value)} required minLength={2} maxLength={80} placeholder="Try cooked rice, boiled egg, or lentils" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"/>
      </div>
      <button disabled={pending} className={button}>{pending ? "Searching…" : "Search foods"}</button>
    </form>
    <p className="text-xs text-muted-foreground">Only the search text is sent to USDA—not your profile, photos, or utensil details. Packaged foods can still be entered from their label below.</p>
    <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{pending ? "Looking up nutrition…" : state.message}</p>
    {!pending && state.foods.length > 0 ? <ul className="space-y-3">{state.foods.map(food => <FoodResult key={food.fdcId} food={food}/>)}</ul> : null}
  </div>;
}
