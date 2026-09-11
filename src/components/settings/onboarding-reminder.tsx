import Link from "next/link";
import { loadSettings } from "@/lib/settings/repository";

export async function OnboardingReminder() {
  let result;
  try { result = await loadSettings(); } catch { return null; }
    if (result.status !== "ready" || result.settings.onboarding_completed_at) return null;
    return <aside className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Make this dashboard yours</h2><p className="mt-1 text-sm text-muted-foreground">Set your daily goals, monthly budget, and timezone.</p></div><Link href="/onboarding" className="shrink-0 rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Quick setup</Link></aside>;
}
