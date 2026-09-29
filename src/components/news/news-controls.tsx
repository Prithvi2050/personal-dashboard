"use client";
import { useActionState } from "react";
import { newsAction } from "@/app/settings/news/actions";
import { newsSources, type NewsActionState, type NewsPreference } from "@/lib/news/model";
const initial:NewsActionState={status:"idle",message:""};
const button="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50";
function Feedback({state}:{state:NewsActionState}){
  return state.message?<div role={state.status==="error"?"alert":"status"} className="rounded-xl border bg-muted/40 p-4 text-sm"><p>{state.message}</p>{state.details&&<ul className="mt-2 list-disc space-y-1 pl-5">{state.details.map(detail=><li key={detail}>{detail}</li>)}</ul>}</div>:null;
}
export function CollectNews({enabled}:{enabled:boolean}){
  const [state,action,pending]=useActionState(newsAction,initial);
  return <div className="space-y-3"><form action={action}><input type="hidden" name="operation" value="collect"/><button className={button} disabled={pending||!enabled}>{pending?"Collecting headlines…":"Collect latest headlines"}</button></form><p className="text-sm text-muted-foreground">Manual collection only. Each enabled source can be checked once every five minutes.</p><Feedback state={state}/></div>;
}
export function NewsSourceControls({preferences}:{preferences:NewsPreference[]}){
  const [state,action,pending]=useActionState(newsAction,initial);
  return <div className="space-y-4"><Feedback state={state}/><div className="grid gap-4 md:grid-cols-2">{newsSources.map(source=>{
    const preference=preferences.find(row=>row.source_id===source.id);const enabled=preference?.enabled??false;
    return <section key={source.id} className="space-y-4 rounded-2xl border bg-card p-5"><div><p className="text-xs font-semibold text-primary">{source.category} · {source.region}</p><h2 className="mt-2 text-xl font-bold">{source.name}</h2><a className="text-sm underline" href={source.site_url} target="_blank" rel="noopener noreferrer">Publisher / source information</a></div><p className="text-sm">{enabled?"Enabled":"Disabled"} · {preference?.status==="collecting"?"Collection started; refresh for status. Interrupted checks can be retried after five minutes.":preference?.status==="error"?"Last collection failed. Previous links are retained.":preference?.last_success_at?`Last success: ${preference.last_success_at.replace("T"," ").slice(0,16)} UTC`:"Not collected yet."}</p><form action={action}><input type="hidden" name="operation" value="source"/><input type="hidden" name="source" value={source.id}/><input type="hidden" name="enabled" value={enabled?"no":"yes"}/><button className={button} disabled={pending}>{enabled?"Disable":"Enable"} {source.name}</button></form></section>;
  })}</div></div>;
}
