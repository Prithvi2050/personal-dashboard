import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { GMAIL_SCOPE, emailAddress, senderQuery, headerSender, seal, unseal, beginOAuth, verifyOAuth, gmailProvider } from "./core.ts";
const config = { clientId: "synthetic-client", clientSecret: "synthetic-secret", redirectUri: "http://localhost:3000/settings/gmail/callback", key: randomBytes(32).toString("hex") };
const response = value => new Response(JSON.stringify(value), {status:200});
test("sender allowlist blocks wildcard/search injection and rejects ambiguous headers", () => {
  assert.equal(emailAddress(" Alerts+Card@Example.com "),"alerts+card@example.com");
  for (const value of ["*@example.com","a@example.com OR from:other@example.com","a@example.com\r\nBcc:b@example.com","a@example.com,b@example.com","a@-example.com",""]) assert.throws(()=>emailAddress(value));
  assert.throws(()=>senderQuery([]));
  assert.throws(()=>senderQuery(Array.from({length:21},(_,i)=>`a${i}@example.com`)));
  assert.equal(senderQuery(["a@example.com","A@example.com"]),"newer_than:7d {from:a@example.com}");
  assert.equal(headerSender('Example Bank <a@example.com>'),"a@example.com");
  assert.equal(headerSender('Bank <a@example.com>, Other <b@example.com>'),null);
  assert.equal(headerSender('a@example.com.evil.test'),"a@example.com.evil.test");
});
test("AES-GCM ciphertext is randomized, authenticated and bound to owner and purpose", () => {
  const one=seal("synthetic-refresh",config.key,"gmail-token:owner");
  assert.notEqual(one,seal("synthetic-refresh",config.key,"gmail-token:owner"));
  assert.ok(!one.includes("synthetic-refresh"));
  assert.equal(unseal(one,config.key,"gmail-token:owner"),"synthetic-refresh");
  assert.throws(()=>unseal(one,config.key,"gmail-token:other"));
  assert.throws(()=>unseal(one,config.key,"gmail-oauth:owner"));
  assert.throws(()=>unseal(one,randomBytes(32).toString("hex"),"gmail-token:owner"));
  const segments=one.split('.'); segments[3]=(segments[3][0]==='A'?'B':'A')+segments[3].slice(1);
  assert.throws(()=>unseal(segments.join('.'),config.key,"gmail-token:owner"));
  assert.throws(()=>seal("x","bad-key","owner"));
});
test("separate Gmail OAuth uses PKCE, offline consent and expiring owner-bound state", () => {
  const start=beginOAuth(config,"owner",1000); const url=new URL(start.url); const state=url.searchParams.get("state");
  assert.equal(url.origin,"https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"),GMAIL_SCOPE);
  assert.equal(url.searchParams.get("access_type"),"offline");
  assert.equal(url.searchParams.get("include_granted_scopes"),"false");
  assert.equal(url.searchParams.get("code_challenge_method"),"S256");
  assert.equal(verifyOAuth(start.cookie,state,config.key,"owner",2000).length,43);
  for (const [s,owner,now] of [["wrong","owner",2000],[state,"other",2000],[state,"owner",601000]]) assert.throws(()=>verifyOAuth(start.cookie,s,config.key,owner,now));
});
test("exchange checks granted scope, requires refresh token and fetches mailbox identity only", async () => {
  const calls=[];
  const provider=gmailProvider(config,async (url,init)=>{ calls.push({url,init}); return url.includes('/token') ? response({access_token:"synthetic-access",refresh_token:"synthetic-refresh",scope:GMAIL_SCOPE,token_type:"Bearer"}) : response({emailAddress:"Inbox@Example.com"}); });
  assert.deepEqual(await provider.exchange("synthetic-code","synthetic-verifier"),{refreshToken:"synthetic-refresh",email:"inbox@example.com"});
  assert.equal(calls[0].init.body.get("code_verifier"),"synthetic-verifier");
  assert.equal(calls[1].url,"https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=emailAddress");
  for (const payload of [{access_token:"a",token_type:"Bearer",scope:GMAIL_SCOPE},{access_token:"a",token_type:"Bearer",refresh_token:"r",scope:"openid"}]) await assert.rejects(gmailProvider(config,async()=>response(payload)).exchange("c","v"));
});
test("header probe uses filtered search, deduplicates candidates and never fetches bodies", async () => {
  const calls=[];
  const provider=gmailProvider(config,async (url,init)=>{
    calls.push({url,init});
    if(url.includes('/token')) return response({access_token:"synthetic-access",token_type:"Bearer"});
    if(url.includes('/messages?')) return response({messages:[{id:"a1"},{id:"a1"},{id:"b2"}],nextPageToken:"more"});
    const id=url.includes('/a1?') ? "a1" : "b2";
    return response({id,payload:{headers:[{name:"From",value:id==="a1"?"Bank <alerts@example.com>":"alerts@example.com.evil.test"}]}});
  });
  assert.deepEqual(await provider.probe("synthetic-refresh",["alerts@example.com"]),{checked:2,matched:1,more:true});
  assert.equal(calls.length,4);
  const list=new URL(calls[1].url);
  assert.equal(list.searchParams.get("q"),"newer_than:7d {from:alerts@example.com}");
  assert.equal(list.searchParams.get("maxResults"),"20");
  for(const call of calls.slice(2)) {
    const url=new URL(call.url); assert.equal(url.searchParams.get("format"),"metadata"); assert.equal(url.searchParams.get("metadataHeaders"),"From");
    assert.equal(call.init.cache,"no-store"); assert.equal(call.init.redirect,"error");
  }
});
test("empty allowlist makes no provider calls; failure is not presented as zero messages", async () => {
  let calls=0;
  await assert.rejects(gmailProvider(config,async()=>{calls++;return response({});}).probe("r",[]));
  assert.equal(calls,0);
  const down=gmailProvider(config,async()=>{throw new Error("PRIVATE provider detail");});
  await assert.rejects(down.probe("r",["a@example.com"]),error=>!error.message.includes("PRIVATE"));
  assert.equal(await down.revoke("r"),false);
  await assert.rejects(gmailProvider(config,async url=>url.includes('/token')?response({access_token:"a",token_type:"Bearer"}):response({messages:[{id:"../escape"}]})).probe("r",["a@example.com"]));
});
test("an empty search fetches no headers and revocation keeps tokens out of the URL", async () => {
  let calls=0;
  const provider=gmailProvider(config,async (url,init)=>{
    calls++;
    if(url.includes('/token')) return response({access_token:"synthetic-access",token_type:"Bearer"});
    if(url.includes('/messages?')) return response({});
    assert.equal(url,"https://oauth2.googleapis.com/revoke");
    assert.equal(init.body.get("token"),"synthetic-refresh");
    return new Response(null,{status:200});
  });
  assert.deepEqual(await provider.probe("synthetic-refresh",["a@example.com"]),{checked:0,matched:0,more:false});
  assert.equal(calls,2);
  assert.equal(await provider.revoke("synthetic-refresh"),true);
});
