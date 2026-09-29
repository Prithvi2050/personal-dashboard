import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CollectNews, NewsSourceControls } from "@/components/news/news-controls";
import { NewsUnavailable } from "@/components/news/news-unavailable";
import { loadNews } from "@/lib/news/repository";
export default async function NewsSettings(){
  let data;try{data=await loadNews();}catch{return <NewsUnavailable/>;}
  return <div className="space-y-6"><PageHeader eyebrow="Briefing foundation" title="News sources" description="An optional mix of India and global coverage. Your source choices are private to your sign-in."/><p className="rounded-xl border bg-muted/40 p-4 text-sm">All sources start disabled. Enable sources for personal feed reading, then collect headlines. Only titles, dates and original links are stored—no full articles, tracking images or AI summaries. India coverage starts with RBI financial releases; this is not comprehensive India news coverage.</p><NewsSourceControls preferences={data.preferences}/><CollectNews enabled={data.preferences.some(row=>row.enabled)}/><Link href="/briefing" className="inline-block underline">View collected headlines</Link></div>;
}
