import Link from "next/link";
import { CircleAlert } from "lucide-react";

export default function AuthCodeErrorPage() {
  return <main className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-xl place-items-center px-5 py-12 text-center"><section><CircleAlert aria-hidden="true" className="mx-auto size-10 text-destructive" /><h1 className="mt-6 text-3xl font-bold tracking-tight">Sign-in needs attention</h1><p className="mt-3 leading-7 text-muted-foreground">Check the Supabase project, Google provider, migration, and redirect URL configuration, then try again.</p><Link href="/sign-in" className="mt-8 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Return to sign in</Link></section></main>;
}
