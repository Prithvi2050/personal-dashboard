import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchNewsFeed } from "./feed";
import { NewsError, newsSources, sourceById } from "./model";

async function newsSession(){
  const client=await createClient();
  const {data,error}=await client.auth.getUser();
  if(error||!data.user)throw new NewsError("Sign in again to manage your news sources.");
  return client;
}
export async function loadNews(){
  const client=await newsSession();
  const [catalog,preferences]=await Promise.all([
    client.from("news_sources").select("*"),
    client.from("user_news_sources").select("user_id,source_id,enabled,last_attempt_at,last_success_at,status,imported_count,skipped_count"),
  ]);
  if(catalog.error||preferences.error)throw new NewsError("News could not load. Apply the Sprint 12 migration and check your connection.");
  if(newsSources.some(source=>!catalog.data.some(row=>row.id===source.id&&row.feed_url===source.feed_url)))throw new NewsError("The news catalog needs the Sprint 12 migration.");
  const enabled=preferences.data.filter(row=>row.enabled).map(row=>row.source_id);
  const articles=await client.from("news_articles").select("*").in("source_id",enabled).order("published_at",{ascending:false}).limit(150);
  if(articles.error)throw new NewsError("Collected headlines could not load. Check the migration and connection.");
  return {preferences:preferences.data,articles:articles.data};
}
export async function setNewsSource(form:FormData){
  const client=await newsSession();const source=sourceById(String(form.get("source")??""));
  const enabled=form.get("enabled");
  if(enabled!=="yes"&&enabled!=="no")throw new NewsError("Choose whether to enable this source.");
  const {error}=await client.rpc("set_news_source",{p_source:source.id,p_enabled:enabled==="yes"});
  if(error)throw new NewsError("Source preference was not saved. Check the migration and retry.");
  return `${source.name} ${enabled==="yes"?"enabled":"disabled"}. Collection remains manual.`;
}
export async function collectNews(){
  const client=await newsSession();
  const {data:preferences,error}=await client.from("user_news_sources").select("source_id").eq("enabled",true);
  if(error)throw new NewsError("Could not load your enabled sources. Apply the Sprint 12 migration.");
  const sources=newsSources.filter(source=>preferences.some(row=>row.source_id===source.id));
  if(!sources.length)throw new NewsError("Enable at least one source in News sources first.");
  const results=await Promise.all(sources.map(async source=>{
    const claim=await client.rpc("claim_news_source",{p_source:source.id});
    if(claim.error)return {failed:true,message:`${source.name}: collection could not start.`};
    if(!claim.data)return {failed:false,message:`${source.name}: skipped (disabled or checked within the last five minutes).`};
    let feed;
    try{feed=await fetchNewsFeed(source.id);}
    catch{
      const failure=await client.rpc("finish_news_source",{p_source:source.id,p_request:claim.data,p_items:[],p_failed:true,p_skipped:0});
      return {failed:true,message:`${source.name}: feed unavailable or unsupported. Previous articles remain.${failure.error?" Status could not be saved; refresh to check.":""}`};
    }
    const saved=await client.rpc("finish_news_source",{p_source:source.id,p_request:claim.data,p_items:feed.articles,p_failed:false,p_skipped:feed.skipped});
    if(saved.error)return {failed:true,message:`${source.name}: articles could not be saved, or the source was disabled during collection. Retry after five minutes.`};
    return {failed:false,message:`${source.name}: ${saved.data} new links, ${feed.skipped} unsupported, old or repeated feed items skipped.`};
  }));
  return {status:results.some(result=>result.failed)?"error" as const:"success" as const,message:results.some(result=>result.failed)?"Collection finished with source errors. Successful sources were saved.":"Collection finished. Repeated links do not create duplicates.",details:results.map(result=>result.message)};
}
