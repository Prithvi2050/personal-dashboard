import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import * as model from "./model.ts";
const require=createRequire(import.meta.url);
function component(path,data,fail=false){
 const compiledModule={exports:{}};
 const code=ts.transpileModule(readFileSync(new URL("../../"+path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const localRequire=name=>{
  if(name==="next/link")return {default:({children,...props})=>React.createElement("a",props,children)};
  if(name==="@/lib/news/model")return model;
  if(name==="@/lib/news/repository")return {loadNews:async()=>{if(fail)throw Error("synthetic failure");return data;}};
  if(name==="@/app/settings/news/actions")return {newsAction:async()=>({status:"success",message:"synthetic"})};
  if(name.startsWith("@/components/"))return component(name.slice(2)+".tsx",data,fail);
  return require(name);
 };
 runInNewContext(code,{module:compiledModule,exports:compiledModule.exports,require:localRequire});
 return compiledModule.exports;
}
test("source settings are opt-in and collection is disabled before selection",async()=>{
 const Page=component("app/settings/news/page.tsx",{preferences:[],articles:[]}).default;
 const html=renderToStaticMarkup(await Page());
 assert.ok(html.includes("All sources start disabled"));
 assert.ok(html.includes("India"));
 assert.ok(html.includes("disabled"));
 assert.equal((html.match(/name="enabled" value="yes"/g)||[]).length,4);
});
test("briefing renders attributed links, hides disabled sources, and does not claim a finished briefing",async()=>{
 const data={preferences:[{source_id:"bbc-business",enabled:true}],articles:[
  {id:"a",source_id:"bbc-business",title:"Invented & safe headline",url:"https://www.bbc.com/news/test",published_at:"2026-09-29T10:00:00Z"},
  {id:"b",source_id:"rbi-press",title:"Hidden source title",url:"https://www.rbi.org.in/example",published_at:"2026-09-29T10:00:00Z"},
 ]};
 const Page=component("app/briefing/page.tsx",data).default;const html=renderToStaticMarkup(await Page());
 assert.ok(html.includes("Invented &amp; safe headline"));
 assert.ok(html.includes("BBC News"));
 assert.ok(!html.includes("Hidden source title"));
 assert.ok(html.includes("not an AI-generated or curated daily briefing"));
 assert.ok(html.includes('rel="noopener noreferrer"'));
});
test("missing database renders a setup error rather than fake headlines",async()=>{
 const Page=component("app/briefing/page.tsx",null,true).default;
 const html=renderToStaticMarkup(await Page());
 assert.ok(html.includes('role="alert"'));
 assert.ok(html.includes("Sprint 12 SQL migration"));
 assert.ok(!html.includes("Invented"));
});
