import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CollectNews } from "@/components/news/news-controls";
import { NewsUnavailable } from "@/components/news/news-unavailable";
import { newsCategories, newsSources, normalizeArticleUrl } from "@/lib/news/model";
import { loadNews } from "@/lib/news/repository";
export default async function BriefingPage(){
  let data;try{data=await loadNews();}catch{return <NewsUnavailable/>;}
  const enabled=new Set(data.preferences.filter(row=>row.enabled).map(row=>row.source_id));
  const articles=data.articles.filter(row=>enabled.has(row.source_id));
  return <div className="space-y-6"><PageHeader eyebrow="Sprint 12 · source collection" title="Briefing inbox" description="Recent headlines from your enabled sources. These are publisher links, not an AI-generated or curated daily briefing."/><div className="flex flex-wrap items-start justify-between gap-4"><CollectNews enabled={enabled.size>0}/><Link href="/settings/news" className="font-semibold underline">Manage news sources</Link></div><p className="rounded-xl border bg-muted/40 p-4 text-sm">Latest up to 150 collected links from the past seven days, in publication order. Similar stories may appear more than once. Story grouping, ranking and five stories per category arrive in Sprint 13.</p>{!enabled.size&&<p className="rounded-xl border p-6">No sources enabled yet. Choose sources to start collecting India and global headlines.</p>}<div className="grid gap-5 lg:grid-cols-3">{newsCategories.map(category=><section key={category} className="rounded-2xl border bg-card p-5"><h2 className="text-xl font-bold">{category}</h2><ul className="mt-4 space-y-5">{articles.filter(row=>newsSources.find(source=>source.id===row.source_id)?.category===category).map(article=>{
    const source=newsSources.find(source=>source.id===article.source_id)!;
    let href;try{href=normalizeArticleUrl(article.url,source);}catch{return null;}
    return <li key={article.id} className="border-t pt-4"><a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold leading-6 underline decoration-primary/40 underline-offset-4">{article.title}</a><p className="mt-2 text-xs text-muted-foreground">{source.name} · {source.region}</p><time dateTime={article.published_at} className="text-xs text-muted-foreground">{article.published_at.replace("T"," ").slice(0,16)} UTC</time></li>;
  })}</ul>{!articles.some(row=>newsSources.find(source=>source.id===row.source_id)?.category===category)&&<p className="mt-4 text-sm text-muted-foreground">No collected headlines in this category yet. Enable a source and collect; a quiet or unavailable feed may have none.</p>}</section>)}</div></div>;
}
