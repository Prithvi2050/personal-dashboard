import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { loadSettings } from "@/lib/settings/repository";

export async function PreferencesPage({ onboarding = false }: { onboarding?: boolean }) {
  let result;
  try { result = await loadSettings(); } catch { result = { status: "error" } as const; }
  if (result.status === "unauthenticated") redirect("/sign-in?next=" + (onboarding ? "/onboarding" : "/settings"));
  if (result.status === "error") return <section className="rounded-3xl bg-card p-8 ring-1 ring-border" role="alert"><h1 className="text-2xl font-bold">Settings are temporarily unavailable</h1><p className="mt-3 text-muted-foreground">We could not load your saved preferences. No changes have been made.</p><a href={onboarding ? "/onboarding" : "/settings"} className="mt-6 inline-block rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground">Try again</a></section>;
  if (onboarding && result.settings.onboarding_completed_at) redirect("/settings");
  const { daily_calorie_goal, daily_protein_goal, daily_carbs_goal, daily_fat_goal, monthly_spending_budget, timezone } = result.settings;
  const timezones = [...new Set(["Asia/Kolkata", "UTC", timezone, ...Intl.supportedValuesOf("timeZone")])].sort();
  return <div className="space-y-8">
    <PageHeader eyebrow={onboarding ? "Make yourself at home" : "Preferences"} title={onboarding ? "A few things, just for you" : "Settings"} description={onboarding ? "Set your goals and timezone. Everything can be changed later." : "Your goals, your budget, and the rhythm of your day."} />
    <p className="text-sm text-muted-foreground">Signed in as <span className="font-semibold text-foreground">{result.email}</span></p>
    <SettingsForm onboarding={onboarding} initialValues={{ daily_calorie_goal, daily_protein_goal, daily_carbs_goal, daily_fat_goal, monthly_spending_budget, timezone }} timezones={timezones} />
    <section className="rounded-3xl border border-border p-6 sm:p-8" aria-labelledby="coming-later">
      <h2 id="coming-later" className="text-lg font-bold">The rest can wait</h2>
      <div className="mt-4 grid gap-5 text-sm leading-6 text-muted-foreground sm:grid-cols-3">
        <div><h3 className="font-semibold text-foreground">Email connection</h3><p>Not connected. Gmail access will be available separately and will require your consent.</p></div>
        <div><h3 className="font-semibold text-foreground">Morning briefing</h3><p>Business, Technology, and Finance are the default categories. Source selection is coming later.</p></div>
        <div><h3 className="font-semibold text-foreground">Foods & utensils</h3><p>Add your personal foods and kitchenware when meal logging becomes available.</p></div>
      </div>
    </section>
    {!onboarding ? <Link href="/" className="inline-block rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Back to Home</Link> : null}
  </div>;
}
