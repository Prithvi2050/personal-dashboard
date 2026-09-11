import Link from "next/link";
import { CircleUserRound, CloudOff, LogOut } from "lucide-react";
import { createOptionalClient } from "@/lib/supabase/server";

export async function AuthStatus() {
  const supabase = await createOptionalClient();

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

  return <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-primary" aria-label={`Signed in as ${user.email ?? "Google user"}`}><CircleUserRound aria-hidden="true" className="size-5" /><span className="hidden max-w-40 truncate text-xs font-semibold lg:block">{user.email}</span><form action="/auth/sign-out" method="post"><button type="submit" aria-label="Sign out" className="grid size-6 place-items-center rounded-full hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><LogOut aria-hidden="true" className="size-4" /></button></form></div>;
}
