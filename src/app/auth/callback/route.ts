import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_CODE_ERROR_PATH, safeNextPath } from "@/lib/auth/paths";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL(AUTH_CODE_ERROR_PATH, url.origin));

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.redirect(new URL(`${AUTH_CODE_ERROR_PATH}?reason=configuration`, url.origin));
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL(AUTH_CODE_ERROR_PATH, url.origin));
  return NextResponse.redirect(new URL(safeNextPath(url.searchParams.get("next")), url.origin));
}
