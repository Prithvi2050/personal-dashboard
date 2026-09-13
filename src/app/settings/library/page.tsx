import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Utensils } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LibraryForm } from "@/components/library/library-form";
import { FoodSearch } from "@/components/library/food-search";
import { loadLibrary } from "@/lib/library/repository";
const card="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/80";
export default async function LibraryPage() {
  let result;
  try {result=await loadLibrary();} catch {result={status:"error"} as const;}
  if(result.status==="unauthenticated")redirect("/sign-in?next=/settings/library");
  if(result.status==="error")return <section role="alert" className={card}><h1 className="text-2xl font-bold">Your library is not available yet</h1><p className="mt-3 text-muted-foreground">We could not load your foods and utensils. If setup is complete, please try again.</p><a href="/settings/library" className="mt-5 inline-block rounded-full bg-primary px-5 py-3 text-primary-foreground">Try again</a></section>;
  const {foods,utensils,calibrations}=result;
  return <div className="space-y-8">
    <PageHeader eyebrow="Settings · Personal library" title="Foods & utensils" description="Keep your familiar foods and kitchenware ready for simpler meal logging."/>
    <nav aria-label="Library sections" className="flex flex-wrap gap-4 text-sm font-semibold text-primary"><a href="#foods" className="underline underline-offset-4">Foods ({foods.length})</a><a href="#utensils" className="underline underline-offset-4">Utensils ({utensils.length})</a><a href="#calibrations" className="underline underline-offset-4">Calibrations ({calibrations.length})</a><Link href="/settings" className="underline underline-offset-4">Back to Settings</Link></nav>
    <section id="foods" className="scroll-mt-6 space-y-4">
      <h2 className="text-2xl font-bold">Personal foods</h2><p className="text-sm text-muted-foreground">Find nutrition automatically, then reuse saved foods with your utensils. Your reference photos, dimensions, and food-specific weights stay unchanged.</p>
      <FoodSearch/>
      <details className={card}><summary className="cursor-pointer rounded font-semibold text-primary focus-visible:outline-2">Add a food manually (optional)</summary><LibraryForm kind="food"/></details>
      {!foods.length?<p className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">No foods yet. Add your first food above.</p>:<div className="grid gap-4 lg:grid-cols-2">{foods.map(food=><article key={food.id} className={card}><h3 className="font-bold">{food.name}</h3><p className="mt-2 text-sm text-muted-foreground">Per {food.serving_quantity} {food.serving_basis} · {food.calories} kcal</p><p className="mt-1 text-sm text-muted-foreground">Protein {food.protein} g · Carbs {food.carbs} g · Fat {food.fat} g</p><p className="mt-2 break-words text-xs text-muted-foreground">Source: {food.source}</p><details className="mt-4"><summary className="cursor-pointer rounded text-sm font-semibold text-primary focus-visible:outline-2">Edit {food.name}</summary><LibraryForm kind="food" initial={food}/></details></article>)}</div>}
    </section>
    <section id="utensils" className="scroll-mt-6 space-y-4"><h2 className="text-2xl font-bold">Your utensils</h2><p className="text-sm text-muted-foreground">Record physical capacity and dimensions if known. A photo helps you recognize the right utensil.</p>
      <details className={card}><summary className="cursor-pointer rounded font-semibold text-primary focus-visible:outline-2">Add a utensil</summary><LibraryForm kind="utensil"/></details>
      {!utensils.length?<p className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">No utensils yet. Start with a bowl, plate, or cup you use often.</p>:<div className="grid gap-4 lg:grid-cols-2">{utensils.map(utensil=><article key={utensil.id} className={card}><div className="flex gap-4">{utensil.imageUrl?<Image src={utensil.imageUrl} unoptimized width={96} height={96} alt={utensil.name+" reference photo"} className="size-24 rounded-2xl object-cover"/>:<div className="grid size-24 shrink-0 place-items-center rounded-2xl bg-muted"><Utensils aria-label="No reference photo" className="size-6 text-muted-foreground"/></div>}<div><h3 className="font-bold">{utensil.name}</h3><p className="mt-1 text-sm capitalize text-muted-foreground">{utensil.type}</p><p className="mt-2 text-xs text-muted-foreground">{utensil.capacity_ml===null?"Capacity not set":utensil.capacity_ml+" ml capacity"}{utensil.diameter_cm!==null?" · "+utensil.diameter_cm+" cm diameter":""}{utensil.height_cm!==null?" · "+utensil.height_cm+" cm height":""}</p>{utensil.reference_image_path&&!utensil.imageUrl?<p className="mt-2 text-xs text-destructive">Photo unavailable. Refresh to retry.</p>:null}</div></div><details className="mt-4"><summary className="cursor-pointer rounded text-sm font-semibold text-primary focus-visible:outline-2">Edit {utensil.name}</summary><LibraryForm kind="utensil" initial={{...utensil,imageUrl:null}}/></details></article>)}</div>}
    </section>
    <section id="calibrations" className="scroll-mt-6 space-y-4"><h2 className="text-2xl font-bold">Food-specific calibration</h2><p className="max-w-3xl text-sm leading-6 text-muted-foreground">A full bowl of rice and a full bowl of dal can weigh differently. Measure the food alone, excluding the utensil, and save its full-serving weight. Millilitres are not treated as grams.</p>
      {!foods.length||!utensils.length?<p className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">Add at least one food and one utensil to create a calibration.</p>:<div className={card}><h3 className="font-semibold">Add or update a calibration</h3><p className="mt-2 text-sm text-muted-foreground">Saving the same food and utensil pair replaces its previous weight.</p><LibraryForm kind="calibration" foods={foods} utensils={utensils}/></div>}
      {calibrations.length?<ul className="divide-y divide-border rounded-2xl border border-border">{calibrations.map(profile=><li key={profile.utensil_id+profile.food_id} className="flex flex-wrap justify-between gap-2 p-4 text-sm"><span>{utensils.find(u=>u.id===profile.utensil_id)?.name} · {foods.find(f=>f.id===profile.food_id)?.name}</span><strong>{profile.full_serving_grams} g when full</strong></li>)}</ul>:<p className="text-sm text-muted-foreground">No food-specific weights saved yet.</p>}
    </section>
  </div>;
}
