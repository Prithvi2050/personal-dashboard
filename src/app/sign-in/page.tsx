import { Activity, DatabaseZap } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { getSupabaseConfig } from "@/lib/supabase/config";

function safeNext(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const config = getSupabaseConfig();
  const next = safeNext((await searchParams).next);

  return (
    <main className="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-5xl place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-[2rem] bg-card p-7 shadow-xl shadow-slate-900/10 ring-1 ring-border/80 sm:p-10">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Activity aria-hidden="true" className="size-6" /></span>
        <h1 className="mt-8 text-3xl font-bold tracking-tight">Your dashboard, privately yours.</h1>
        <p className="mt-3 leading-7 text-muted-foreground">Sign in with Google to keep your personal data connected to one account.</p>
        <div className="mt-8">
          {config ? <GoogleSignInButton url={config.url} publishableKey={config.publishableKey} next={next} /> : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><DatabaseZap aria-hidden="true" className="size-5" /><p className="mt-3 font-semibold">Supabase setup is not connected yet.</p><p className="mt-1 text-sm leading-6">Add the two public Supabase values to <code>.env.local</code>, then restart the development server.</p></div>
          )}
        </div>
        <p className="mt-6 text-xs leading-5 text-muted-foreground">This sign-in identifies you in the app. Gmail access will require separate consent in a later sprint.</p>
      </section>
    </main>
  );
}
