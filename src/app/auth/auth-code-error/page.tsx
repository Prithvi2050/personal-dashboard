import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { safeNextPath } from "@/lib/auth/paths";

export default async function AuthCodeErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string; next?: string }> }) {
  const params = await searchParams;
  const messages: Record<string, string> = {
    missing_code: "The login callback did not contain a sign-in code. Start a fresh sign-in.",
    configuration: "The application could not initialize its authentication connection.",
    bad_code_verifier: "This login attempt does not match the browser's saved verification. Start a fresh sign-in in one browser tab.",
    pkce_verifier_missing: "The browser's login verification cookie is missing. Start and finish sign-in in the same browser, with cookies enabled.",
    flow_state_not_found: "This sign-in attempt was already used or is no longer available. Start a fresh sign-in.",
    flow_state_expired: "This sign-in attempt expired. Start a fresh sign-in.",
    validation_failed: "The authentication service rejected the login verification data.",
    unexpected_failure: "The authentication service encountered an internal error.",
    invalid_credentials: "The authentication service rejected the credentials for this request.",
    invalid_grant: "This sign-in code is invalid or has already been used.",
    request_timeout: "The authentication service did not respond in time. Please retry.",
    session_exchange_failed: "The app could not complete the login session. Please retry.",
  };
  const reason = params.reason && Object.hasOwn(messages, params.reason) ? params.reason : "session_exchange_failed";
  return <section className="mx-auto max-w-xl px-5 py-12 text-center"><CircleAlert aria-hidden="true" className="mx-auto size-10 text-destructive" /><h1 className="mt-6 text-3xl font-bold tracking-tight">Sign-in needs attention</h1><p className="mt-3 leading-7 text-muted-foreground">{messages[reason]}</p><p className="mt-3 text-sm text-muted-foreground">Error reference: <code>{reason}</code></p><Link href={"/sign-in?next=" + encodeURIComponent(safeNextPath(params.next))} className="mt-8 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Try a fresh sign-in</Link></section>;
}
