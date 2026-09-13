"use client";
import { useActionState, useId, useState } from "react";
import { saveLibrary } from "@/app/settings/library/actions";
import { MAX_IMAGE_BYTES, type Food, type Utensil, type LibraryState } from "@/lib/library/model";
type Field = { name: string; label: string; type?: string; optional?: boolean; options?: {value:string;label:string}[] };
const options = (values:string[]) => values.map(value=>({value,label:value}));
const fields: Record<string,Field[]> = {
  food: [
    {name:"name",label:"Food name"}, {name:"serving_quantity",label:"Serving quantity",type:"number"},
    {name:"serving_basis",label:"Serving unit",options:options(["g","ml","piece"])},
    {name:"calories",label:"Calories per serving (kcal)",type:"number"},
    {name:"protein",label:"Protein per serving (g)",type:"number"},
    {name:"carbs",label:"Carbohydrates per serving (g)",type:"number"},
    {name:"fat",label:"Fat per serving (g)",type:"number"},
    {name:"source",label:"Nutrition source (e.g. product label)"},
  ],
  utensil: [
    {name:"name",label:"Utensil name"},
    {name:"type",label:"Type",options:options(["bowl","plate","cup","glass","spoon","other"])},
    {name:"capacity_ml",label:"Capacity (ml)",type:"number",optional:true},
    {name:"diameter_cm",label:"Diameter (cm)",type:"number",optional:true},
    {name:"height_cm",label:"Height (cm)",type:"number",optional:true},
  ],
};
const inputStyle="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary";
export function LibraryForm({kind, initial={}, foods=[], utensils=[]}:{
  kind:"food"|"utensil"|"calibration"; initial?:Record<string,string|number|null>;
  foods?:Food[]; utensils?:Utensil[];
}) {
  const prefix=useId();
  const [state,action,pending]=useActionState(saveLibrary.bind(null,kind),{status:"idle",message:""} as LibraryState);
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(Object.entries(initial).map(([k,v])=>[k,v===null?"":String(v)])));
  const [fileError,setFileError]=useState("");
  const formFields=kind==="calibration"?[
    {name:"utensil_id",label:"Utensil",options:utensils.map(u=>({value:u.id,label:u.name}))},
    {name:"food_id",label:"Food",options:foods.map(f=>({value:f.id,label:f.name}))},
    {name:"full_serving_grams",label:"Food weight when full (g)",type:"number"},
  ]:fields[kind];
  return <form action={action} className="mt-5 space-y-4">
    {initial.id ? <input type="hidden" name="id" value={String(initial.id)} />:null}
    <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
      {formFields.map((field:Field)=><div key={field.name}>
        <label htmlFor={prefix+field.name} className="text-sm font-semibold">{field.label}{field.optional?<span className="font-normal text-muted-foreground"> · optional</span>:null}</label>
        {field.options?<select id={prefix+field.name} name={field.name} required value={values[field.name]??""} onChange={e=>setValues({...values,[field.name]:e.target.value})} className={inputStyle}>
          <option value="" disabled>Choose…</option>{field.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
        </select>:<input id={prefix+field.name} name={field.name} type={field.type??"text"} required={!field.optional} maxLength={field.name==="source"?240:120} min={["calories","protein","carbs","fat"].includes(field.name)?0:0.01} max={1000000} step="0.01" value={values[field.name]??""} onChange={e=>setValues({...values,[field.name]:e.target.value})} className={inputStyle}/>}
      </div>)}
      {kind==="utensil"?<div className="sm:col-span-2"><label htmlFor={prefix+"image"} className="text-sm font-semibold">Reference photo · optional</label><input id={prefix+"image"} type="file" name="image" accept="image/jpeg,image/png,image/webp" aria-describedby={prefix+"image-help"} className={inputStyle} onChange={e=>{
        const file=e.target.files?.[0];
        const invalid=file&&(file.size>MAX_IMAGE_BYTES||!["image/jpeg","image/png","image/webp"].includes(file.type));
        setFileError(invalid?"Choose a JPEG, PNG, or WebP image up to 3 MB.":"");
        if(invalid)e.target.value="";
      }}/><p id={prefix+"image-help"} className="mt-2 text-xs text-muted-foreground">JPEG, PNG, WebP · up to 3 MB. Leave blank to keep your existing photo. A new upload replaces it.</p>{fileError?<p role="alert" className="text-sm text-destructive">{fileError}</p>:null}</div>:null}
    </fieldset>
    <div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={pending} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-60">{pending?"Saving…":initial.id?"Save changes":kind==="calibration"?"Save calibration":"Add "+kind}</button><p role={state.status==="error"?"alert":"status"} className={state.status==="error"?"text-sm text-destructive":"text-sm text-muted-foreground"}>{pending?"Saving to your library…":state.message}</p></div>
  </form>;
}
