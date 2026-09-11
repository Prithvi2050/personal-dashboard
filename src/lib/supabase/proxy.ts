import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isPublicAuthPath, SIGN_IN_PATH } from "@/lib/auth/paths";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  const config = getSupabaseConfig();
  const isPublicPath = isPublicAuthPath(request.nextUrl.pathname);
  if (!config) {
    if (isPublicPath) return NextResponse.next({ request });
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = SIGN_IN_PATH;
    signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    signInUrl.searchParams.set("reason", "configuration");
    return NextResponse.redirect(signInUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isPublicPath) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = SIGN_IN_PATH;
    signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (user && request.nextUrl.pathname === SIGN_IN_PATH) return NextResponse.redirect(new URL("/", request.url));
  return response;
}
