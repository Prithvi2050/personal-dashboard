export const newsCategories = ["Business", "Technology", "Finance"] as const;
export type NewsCategory = typeof newsCategories[number];
export type NewsSource = { id: string; name: string; category: NewsCategory; region: string; feed_url: string; site_url: string; article_hosts: readonly string[] };
export const newsSources: readonly NewsSource[] = [
  { id:"bbc-business", name:"BBC News — Business", category:"Business", region:"Global", feed_url:"https://feeds.bbci.co.uk/news/business/rss.xml", site_url:"https://www.bbc.com/news/business", article_hosts:["www.bbc.co.uk","www.bbc.com","bbc.co.uk","bbc.com"] },
  { id:"bbc-technology", name:"BBC News — Technology", category:"Technology", region:"Global", feed_url:"https://feeds.bbci.co.uk/news/technology/rss.xml", site_url:"https://www.bbc.com/news/technology", article_hosts:["www.bbc.co.uk","www.bbc.com","bbc.co.uk","bbc.com"] },
  { id:"rbi-press", name:"Reserve Bank of India — Releases", category:"Finance", region:"India", feed_url:"https://rbi.org.in/pressreleases_rss.xml", site_url:"https://www.rbi.org.in/Scripts/rss.aspx", article_hosts:["rbi.org.in","www.rbi.org.in"] },
  { id:"fed-press", name:"US Federal Reserve — Releases", category:"Finance", region:"Global / US", feed_url:"https://www.federalreserve.gov/feeds/press_all.xml", site_url:"https://www.federalreserve.gov/feeds/feeds.htm", article_hosts:["www.federalreserve.gov","federalreserve.gov"] },
];
export type NewsPreference = { user_id:string; source_id:string; enabled:boolean; last_attempt_at:string|null; last_success_at:string|null; status:"idle"|"collecting"|"success"|"error"; imported_count:number; skipped_count:number };
export type ArticleCandidate = { title:string; url:string; published_at:string };
export type NewsArticle = ArticleCandidate & { id:string; user_id:string; source_id:string; collected_at:string };
export type NewsActionState = { status:"idle"|"success"|"error"; message:string; details?:string[] };
export class NewsError extends Error {}
export function sourceById(id:string):NewsSource {
  const source=newsSources.find(item=>item.id===id);
  if(!source)throw new NewsError("Unknown news source. Refresh and choose a listed source.");
  return source;
}
export function normalizeArticleUrl(value:string,source:NewsSource):string {
  const url=new URL(value.trim());
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.port||!source.article_hosts.includes(url.hostname))throw new NewsError("Unsupported article link.");
  url.protocol="https:";
  url.hash="";
  for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||["fbclid","gclid"].includes(key.toLowerCase()))url.searchParams.delete(key);
  url.searchParams.sort();
  if(url.href.length>2048)throw new NewsError("Article link is too long.");
  return url.href;
}
