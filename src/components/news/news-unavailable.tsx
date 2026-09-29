import Link from "next/link";
export function NewsUnavailable(){
  return <section role="alert" className="space-y-4 rounded-2xl border bg-card p-6"><h1 className="text-2xl font-bold">News setup needs attention</h1><p>Apply the Sprint 12 SQL migration, then refresh. If already applied, check your Supabase connection and sign-in session. No articles have been fabricated.</p><p className="text-sm text-muted-foreground">Setup instructions: docs/setup/sprint-12.md</p><Link href="/briefing" className="underline">Try Briefing again</Link></section>;
}
