import Link from "next/link";
import { CircleUserRound, CloudOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export async function AuthStatus() {
  const supabase = await createClient();

  if (!supabase) {
    return (
      <Link href="/sign-in" className="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex">
        <CloudOff aria-hidden="true" className="size-4" /> Setup required
      </Link>
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <Link href="/sign-in" className="hidden rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:block">Sign in</Link>;
  }

  return (
    <Link href="/settings" aria-label={`Signed in as ${user.email ?? "Google user"}`} className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <CircleUserRound aria-hidden="true" className="size-5" />
    </Link>
  );
}
