import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {newsSources} from "./model.ts";
test("news migration enforces opt-in, cooldown, private rows, retry safety and stale claims",async()=>{
 const db=new PGlite();const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
 try{
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'; grant usage on schema auth to anon,authenticated;");
  await db.exec(await readFile(new URL("../../../supabase/migrations/202609290001_news_foundation.sql",import.meta.url),"utf8"));
  await db.query("insert into auth.users values($1),($2)",[a,b]);await db.exec("set role authenticated");
  const as=id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  const enable=enabled=>db.query("select public.set_news_source('bbc-business',$1)",[enabled]);
  const claim=async()=>(await db.query("select public.claim_news_source('bbc-business') as token")).rows[0].token;
  const finish=async(token,items,failed=false)=>(await db.query("select public.finish_news_source('bbc-business',$1,$2::jsonb,$3,0) as n",[token,JSON.stringify(items),failed])).rows[0].n;
  const resetCooldown=async()=>{await db.exec("reset role; update public.user_news_sources set last_attempt_at=now()-interval '6 minutes'; set role authenticated");};
  await as(a);
  const catalog=(await db.query("select * from public.news_sources order by id")).rows;
  assert.equal(catalog.length,newsSources.length);
  for(const source of newsSources)assert.equal(catalog.find(row=>row.id===source.id).feed_url,source.feed_url);
  assert.equal(await claim(),null);
  await enable(true);const token=await claim();assert.ok(token);assert.equal(await claim(),null);
  const article={title:"Invented publication",url:"https://www.bbc.com/news/test",published_at:new Date().toISOString()};
  await as(b);assert.equal((await db.query("select * from public.user_news_sources")).rows.length,0);await assert.rejects(finish(token,[article]));
  await as(a);assert.equal(await finish(token,[article]),1);await assert.rejects(finish(token,[article]));
  await resetCooldown();assert.equal(await finish(await claim(),[article]),0);
  await resetCooldown();const stale=await claim();await enable(false);await assert.rejects(finish(stale,[article]));
  await enable(true);assert.equal(await claim(),null); // toggling cannot bypass rate limit
  await resetCooldown();const invalid=await claim();
  await assert.rejects(finish(invalid,[{...article,url:"https://www.bbc.com/news/new"},{...article,url:"https://www.bbc.com.evil.example/attack"}]));
  assert.equal((await db.query("select * from public.news_articles")).rows.length,1); // atomic rollback
  assert.equal(await finish(invalid,[],true),0);
  const preference=(await db.query("select * from public.user_news_sources")).rows[0];
  assert.equal(preference.status,"error");assert.ok(preference.last_success_at);
  await assert.rejects(db.query("update public.news_sources set feed_url='http://localhost'"),/permission denied/);
  await assert.rejects(db.query("delete from public.news_articles"),/permission denied/);
  await as(b);assert.equal((await db.query("select * from public.news_articles")).rows.length,0);
  await enable(true);assert.equal(await finish(await claim(),[article]),1); // dedup is per user
  await db.exec("reset role; update public.news_articles set published_at=now()-interval '8 days'; set role authenticated");
  assert.equal((await db.query("select * from public.news_articles")).rows.length,0);
  await db.exec("reset role;set role anon");await assert.rejects(db.query("select * from public.news_articles"),/permission denied/);await assert.rejects(enable(true),/permission denied/);
 }finally{await db.close();}
});
