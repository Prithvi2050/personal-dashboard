import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (!code || !supabase) return NextResponse.redirect(new URL("/auth/auth-code-error", url.origin));

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) return NextResponse.redirect(new URL("/auth/auth-code-error", url.origin));

  const metadata = data.user.user_metadata;
  const { error: profileError } = await supabase.from("users").upsert({
    id: data.user.id,
    email: data.user.email,
    name: typeof metadata.full_name === "string" ? metadata.full_name : null,
    avatar_url: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
    timezone: process.env.DEFAULT_TIMEZONE ?? "Asia/Kolkata",
    updated_at: new Date().toISOString(),
  });

  const destination = profileError ? "/auth/auth-code-error?reason=profile" : safeNext(url.searchParams.get("next"));
  return NextResponse.redirect(new URL(destination, url.origin));
}
