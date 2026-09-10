"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton({ url, publishableKey, next }: { url: string; publishableKey: string; next: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: signInError } = await createClient(url, publishableKey).auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (signInError) {
      setError("Google sign-in could not start. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={signIn} disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
        {loading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-white text-xs font-bold text-blue-600">G</span>}
        {loading ? "Opening Google…" : "Continue with Google"}
      </button>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
