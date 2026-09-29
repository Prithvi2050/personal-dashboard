import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { gmailConfig } from "@/lib/gmail/config";
import { verifyOAuth } from "@/lib/gmail/core";
import { gmailSession, finishGmailConnection } from "@/lib/gmail/repository";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookie = (await cookies()).get("pd-gmail-oauth")?.value;
  let status = "configuration";
  try {
    const config = gmailConfig();
    if (url.origin !== new URL(config.redirectUri).origin) throw new Error();
    status = "session";
    const { user } = await gmailSession();
    status = "expired";
    const verifier = verifyOAuth(cookie ?? "", url.searchParams.get("state") ?? "", config.key, user.id);
    if (url.searchParams.has("error")) status = "denied";
    else {
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) throw new Error();
      status = "failed";
      await finishGmailConnection(code, verifier);
      status = "connected";
    }
  } catch { /* Never include provider responses, OAuth codes or credentials in errors. */ }
  const response = NextResponse.redirect(new URL(`/settings/gmail?status=${status}`, url.origin));
  response.cookies.set("pd-gmail-oauth", "", { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/settings/gmail/callback", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
