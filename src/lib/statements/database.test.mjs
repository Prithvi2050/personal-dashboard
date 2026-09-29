import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {parsePages,digest} from './parser.ts';
import {buildReviewChoices} from './review.ts';
test('household migration: invitations, owner isolation, atomic review and duplicate safety',async()=>{
 const db=new PGlite();const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table public.users(id uuid primary key,name text);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';grant usage on schema auth to authenticated,anon;`);
  await db.exec(await readFile(new URL('../../../supabase/migrations/202609210001_household_statements.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../../supabase/migrations/202609220001_statement_investment.sql',import.meta.url),'utf8'));
  for(const [id,name] of [[a,'One'],[b,'Two'],[c,'Three']]){await db.query('insert into public.users values($1,$2)',[id,name]);await db.query('insert into auth.users values($1,$2,now())',[id,name.toLowerCase()+'@example.com']);}
  await db.exec('set role authenticated');
  const as=id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  const manage=async(op,value='')=>(await db.query('select public.manage_spending_household($1,$2) as id',[op,value])).rows[0].id;
  const stage=async(files)=>(await db.query('select public.stage_statement_files($1::jsonb) as id',[JSON.stringify(files)])).rows[0].id;
  const confirm=async(id,choices)=>(await db.query('select public.confirm_statement_draft($1,$2::jsonb) as n',[id,JSON.stringify(choices)])).rows[0].n;
  await as(a);const household=await manage('create');await manage('invite','two@example.com');
  const account=(await db.query("select public.add_spending_account('Example card','axis-card','1234',$1) as id",[a])).rows[0].id;
  const file=parsePages(['Axis Bank Credit Card\n01/08/2026 - 31/08/2026\nTRANSACTION DETAILS\n01/08/2026 SAMPLE CAFE RESTAURANTS 100.00 Dr\n02/08/2026 BBPS PAYMENT RECEIVED 100.00 Cr'],digest('file one'));
  const draft=await stage([file]);
  const choices=[{file:0,account,rows:file.rows.map((row,index)=>({index,include:true,kind:row.kind,merchant:row.merchant,category:row.category,keepDuplicate:false}))}];
  await assert.rejects(db.query("insert into public.spending_members values($1,$2,'Evil','owner')",[c,household]),/permission denied/);
  await as(c);assert.equal((await db.query('select * from public.statement_drafts')).rows.length,0);await assert.rejects(manage('accept',household));await assert.rejects(confirm(draft,choices));
  await as(b);await manage('accept',household);assert.equal((await db.query('select * from public.spending_members')).rows.length,2);assert.equal((await db.query('select * from public.statement_drafts')).rows.length,0);await assert.rejects(confirm(draft,choices));await assert.rejects(manage('invite','three@example.com'));
  await as(a);assert.equal(await confirm(draft,choices),2);assert.equal(await confirm(draft,choices),0);
  assert.equal((await db.query('select files from public.statement_drafts where id=$1',[draft])).rows[0].files.length,0);
  assert.equal(await confirm(await stage([file]),choices),0);
  const overlapping={...file,hash:digest('file two'),rows:file.rows.map((row,index)=>({...row,key:digest('second'+index)}))};
  const duplicateDraft=await stage([overlapping]);await assert.rejects(confirm(duplicateDraft,choices),/duplicate/);
  assert.equal((await db.query('select * from public.statement_imports')).rows.length,1); // atomic rollback
  const exclude=structuredClone(choices);exclude[0].rows.forEach(row=>row.include=false);assert.equal(await confirm(duplicateDraft,exclude),0);
  const invalid=structuredClone(file);invalid.hash=digest('file three');invalid.rows[0].key=digest('new');invalid.rows[0].fingerprint=digest('unique');
  const invalidDraft=await stage([invalid]);const bad=structuredClone(choices);bad[0].rows[0].kind='review';await assert.rejects(confirm(invalidDraft,bad));
  assert.equal((await db.query('select * from public.statement_entries')).rows.length,2);
  const entry=(await db.query("select * from public.statement_entries where direction='debit'")).rows[0];
  await db.query("select public.correct_statement_entry($1,0,'Corrected cafe','expense','Travel')",[entry.id]);
  await assert.rejects(db.query("select public.correct_statement_entry($1,0,'Stale cafe','expense','Dining')",[entry.id]),/Stale revision/);
  await assert.rejects(db.query("select public.correct_statement_entry($1,1,'Invalid refund','refund','Dining')",[entry.id]));
  const corrected=(await db.query('select * from public.statement_entries where id=$1',[entry.id])).rows[0];
  assert.deepEqual(corrected.original,entry.original);assert.equal(corrected.category,'Travel');assert.equal(corrected.revision,1);
  assert.equal((await db.query('select * from public.statement_entry_corrections')).rows.length,1);
  await db.query("select public.correct_statement_entry($1,1,'Investment contribution','investment','Other')",[entry.id]);
  assert.equal((await db.query('select kind from public.statement_entries where id=$1',[entry.id])).rows[0].kind,'investment');
  const credit=(await db.query("select id from public.statement_entries where direction='credit'")).rows[0];
  await db.query("select public.correct_statement_entry($1,0,'Investment withdrawal','investment','Other')",[credit.id]);
  await as(b);assert.equal((await db.query('select * from public.statement_entries')).rows.length,2);await manage('leave');assert.equal((await db.query('select * from public.statement_entries')).rows.length,0);await assert.rejects(stage([file]));
  await as(c);await manage('create');const foreign=(await db.query("select public.add_spending_account('Other card','axis-card','4321',$1) as id",[c])).rows[0].id;
  await assert.rejects(db.query("select public.correct_statement_entry($1,1,'Foreign edit','expense','Dining')",[entry.id]),/unavailable/);
  assert.equal((await db.query('select * from public.statement_entry_corrections')).rows.length,0);
  await as(a);const cross=structuredClone(choices);cross[0].account=foreign;await assert.rejects(confirm(invalidDraft,cross),/matching household/);
  await assert.rejects(db.query("update public.statement_entries set amount=1"),/permission denied/);
  // New unified-category application path: invisible credits cannot block or shift rows.
  const mixed={...file,hash:digest('debit-only application import'),rows:[file.rows[1],file.rows[0]].map((row,index)=>({...row,kind:'review',key:digest('debit-only key'+index),fingerprint:digest('debit-only fingerprint'+index)}))};
  const form=new FormData();form.set('account-0',account);form.set('include-0-0','yes');form.set('include-0-1','yes');form.set('classification-0-1','investment');
  const debitChoices=buildReviewChoices([mixed],form);
  const mixedDraft=await stage([mixed]);
  assert.equal(await confirm(mixedDraft,debitChoices),1);
  assert.equal(await confirm(mixedDraft,debitChoices),0);
  const imported=(await db.query('select direction,kind from public.statement_entries where source_key=$1',[mixed.rows[1].key])).rows;
  assert.deepEqual(imported,[{direction:'debit',kind:'investment'}]);
  assert.equal((await db.query('select id from public.statement_entries where source_key=$1',[mixed.rows[0].key])).rows.length,0);
  const creditOnly={...mixed,hash:digest('credit only application import'),rows:[mixed.rows[0]]};
  assert.equal(await confirm(await stage([creditOnly]),buildReviewChoices([creditOnly],form)),0);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.statement_entries'),/permission denied/);await assert.rejects(manage('create'),/permission denied/);
 }finally{await db.close();}
});
