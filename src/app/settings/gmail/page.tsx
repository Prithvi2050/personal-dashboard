import Link from "next/link";
import { loadGmailSettings } from "@/lib/gmail/repository";
import { GmailError } from "@/lib/gmail/core";
import { GmailConnect, GmailDisconnect, GmailCheck, SenderForm } from "@/components/settings/gmail-forms";
export const maxDuration = 90;
export default async function GmailSettings({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  let data;
  let errorMessage = "Gmail settings are unavailable. Please retry.";
  try { data = await loadGmailSettings(); } catch (error) { if (error instanceof GmailError) errorMessage = error.message; }
  if (!data) return <section role="alert" className="space-y-4 rounded-3xl bg-card p-8"><h1 className="text-2xl font-bold">Gmail setup needs attention</h1><p>{errorMessage}</p><Link href="/settings/gmail" className="text-primary underline">Try again</Link><Link href="/settings" className="ml-4 text-primary underline">Back to Settings</Link></section>;
  const query = await searchParams;
  const messages: Record<string, string> = {
    disconnected: "Gmail disconnected and Google revocation requested. Your approved sender list is retained.",
    already_disconnected: "That connection is already disconnected. Any newer mailbox connection is unchanged.",
    revocation_unconfirmed: "Gmail disconnected locally, but Google revocation could not be confirmed. Remove the separate Gmail project's access in Google account connections below. Your approved sender list is retained.",
    connected: "Gmail connected. No message check runs automatically.",
    denied: "Gmail permission was declined. Dashboard sign-in is unchanged; connect again whenever you are ready.",
    configuration: "Check the server's Gmail variables, encryption key and configured app URL, then restart the app.",
    session: "Your dashboard session is unavailable. Sign in again, then start a new Gmail connection from this page.",
    expired: "This Gmail attempt expired or was opened in another browser/session. Start again and finish within ten minutes in the same browser.",
    failed: "The Gmail connection could not be completed. Check the separate Gmail client credentials, exact callback URL, API/test-user access and Sprint 9 migration. If abandoning an unsuccessful connection, remove this Gmail project's grant in Google account connections.",
  };
  const message = typeof query.status === "string" && Object.hasOwn(messages, query.status) ? messages[query.status] : null;
  return <div className="mx-auto max-w-4xl space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Gmail & approved senders</h1><Link href="/settings" className="text-primary underline">Back to Settings</Link></div>
    <p className="text-muted-foreground">Optional and separate from dashboard login. This sprint establishes the connection and a limited header check—not transaction extraction or automatic syncing.</p>
    {message ? <p role="status" className="rounded-2xl bg-muted p-5">{message}</p> : null}
    {data.configurationError ? <p role="alert" className="rounded-2xl bg-muted p-5">{data.configurationError}</p> : null}
    <section className="space-y-5 rounded-3xl bg-card p-6 ring-1 ring-border"><h2 className="text-xl font-bold">{data.connection ? `Connected mailbox: ${data.connection.email}` : "No Gmail mailbox connected"}</h2>
      {data.connection ? <><GmailCheck disabled={Boolean(data.configurationError) || !data.senders.some(sender => sender.enabled)}/><hr className="border-border"/><GmailDisconnect id={data.connection.id}/></> : <GmailConnect disabled={Boolean(data.configurationError)}/>}
      <p className="text-xs leading-5 text-muted-foreground">Use a separate Google Cloud project for Gmail so revocation does not affect other Google permissions. If revocation fails, remove access for the Gmail project in <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer" className="text-primary underline">Google account connections</a>.</p>
    </section>
    <section className="space-y-4"><h2 className="text-xl font-bold">Approved financial senders · {data.senders.length}/20</h2><p className="text-sm text-muted-foreground">Copy exact sender addresses from messages you trust. Nothing is approved by default. Wildcards are not accepted. A From address alone is not proof of authenticity; this check does not verify or create a financial transaction.</p>
      {!data.senders.length ? <p>No approved senders yet. Add one below and enable it to check the connection.</p> : data.senders.map(sender => <SenderForm key={sender.id + sender.sender_email + String(sender.enabled)} sender={sender}/>)}
      {data.senders.length < 20 ? <SenderForm/> : null}
    </section>
  </div>;
}
