import { SaxesParser } from "saxes";
import { NewsError, normalizeArticleUrl, sourceById, type ArticleCandidate } from "./model.ts";

export const MAX_FEED_BYTES=512*1024;
const MAX_ITEMS=500;
export function parseFeed(xml:string,sourceId:string,now=Date.now()) {
  const source=sourceById(sourceId);
  if(Buffer.byteLength(xml)>MAX_FEED_BYTES||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new NewsError("Unsupported or oversized news feed.");
  const parser=new SaxesParser({xmlns:true});
  const stack:string[]=[];
  const raw:{title:string;url:string;date:string;updated:string}[]=[];
  let item:typeof raw[number]|undefined, itemDepth=0, root="";
  parser.on("opentag",tag=>{
    stack.push(tag.local);
    if(stack.length>32)throw new NewsError("News feed nesting exceeds the safety limit.");
    if(stack.length===1){root=tag.local;if(root!=="rss"&&root!=="feed")throw new NewsError("This response is not an RSS or Atom feed.");}
    if(stack.join("/")==="rss/channel/item"||stack.join("/")==="feed/entry"){
      if(raw.length>=MAX_ITEMS)throw new NewsError("News feed has too many items.");
      item={title:"",url:"",date:"",updated:""};itemDepth=stack.length;
    }
    if(item&&root==="feed"&&stack.length===itemDepth+1&&tag.local==="link"){
      const attributes=Object.values(tag.attributes);
      const rel=attributes.find(value=>value.local==="rel")?.value;
      const href=attributes.find(value=>value.local==="href")?.value;
      if(href&&(!rel||rel==="alternate")&&!item.url)item.url=href;
    }
  });
  const text=(value:string)=>{
    if(!item||stack.length!==itemDepth+1)return;
    const field=stack.at(-1);
    if(field==="title")item.title+=value;
    if(field==="link"&&root==="rss")item.url+=value;
    if(field==="pubDate"||field==="published")item.date+=value;
    if(field==="updated")item.updated+=value;
  };
  parser.on("text",text);parser.on("cdata",text);
  parser.on("closetag",()=>{
    if(item&&stack.length===itemDepth){raw.push(item);item=undefined;}
    stack.pop();
  });
  parser.on("error",()=>{throw new NewsError("The source returned malformed XML.");});
  parser.write(xml).close();
  const articles:ArticleCandidate[]=[];const seen=new Set<string>();let skipped=0;
  for(const entry of raw){
    try{
      const title=entry.title.replace(/<[^>]*>/g," ").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim();
      let dateText=(entry.date||entry.updated).trim();
      // RBI's observed feed omits its offset. Interpret this publisher-specific
      // timestamp as India time, never as the deployment machine's timezone.
      if(source.id==="rbi-press"&&/^[A-Za-z]{3}, \d{1,2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2}$/.test(dateText))dateText+=" +0530";
      if(!/(Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(dateText))throw new Error("Missing timezone");
      const date=Date.parse(dateText);
      if(!title||title.length>500||!Number.isFinite(date)||date>now+3600000||date<now-7*86400000)throw new Error("Invalid metadata");
      const url=normalizeArticleUrl(entry.url,source);
      if(seen.has(url)){skipped++;continue;}
      seen.add(url);articles.push({title,url,published_at:new Date(date).toISOString()});
    }catch{skipped++;}
  }
  articles.sort((a,b)=>b.published_at.localeCompare(a.published_at));
  return {articles:articles.slice(0,50),skipped:skipped+Math.max(0,articles.length-50)};
}

// The caller supplies only a catalog ID, never a URL. Redirects are refused.
export async function fetchNewsFeed(sourceId:string,fetcher:typeof fetch=fetch,now=Date.now()){
  const source=sourceById(sourceId);
  const response=await fetcher(source.feed_url,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000),headers:{Accept:"application/rss+xml, application/atom+xml, application/xml, text/xml"}});
  if(!response.ok||!response.body)throw new NewsError("The source is temporarily unavailable.");
  const type=response.headers.get("content-type")??"";
  if(!/^(application\/(rss\+xml|atom\+xml|xml)|text\/xml)(\s*;|$)/i.test(type))throw new NewsError("The source did not return an XML feed.");
  if(Number(response.headers.get("content-length"))>MAX_FEED_BYTES){await response.body.cancel();throw new NewsError("News feed is too large.");}
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_FEED_BYTES)throw new NewsError("News feed is too large.");chunks.push(part.value);}
  }finally{await reader.cancel().catch(()=>{});}
  return parseFeed(Buffer.concat(chunks).toString("utf8"),sourceId,now);
}
