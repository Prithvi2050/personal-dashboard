import { BellOff, CloudOff, Database, LogOut, Mail, Target, UserRound, Utensils } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const groups = [
  { title: "Nutrition goals", detail: "Calories, protein, carbs and fat", icon: Target },
  { title: "Foods & utensils", detail: "Personal foods and calibrated kitchenware", icon: Utensils },
  { title: "Spending connection", detail: "Email and approved financial senders", icon: Mail },
  { title: "Briefing sources", detail: "Trusted publications and categories", icon: Database },
  { title: "Notifications", detail: "Not included in the MVP", icon: BellOff },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: authData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const { data: profile } = authData.user && supabase
    ? await supabase.from("users").select("name, email, timezone").eq("id", authData.user.id).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Preferences" title="Settings" description="The controls that will shape your personal dashboard." />
      <Card className="border-0 shadow-sm ring-border/80">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">{supabase ? <UserRound aria-hidden="true" className="size-5" /> : <CloudOff aria-hidden="true" className="size-5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{profile?.name ?? authData.user?.email ?? "Database setup required"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{profile ? `${profile.email} · ${profile.timezone}` : "Connect Supabase to enable your private account."}</p>
          </div>
          {authData.user ? <form action="/auth/sign-out" method="post"><button type="submit" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><LogOut aria-hidden="true" className="size-4" />Sign out</button></form> : null}
        </CardContent>
      </Card>
      <section className="grid gap-3 md:grid-cols-2" aria-label="Settings groups">{groups.map(({ title, detail, icon: Icon }) => <Card key={title} className="border-0 shadow-sm ring-border/80"><CardContent className="flex items-center gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-5" /></span><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div></CardContent></Card>)}</section>
    </div>
  );
}
