import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_CODE_ERROR_PATH, safeNextPath } from "@/lib/auth/paths";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  function fail(reason: string) {
    const destination = new URL(AUTH_CODE_ERROR_PATH, url.origin);
    destination.searchParams.set("reason", reason);
    destination.searchParams.set("next", safeNextPath(url.searchParams.get("next")));
    return NextResponse.redirect(destination);
  }
  if (!code) return fail("missing_code");

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return fail("configuration");
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    // Log only a bounded machine code; never log tokens, cookies, or provider messages.
    const knownCodes = ["bad_code_verifier", "flow_state_not_found", "flow_state_expired", "validation_failed", "unexpected_failure", "invalid_credentials", "pkce_verifier_missing", "invalid_grant", "request_timeout"];
    const reason = error?.code && knownCodes.includes(error.code) ? error.code : "session_exchange_failed";
    console.warn("OAuth session exchange failed", { reason, status: error?.status });
    return fail(reason);
  }
  return NextResponse.redirect(new URL(safeNextPath(url.searchParams.get("next")), url.origin));
}
