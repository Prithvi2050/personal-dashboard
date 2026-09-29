"use client";
import { useActionState } from "react";
import { connectGmail, gmailAction } from "@/app/settings/gmail/actions";
import type { GmailState, Sender } from "@/lib/gmail/core";
const initial: GmailState = { status: "idle", message: "" };
const field = "mt-2 block w-full rounded-xl border border-input bg-background p-3";
const button = "rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50";
function Status({ state }: { state: GmailState }) { return <p role={state.status === "error" ? "alert" : "status"} className="text-sm leading-6 text-muted-foreground">{state.message}</p>; }
export function GmailConnect({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(connectGmail, initial);
  return <form action={action} className="space-y-4"><fieldset disabled={pending || disabled} className="space-y-4">
    <legend className="sr-only">Separate Gmail consent</legend>
    <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" name="consent" value="yes" required className="mt-1.5"/><span>I allow a separate read-only Gmail connection. Google grants mailbox-wide read permission; this app limits checks to my enabled approved senders. Sprint 9 reads only candidate message IDs and From headers, not bodies or attachments. No transactions are created, no email is sent or modified, and nothing is sent to AI.</span></label>
    <button className={button}>{pending ? "Opening Google…" : "Connect Gmail separately"}</button>
  </fieldset><Status state={state}/></form>;
}
export function GmailCheck({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(gmailAction, initial);
  return <form action={action} className="space-y-4"><input type="hidden" name="operation" value="check"/><fieldset disabled={pending || disabled} className="space-y-4"><legend className="sr-only">Limited Gmail check</legend>
    <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" name="consent" value="yes" required className="mt-1.5"/><span>Check up to 20 candidate messages from the last 7 days, excluding Spam and Trash. Fetch only From headers to verify exact approved addresses; do not save message contents.</span></label>
    <button className={button}>{pending ? "Checking Gmail…" : "Check approved senders"}</button>
  </fieldset><Status state={state}/></form>;
}
export function GmailDisconnect({ id }: { id: string }) {
  const [state, action, pending] = useActionState(gmailAction, initial);
  return <form action={action} className="space-y-3"><input type="hidden" name="operation" value="disconnect"/><input type="hidden" name="id" value={id}/><fieldset disabled={pending} className="space-y-3"><legend className="sr-only">Disconnect Gmail</legend><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirm" value="yes" required/>Disconnect Gmail and remove its stored token. Request Google revocation; keep approved senders. Requests already in flight may finish.</label><button className={button}>{pending ? "Disconnecting…" : "Disconnect Gmail"}</button></fieldset><Status state={state}/></form>;
}
export function SenderForm({ sender }: { sender?: Sender }) {
  const [state, action, pending] = useActionState(gmailAction, initial);
  return <form action={action} className="space-y-4 rounded-2xl border border-border p-5">
    <input type="hidden" name="id" value={sender?.id ?? ""}/>
    <fieldset disabled={pending} className="space-y-4"><legend className="font-semibold">{sender ? sender.sender_email : "Add an approved financial sender"}</legend>
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm">Exact email address<input className={field} name="sender_email" type="email" maxLength={254} required defaultValue={sender?.sender_email}/></label><label className="text-sm">Sender name<input className={field} name="sender_name" maxLength={100} required defaultValue={sender?.sender_name}/></label><label className="text-sm">Institution<input className={field} name="institution" maxLength={100} required defaultValue={sender?.institution}/></label></div>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="enabled" value="yes" defaultChecked={sender?.enabled ?? false}/>Enable this sender for Gmail checks</label>
      <div className="flex gap-4"><button className={button} name="operation" value="save">{pending ? "Working…" : "Save sender"}</button>{sender ? <button className="text-sm text-primary underline" formNoValidate name="operation" value="remove">Remove sender</button> : null}</div>
    </fieldset><Status state={state}/>
  </form>;
}
