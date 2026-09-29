import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export class GmailError extends Error {}
export type Sender = { id: string; user_id: string; sender_email: string; sender_name: string; institution: string; enabled: boolean };
export type GmailState = { status: "idle" | "success" | "error"; message: string };
export type GmailConfig = { clientId: string; clientSecret: string; redirectUri: string; key: string };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function emailAddress(value: unknown): string {
  if (typeof value !== "string") throw new GmailError("Enter one exact sender email address.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9][a-z0-9._%+\-]*@[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)+$/.test(email)) throw new GmailError("Enter one exact sender email address; wildcards and search operators are not supported.");
  return email;
}
export function senderQuery(addresses: string[]): string {
  const senders = [...new Set(addresses.map(emailAddress))];
  if (!senders.length || senders.length > 20) throw new GmailError("Enable between 1 and 20 approved senders first.");
  return `newer_than:7d {${senders.map(email => `from:${email}`).join(" ")}}`;
}
export function headerSender(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1000 || /[\r\n]/.test(value)) return null;
  const match = value.match(/^[^<>]*<([^<>]+)>\s*$/);
  try { return emailAddress(match ? match[1] : value); } catch { return null; }
}
function encryptionKey(key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new GmailError("Configure GMAIL_TOKEN_ENCRYPTION_KEY as 64 hexadecimal characters on the server.");
  return Buffer.from(key, "hex");
}
export function seal(plain: string, key: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function unseal(value: string, key: string, context: string): string {
  try {
    if (value.length > 16000) throw new Error();
    const [version, iv, tag, encrypted, extra] = value.split(".");
    if (version !== "v1" || extra !== undefined || !iv || !tag || !encrypted) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch { throw new GmailError("Gmail credentials could not be read. Check the encryption key or reconnect Gmail."); }
}
export function beginOAuth(config: GmailConfig, userId: string, now = Date.now()) {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: GMAIL_SCOPE, access_type: "offline", prompt: "consent select_account", include_granted_scopes: "false", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return { url: url.toString(), cookie: seal(JSON.stringify({ state, verifier, expires: now + 600000 }), config.key, `gmail-oauth:${userId}`) };
}
export function verifyOAuth(cookie: string, state: string, key: string, userId: string, now = Date.now()): string {
  try {
    const value = object(JSON.parse(unseal(cookie, key, `gmail-oauth:${userId}`)));
    if (typeof value.state !== "string" || typeof value.verifier !== "string" || typeof value.expires !== "number" || value.expires <= now || value.expires > now + 600000 || !/^[\w-]{43}$/.test(state) || value.state.length !== state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(value.state))) throw new Error();
    return value.verifier;
  } catch { throw new GmailError("This Gmail connection attempt expired or belongs to another session. Start again."); }
}

// The adapter never logs provider payloads and never follows arbitrary redirects.
export function gmailProvider(config: GmailConfig, request: typeof fetch = fetch) {
  async function json(url: string, init: RequestInit) {
    try {
      const response = await request(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new GmailError(response.status === 401 || response.status === 400 ? "Gmail authorization failed. Reconnect Gmail and retry." : "Gmail is unavailable. Check API setup or try again later.");
      return object(await response.json());
    } catch (error) { throw error instanceof GmailError ? error : new GmailError("Gmail could not be reached. Please try again later."); }
  }
  async function token(parameters: Record<string, string>) {
    const result = await json("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...parameters }) });
    if (typeof result.access_token !== "string" || !result.access_token || result.access_token.length > 8000 || String(result.token_type).toLowerCase() !== "bearer") throw new GmailError("Google returned an invalid authorization response.");
    return result as Record<string, unknown> & { access_token: string };
  }
  return {
    async exchange(code: string, verifier: string) {
      const result = await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: config.redirectUri });
      if (typeof result.scope !== "string" || !result.scope.split(" ").includes(GMAIL_SCOPE) || typeof result.refresh_token !== "string" || !result.refresh_token || result.refresh_token.length > 8000) throw new GmailError("Gmail read permission or offline access was not granted. Start again and allow Gmail access.");
      const profile = await json("https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=emailAddress", { headers: { Authorization: `Bearer ${result.access_token}` } });
      return { refreshToken: result.refresh_token, email: emailAddress(profile.emailAddress) };
    },
    async probe(refreshToken: string, addresses: string[]) {
      const q = senderQuery(addresses); // Fail closed before any request when no senders are enabled.
      const result = await token({ grant_type: "refresh_token", refresh_token: refreshToken });
      const headers = { Authorization: `Bearer ${result.access_token}` };
      const query = new URLSearchParams({ q, maxResults: "20", includeSpamTrash: "false", fields: "messages/id,nextPageToken" });
      const page = await json(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${query}`, { headers });
      if (page.messages !== undefined && !Array.isArray(page.messages)) throw new GmailError("Gmail returned an invalid message list.");
      const messages = (page.messages ?? []) as unknown[];
      if (messages.length > 20) throw new GmailError("Gmail returned too many messages.");
      const ids = [...new Set(messages.map(message => {
        const id = object(message).id;
        if (typeof id !== "string" || !/^[a-f0-9]{1,64}$/i.test(id)) throw new GmailError("Gmail returned an invalid message ID.");
        return id;
      }))];
      const allowed = new Set(addresses.map(emailAddress));
      let matched = 0;
      for (let index = 0; index < ids.length; index += 5) {
        const batch = await Promise.all(ids.slice(index, index + 5).map(async id => {
          const metadata = await json(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&fields=id,payload/headers`, { headers });
          const values = object(metadata.payload).headers;
          if (metadata.id !== id || !Array.isArray(values)) throw new GmailError("Gmail returned incomplete headers. Retry the check.");
          const from = values.map(object).filter(header => typeof header.name === "string" && header.name.toLowerCase() === "from");
          const sender = from.length === 1 ? headerSender(from[0].value) : null;
          return sender !== null && allowed.has(sender);
        }));
        matched += batch.filter(Boolean).length;
      }
      // Only counts leave the adapter. No IDs, headers, subjects or bodies are persisted.
      return { checked: ids.length, matched, more: typeof page.nextPageToken === "string" && Boolean(page.nextPageToken) };
    },
    async revoke(refreshToken: string): Promise<boolean> {
      try { const result = await request("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) }); return result.ok; } catch { return false; }
    },
  };
}
