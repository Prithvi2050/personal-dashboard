import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as model from "./model.ts";
import * as review from "./review.ts";

const debit = { key:"debit", fingerprint:"debit", date:"2026-09-01", merchant:"Invented shop", amount:10000, direction:"debit", kind:"review", category:"Other", warning:"" };
const credit = { ...debit, key:"credit", fingerprint:"credit", merchant:"HIDDEN CREDIT MERCHANT", amount:4000, direction:"credit", kind:"review" };
const file = {format:"sbi-bank",label:"Invented statement",hash:"test",start:"2026-09-01",end:"2026-09-30",rows:[credit,debit],warnings:[]};
function form() {
  const data = new FormData();
  data.set("account-0","account");
  data.set("include-0-0","yes"); // Even a forged/old form must not import a hidden credit.
  data.set("include-0-1","yes");
  data.set("classification-0-1","expense:Grocery");
  return data;
}
test("unified categories round-trip and reject invalid or credit classifications",()=>{
  for(const option of review.classifications) {
    assert.equal(review.classificationFor(option),option.value);
    assert.equal(review.parseClassification(option.value),option);
  }
  for(const value of ["review","refund","income","expense:Unknown",null]) assert.throws(()=>review.parseClassification(value));
  assert.equal(review.classificationFor(debit),"review");
});
test("review excludes credits server-side and preserves source indexes",()=>{
  const choices = review.buildReviewChoices([file],form());
  assert.equal(choices[0].rows[0].include,false);
  assert.equal(choices[0].rows[1].index,1);
  assert.equal(choices[0].rows[1].kind,"expense");
  assert.equal(choices[0].rows[1].category,"Grocery");
  assert.equal(choices[0].rows[1].include,true);
});
test("unresolved debit errors point to original row; excluded and credit-only rows do not block",()=>{
  const data = form(); data.delete("classification-0-1");
  assert.throws(()=>review.buildReviewChoices([file],data),/source row 2/);
  data.delete("include-0-1");
  assert.ok(review.buildReviewChoices([file],data)[0].rows.every(row=>!row.include));
  assert.equal(review.buildReviewChoices([{...file,rows:[credit]}],data)[0].rows[0].include,false);
  data.delete("account-0");
  assert.throws(()=>review.buildReviewChoices([file],data),/shared account/);
});
test("category totals use gross debit expenses; investments and repayments stay separate",()=>{
  const row = (kind,amount,category="Other",direction="debit")=>({...debit,kind,amount,category,direction});
  const summary = review.summarizeSpending([
    row("expense",10000,"Dining"), row("emi",20000,"Bills"), row("fee",1000,"Bills"),
    row("investment",5000), row("investment",9000,"Other","credit"),
    row("card_payment",20000), row("transfer",2000), row("financed_purchase",20000), row("emi_interest_included",1000),
    row("refund",4000,"Dining","credit"), row("income",100000,"Other","credit"),
  ]);
  assert.equal(summary.total,31000);
  assert.equal(summary.emi,20000);
  assert.equal(summary.investments,5000);
  assert.equal(summary.categories.reduce((sum,row)=>sum+row.amount,0),summary.total);
  assert.ok(Math.abs(summary.categories.reduce((sum,row)=>sum+row.percentage,0)-100)<0.0001);
  assert.deepEqual(summary.categories.map(row=>row.category),["Monthly EMI","Dining","Interest, fees & taxes"]);
  assert.deepEqual(review.summarizeSpending([credit]),{total:0,emi:0,investments:0,categories:[]});
});

// Render the real component with synthetic data, without starting an authenticated app
// or sending any financial data to Supabase.
const require = createRequire(import.meta.url);
function dashboard() {
  const source = readFileSync(new URL("../../components/spending/statement-dashboard.tsx",import.meta.url),"utf8");
  const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const compiledModule = {exports:{}};
  const localRequire = name=>{
    if(name==="@/lib/statements/model")return model;
    if(name==="@/lib/statements/review")return review;
    if(name==="@/app/spending/statements/actions")return {statementAction:async()=>({status:"error",message:"synthetic"})};
    if(name==="next/link")return {default:({children,...props})=>React.createElement("a",props,children)};
    if(name==="lucide-react")return Object.fromEntries(["FileUp","Users","WalletCards","CalendarDays"].map(name=>[name,()=>React.createElement("svg")]));
    return require(name);
  };
  runInNewContext(compiled,{exports:compiledModule.exports,require:localRequire,module:compiledModule});
  return compiledModule.exports.StatementDashboard;
}
test("rendered spending UI hides credit rows and merges category controls",()=>{
  const Dashboard = dashboard();
  const data = {userId:"user",members:[{user_id:"user",household_id:"household",display_name:"Example",role:"owner"}],
    accounts:[{id:"account",owner_id:"user",label:"Test bank",format:"sbi-bank",last_four:""}],invites:[],imports:[],
    drafts:[{id:"draft",files:[file],expires_at:"2026-09-30T00:00:00Z"}],
    entries:[{...credit,id:"credit",account_id:"account",revision:0},{...debit,kind:"expense",category:"Grocery",id:"debit",account_id:"account",revision:0}]};
  const html=renderToStaticMarkup(React.createElement(Dashboard,{data,defaultMonth:"2026-09"}));
  assert.ok(!html.includes("HIDDEN CREDIT MERCHANT"));
  assert.ok(!html.includes('name="classification-0-0"'));
  assert.ok(html.includes('name="classification-0-1"'));
  assert.ok(!html.includes('name="kind-0-1"'));
  assert.ok(!html.includes('name="category-0-1"'));
  assert.ok(html.includes('name="classification"')); // saved-entry correction
  assert.ok(html.includes("Where your money went"));
  assert.ok(html.includes("100.0%"));
  assert.ok(html.includes("Confirmed debits"));
});
