import test from "node:test";
import assert from "node:assert/strict";
import {parseFeed,fetchNewsFeed,MAX_FEED_BYTES} from "./feed.ts";
import {normalizeArticleUrl,newsSources} from "./model.ts";
const now=Date.parse("2026-09-29T12:00:00Z");
const item=(title="Invented headline",link="https://www.bbc.com/news/example",date="Tue, 29 Sep 2026 10:00:00 GMT")=>`<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate></item>`;
const rss=items=>`<?xml version="1.0"?><rss version="2.0"><channel><title>Invented feed</title>${items}</channel></rss>`;
test("RSS normalization removes tracking, deduplicates links and never stores bodies",()=>{
 const parsed=parseFeed(rss(item("Example &amp; test","http://www.bbc.com/news/example?utm_source=test#x")+item()+"<item><title>Missing date</title></item>"),"bbc-business",now);
 assert.deepEqual(parsed.articles,[{title:"Example & test",url:"https://www.bbc.com/news/example",published_at:"2026-09-29T10:00:00.000Z"}]);
 assert.equal(parsed.skipped,2);
 assert.deepEqual(Object.keys(parsed.articles[0]).sort(),["published_at","title","url"]);
});
test("Atom prefers published over updated regardless of element order",()=>{
 const xml='<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Invented Atom</title><updated>2026-09-29T11:00:00Z</updated><published>2026-09-28T10:00:00Z</published><link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://www.bbc.com/news/atom"/></entry></feed>';
 assert.equal(parseFeed(xml,"bbc-technology",now).articles[0].published_at,"2026-09-28T10:00:00.000Z");
});
test("RBI timestamps without an offset use explicit India time, not server local time",()=>{
 const parsed=parseFeed(rss(item("Invented RBI release","https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=123","Tue, 29 Sep 2026 10:00:00")),"rbi-press",now);
 assert.equal(parsed.articles[0].published_at,"2026-09-29T04:30:00.000Z");
});
test("unsafe links and invalid, old, undated or future metadata are skipped",()=>{
 const xml=rss(item("Old",undefined,"Tue, 01 Sep 2026 10:00:00 GMT")+item("Future",undefined,"Tue, 01 Dec 2026 10:00:00 GMT")+item("Bad date",undefined,"yesterday")+item("Unsafe","javascript:alert(1)")+item("Private","https://127.0.0.1/admin")+item("Timezone missing",undefined,"2026-09-29T10:00:00"));
 assert.equal(parseFeed(xml,"bbc-business",now).articles.length,0);
 for(const url of ["https://www.bbc.com.evil.example/news/x","https://user@www.bbc.com/news/x","https://www.bbc.com:8443/news/x","file:///etc/passwd"])assert.throws(()=>normalizeArticleUrl(url,newsSources[0]));
});
test("malformed, DTD/entity, overlarge and deep feeds fail closed; valid empty feeds are distinct",()=>{
 for(const xml of ["<html>Oops</html>","<rss><channel></rss>",'<!DOCTYPE rss [<!ENTITY x "oops">]><rss/>'," ".repeat(MAX_FEED_BYTES+1),"<rss>"+("<a>".repeat(40))+("</a>".repeat(40))+"</rss>"])assert.throws(()=>parseFeed(xml,"bbc-business",now));
 assert.deepEqual(parseFeed(rss(""),"bbc-business",now),{articles:[],skipped:0});
});
test("fetch is catalog-only, bounded, non-cached, and refuses redirects",async()=>{
 let calls=0;
 const fetcher=async(url,options)=>{calls++;assert.equal(url,newsSources[0].feed_url);assert.equal(options.redirect,"error");assert.equal(options.cache,"no-store");assert.ok(options.signal);return new Response(rss(item()),{headers:{"content-type":"text/xml; charset=utf-8"}});};
 assert.equal((await fetchNewsFeed("bbc-business",fetcher,now)).articles.length,1);
 await assert.rejects(fetchNewsFeed("https://127.0.0.1",fetcher,now));assert.equal(calls,1);
 for(const response of [new Response("down",{status:503}),new Response("<html/>",{headers:{"content-type":"text/html"}}),new Response("large",{headers:{"content-type":"text/xml","content-length":String(MAX_FEED_BYTES+1)}}),new Response("x".repeat(MAX_FEED_BYTES+1),{headers:{"content-type":"text/xml"}})])await assert.rejects(fetchNewsFeed("bbc-business",async()=>response,now));
 await assert.rejects(fetchNewsFeed("bbc-business",async()=>{throw new DOMException("timeout","TimeoutError");},now));
});
