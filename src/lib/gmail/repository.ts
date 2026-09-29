import "server-only";
import { createClient } from "@/lib/supabase/server";
import { gmailConfig } from "@/lib/gmail/config";
import { emailAddress, gmailProvider, GmailError, seal, unseal } from "@/lib/gmail/core";
import { uuidPattern } from "@/lib/library/model";

export async function gmailSession() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new GmailError("Sign in to the dashboard, then open Gmail settings again.");
  return { db, user };
}
export async function loadGmailSettings() {
  const { db, user } = await gmailSession();
  const [connection, senders] = await Promise.all([
    db.from("gmail_connections").select("id,email,created_at").eq("user_id", user.id).maybeSingle(),
    db.from("financial_senders").select("*").eq("user_id", user.id).order("sender_email"),
  ]);
  if (connection.error || senders.error) throw new GmailError("Gmail settings need setup. Apply the Sprint 9 migration and check your connection.");
  let configurationError: string | null = null;
  try { gmailConfig(); } catch (error) { configurationError = error instanceof GmailError ? error.message : "Gmail configuration is unavailable."; }
  return { connection: connection.data, senders: senders.data, configurationError };
}
export async function finishGmailConnection(code: string, verifier: string) {
  const { db, user } = await gmailSession();
  const config = gmailConfig();
  const existing = await db.from("gmail_connections").select("id").eq("user_id", user.id).maybeSingle();
  if (existing.error || existing.data) throw new GmailError("Disconnect the current Gmail connection before connecting again.");
  const credentials = await gmailProvider(config).exchange(code, verifier);
  const saved = await db.rpc("connect_gmail", { p_email: credentials.email, p_ciphertext: seal(credentials.refreshToken, config.key, `gmail-token:${user.id}`) });
  if (saved.error) throw new GmailError("Gmail permission was granted but the connection could not be saved. Retry from settings; review Google account permissions if abandoning setup.");
}
function idFrom(form: FormData, optional = false) {
  const id = form.get("id");
  if (optional && (id === null || id === "")) return null;
  if (typeof id !== "string" || !uuidPattern.test(id)) throw new GmailError("Refresh Gmail settings and retry.");
  return id;
}
export async function changeSender(form: FormData) {
  const { db } = await gmailSession();
  if (form.get("operation") === "remove") {
    const result = await db.rpc("remove_financial_sender", { p_id: idFrom(form)! });
    if (result.error) throw new GmailError("The sender could not be removed. Refresh and retry.");
    return "Sender removed from the approved list.";
  }
  const id = idFrom(form, true);
  const email = emailAddress(form.get("sender_email"));
  const name = String(form.get("sender_name") ?? "").trim();
  const institution = String(form.get("institution") ?? "").trim();
  if (!name || name.length > 100 || !institution || institution.length > 100) throw new GmailError("Enter a sender name and institution, up to 100 characters each.");
  const result = await db.rpc("save_financial_sender", { p_id: id, p_email: email, p_name: name, p_institution: institution, p_enabled: form.get("enabled") === "yes" });
  if (result.error) throw new GmailError("Could not save this sender. Use a unique address, keep at most 20 senders, and check the migration/connection.");
  return "Approved sender saved.";
}
export async function checkGmail(form: FormData) {
  if (form.get("consent") !== "yes") throw new GmailError("Confirm the limited Gmail header check first.");
  const { db, user } = await gmailSession();
  const config = gmailConfig();
  const senders = await db.from("financial_senders").select("sender_email").eq("user_id", user.id).eq("enabled", true);
  if (senders.error || !senders.data.length || senders.data.length > 20) throw new GmailError("Enable between 1 and 20 approved senders before checking Gmail.");
  const claim = await db.rpc("claim_gmail_check", {});
  if (claim.error || !claim.data) throw new GmailError("Connect Gmail or wait one minute before checking again.");
  const result = await gmailProvider(config).probe(unseal(claim.data, config.key, `gmail-token:${user.id}`), senders.data.map(sender => sender.sender_email));
  return `Checked ${result.checked} candidate messages from the last 7 days; ${result.matched} had an exact approved From address. ${result.more ? "More candidates exist; this check is capped at 20 and is not a complete sync." : "No further page was reported."} No message content or transactions were saved.`;
}
export async function disconnectGmail(form: FormData) {
  if (form.get("confirm") !== "yes") throw new GmailError("Confirm that you want to disconnect Gmail.");
  const { db, user } = await gmailSession();
  const result = await db.rpc("disconnect_gmail", { p_id: idFrom(form)! });
  if (result.error) throw new GmailError("Gmail could not be disconnected. Please retry.");
  if (!result.data) return "already_disconnected";
  // Local removal happens even if Google is down or the encryption key was lost.
  try {
    const config = gmailConfig();
    const revoked = await gmailProvider(config).revoke(unseal(result.data, config.key, `gmail-token:${user.id}`));
    if (revoked) return "disconnected";
  } catch { /* No token or provider errors leave the server. */ }
  return "revocation_unconfirmed";
}
