import "server-only";
import { buildReviewChoices, parseClassification } from "./review";
import { createClient } from "@/lib/supabase/server";
import { extractStatement } from "./pdf";
import { StatementError, formats, minimalDescription, type ParsedStatement } from "./model";
export async function statementSession() {
  const client=await createClient();
  const {data,error}=await client.auth.getUser();
  if(error||!data.user) throw new StatementError("Sign in again before managing statements.");
  return {client,user:data.user};
}
export async function loadStatements() {
  const {client,user}=await statementSession();
  const [members,accounts,invites,drafts,entries,imports]=await Promise.all([
    client.from("spending_members").select("*"),client.from("spending_accounts").select("*").order("label"),client.from("spending_invites").select("*"),
    client.from("statement_drafts").select("*").is("confirmed_at",null).order("created_at",{ascending:false}),
    client.from("statement_entries").select("id,household_id,account_id,source_key,fingerprint,date,merchant,amount,direction,kind,category,revision,created_at",{count:"exact"}).order("date",{ascending:false}).limit(5000),
    client.from("statement_imports").select("*",{count:"exact"}).order("created_at",{ascending:false}).limit(500),
  ]);
  if([members,accounts,invites,drafts,entries,imports].some(result=>result.error)|| entries.count!==entries.data?.length || imports.count!==imports.data?.length) throw new StatementError("Statement data could not load completely. Apply the household-statements migration and check your connection or result limits. No partial totals are shown.");
  return {userId:user.id,members:members.data??[],accounts:accounts.data??[],invites:invites.data??[],drafts:drafts.data??[],entries:entries.data??[],imports:imports.data??[]};
}
export async function uploadStatements(form: FormData) {
  const {client}=await statementSession();
  if(form.get("consent")!=="yes") throw new StatementError("Confirm household sharing and temporary PDF processing first.");
  const selected=form.getAll("files");
  if(selected.length<1||selected.length>5||selected.some(file=>!(file instanceof File)||file.size===0)) throw new StatementError("Select one to five PDF files.");
  const files=selected as File[];
  if(files.reduce((sum,file)=>sum+file.size,0)>3*1024*1024) throw new StatementError("Use at most 3 MB combined per batch.");
  const parsed: ParsedStatement[]=[]; const errors:string[]=[];
  for(const [index,file] of files.entries()) {
    try {
      const bytes=new Uint8Array(await file.arrayBuffer());
      try {
        const result=await extractStatement(bytes);
        if(parsed.some(item=>item.hash===result.hash)) {errors.push(`File ${index+1}: repeated PDF omitted.`);continue;}
        parsed.push({...result,label:`File ${index+1} · ${result.label}`});
      } finally {if(bytes.byteLength) bytes.fill(0);}
    } catch(error) {errors.push(`File ${index+1}: ${error instanceof StatementError?error.message:"Could not read this PDF. Use an unlocked, text-based statement in a supported format."}`);}
  }
  if(!parsed.length) return {draft:undefined,errors};
  if(parsed.reduce((sum,file)=>sum+file.rows.length,0)>1000) throw new StatementError("Use at most 1000 transactions per batch.");
  const result=await client.rpc("stage_statement_files",{p_files:parsed});
  if(result.error) throw new StatementError("Could not create the review. Check the migration/connection, or discard old drafts (maximum five). Nothing was imported.");
  const draft=await client.from("statement_drafts").select("*").eq("id",result.data).single();
  if(draft.error) throw new StatementError("Review created but could not be loaded. Refresh to resume it.");
  return {draft:draft.data,errors};
}
export async function confirmStatements(form: FormData) {
  const {client}=await statementSession();
  if(form.get("confirm")!=="yes") throw new StatementError("Confirm your review before saving to the shared dashboard.");
  const id=String(form.get("draft")??"");
  const result=await client.from("statement_drafts").select("*").eq("id",id).single();
  if(result.error||!result.data) throw new StatementError("Draft unavailable or expired. Upload again.");
  const choices=buildReviewChoices(result.data.files,form);
  const saved=await client.rpc("confirm_statement_draft",{p_id:id,p_choices:choices});
  if(saved.error) throw new StatementError("Nothing was saved. Check account selection, unresolved rows and possible duplicates; refresh if household access changed. Retry is safe.");
  return `${saved.data} transactions imported. Previously confirmed files were skipped. PDFs were not stored.`;
}
export async function manageStatements(form: FormData) {
  const {client}=await statementSession(); const operation=String(form.get("operation"));
  if(operation==="correct") {
    const merchant=minimalDescription(String(form.get("merchant")??"")),revision=String(form.get("revision")??"");
    const {kind,category}=parseClassification(form.get("classification"));
    if(!merchant||!/^\d+$/.test(revision)||form.get("consent")!=="yes") throw new StatementError("Review the merchant, treatment and category, then confirm the shared correction.");
    const result=await client.rpc("correct_statement_entry",{p_id:String(form.get("entry")),p_revision:Number(revision),p_merchant:merchant,p_kind:kind,p_category:category});
    if(result.error) throw new StatementError("Correction was not saved. Check debit/credit treatment or refresh for a newer edit.");
    return "Shared correction saved with an audit record. Original extracted facts are preserved.";
  }
  if(operation==="account") {
    const label=String(form.get("label")??"").trim(),format=String(form.get("format")),last=String(form.get("last_four")??"");
    if(!label||label.length>60||!formats.includes(format as typeof formats[number])||! /^(\d{4})?$/.test(last)) throw new StatementError("Use a short account nickname, supported format and optional last four digits only.");
    const result=await client.rpc("add_spending_account",{p_label:label,p_format:format,p_last_four:last,p_owner:String(form.get("owner"))});
    if(result.error) throw new StatementError("Could not add account. Check its unique nickname, household owner and migration.");
    return "Shared account added. Both household members can view confirmed imports.";
  }
  if(operation==="discard") {
    const result=await client.rpc("discard_statement_draft",{p_id:String(form.get("draft"))});
    if(result.error) throw new StatementError("Could not discard review. Retry."); return "Review discarded.";
  }
  if(!["create","invite","accept","revoke","remove","leave"].includes(operation)||form.get("consent")!=="yes") throw new StatementError("Confirm the household action first.");
  const result=await client.rpc("manage_spending_household",{p_operation:operation,p_value:String(form.get("value")??"").trim()});
  if(result.error) throw new StatementError("Household action failed. Invitations must match a verified sign-in email, expire after seven days, and allow one partner only.");
  return operation==="invite"?"Invitation saved. Ask your partner to sign in and open Spending; no email is sent.":"Household updated. Existing shared transactions remain with the household.";
}
