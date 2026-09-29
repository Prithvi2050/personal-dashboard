"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { beginOAuth, GmailError, type GmailState } from "@/lib/gmail/core";
import { gmailConfig } from "@/lib/gmail/config";
import { gmailSession, loadGmailSettings, changeSender, checkGmail, disconnectGmail } from "@/lib/gmail/repository";
export async function connectGmail(_state: GmailState, form: FormData): Promise<GmailState> {
  let destination: string;
  try {
    if (form.get("consent") !== "yes") throw new GmailError("Read and accept the separate Gmail permission notice first.");
    const config = gmailConfig();
    if ((await headers()).get("origin") !== new URL(config.redirectUri).origin) throw new GmailError("Open Gmail settings using the configured app URL before connecting.");
    const { user } = await gmailSession();
    const settings = await loadGmailSettings();
    if (settings.connection) throw new GmailError("Disconnect the current mailbox before connecting a different one.");
    const attempt = beginOAuth(config, user.id);
    (await cookies()).set("pd-gmail-oauth", attempt.cookie, { httpOnly: true, secure: config.redirectUri.startsWith("https:"), sameSite: "lax", path: "/settings/gmail/callback", maxAge: 600 });
    destination = attempt.url;
  } catch (error) { return { status: "error", message: error instanceof GmailError ? error.message : "Gmail connection could not start. Check setup and try again." }; }
  redirect(destination);
}
export async function gmailAction(_state: GmailState, form: FormData): Promise<GmailState> {
  let destination: string | null = null;
  let message: string;
  try {
    const operation = form.get("operation");
    if (operation === "check") message = await checkGmail(form);
    else if (operation === "disconnect") {
      const status = await disconnectGmail(form);
      destination = `/settings/gmail?status=${status}`;
      message = "Gmail connection updated.";
    }
    else if (operation === "save" || operation === "remove") message = await changeSender(form);
    else throw new GmailError("Unknown Gmail settings action.");
    revalidatePath("/settings/gmail");
  } catch (error) { return { status: "error", message: error instanceof GmailError ? error.message : "Gmail settings could not be updated. Please retry." }; }
  // Disconnect unmounts its form; preserve the revocation outcome on the next page.
  if (destination) redirect(destination);
  return { status: "success", message };
}
