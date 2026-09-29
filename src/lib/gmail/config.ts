import "server-only";
import { GmailError, type GmailConfig } from "@/lib/gmail/core";
export function gmailConfig(): GmailConfig {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
  const key = process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!clientId || !clientSecret || !key || !origin) throw new GmailError("Configure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_TOKEN_ENCRYPTION_KEY and NEXT_PUBLIC_APP_URL, then restart. See docs/setup/sprint-9.md.");
  let url: URL;
  try { url = new URL(origin); } catch { throw new GmailError("NEXT_PUBLIC_APP_URL must be a valid app origin."); }
  if (url.origin !== origin || url.username || url.password || !(url.protocol === "https:" || url.protocol === "http:" && url.hostname === "localhost") || !/^[a-f0-9]{64}$/i.test(key)) throw new GmailError("Use an HTTPS app origin (HTTP localhost for development) and a 64-character hexadecimal Gmail encryption key.");
  return { clientId, clientSecret, key, redirectUri: `${url.origin}/settings/gmail/callback` };
}
