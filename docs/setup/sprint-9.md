# Sprint 9 — separate Gmail connection and approved senders

## Scope and current status

Implemented locally: Settings → Gmail & approved senders, separate OAuth consent, encrypted refresh-token persistence, disconnect/revocation, sender management and a limited manual header check. No automatic check runs on connection, navigation or page refresh.

The ingestion skeleton intentionally stops at a bounded metadata probe. It searches the last seven days for enabled sender addresses, excludes Spam/Trash, examines at most 20 distinct candidate IDs, requests only From headers, verifies exact addresses and returns counts. Extra pages are explicitly reported, not silently considered synced. Message IDs/headers/bodies/subjects are not persisted. It creates no queue, transaction or watermark. Repeating a probe cannot duplicate transactions because none are written.

Sprint 10 will add tested transaction extraction, authenticated-sender checks appropriate to financial data, durable ingestion, pagination/checkpoints and idempotent transaction storage. A matching From address alone can be spoofed and is not financial evidence. Background scheduling is later work.

## Manual setup — do not alter Supabase Google login

1. Use a **separate Google Cloud project** for Gmail. Do not reuse the project/client used by Supabase Google sign-in. Google revocation affects grants across clients in a project, so project separation avoids coupling the two integrations. [Google OAuth revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke)
2. Enable the Gmail API in that project.
3. Configure its OAuth consent screen for this personal pilot. Add your chosen Gmail account as a test user when using an external app in Testing. Add the `https://www.googleapis.com/auth/gmail.readonly` scope.
4. Create a **Web application** OAuth client in the Gmail project. Register this exact authorized redirect URI for local development:

   ```text
   http://localhost:3000/settings/gmail/callback
   ```

   This is the app's Gmail callback, **not** Supabase's `/auth/v1/callback`. The exchange is server-side. Keep the existing Supabase provider credentials and app sign-in redirect unchanged. In production register `https://your-app-host/settings/gmail/callback` and use that HTTPS origin for `NEXT_PUBLIC_APP_URL`.
5. Put these values in the app's ignored `.env.local` (placeholders below only):

   ```dotenv
   GMAIL_CLIENT_ID=your_separate_gmail_client_id
   GMAIL_CLIENT_SECRET=your_separate_gmail_client_secret
   GMAIL_TOKEN_ENCRYPTION_KEY=your_64_character_hex_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   Generate the encryption key in your own terminal:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Keep it private and stable, backed up separately from the database. Never prefix secrets with `NEXT_PUBLIC_`, commit them or paste them into chat. Rotating/losing this key prevents existing tokens from decrypting; disconnect and reconnect or perform a planned re-encryption migration. Legacy `GOOGLE_CLIENT_ID/SECRET` variables are not used for this feature.
6. In the Supabase project the app uses, run **only** `supabase/migrations/202609170001_gmail_foundation.sql` once in SQL Editor. Prerequisite: the existing `public.users` foundation. This migration adds no changes to nutrition tables. It is not applied automatically.
7. Restart the existing dev server from Cursor's terminal on port 3000; do not launch duplicate servers.
8. Open **Settings → Manage Gmail & approved senders**. Read the consent notice, choose **Connect Gmail separately**, and finish in the same browser within ten minutes. You may choose a financial mailbox different from your dashboard login; the page identifies the connected mailbox. Disconnect before replacing it.
9. Add an exact sender address from a financial message you trust, a friendly name and institution. Explicitly enable it. No bank addresses are seeded or automatically trusted.
10. Read the limited-check notice and choose **Check approved senders**. The first check is an explicit user-authorized live API call. It is not performed by the coding agent during implementation.

## Permission implications

`gmail.readonly` is mailbox-wide and restricted. Google cannot grant access limited to this sender list; the app implements that restriction. The narrower `gmail.metadata` scope does not permit the search `q` parameter, so it cannot support the chosen sender-filtered query. No send, modify, delete, Drive or Calendar scope is requested. [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [message search API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)

External apps in Testing can receive refresh tokens that expire after seven days for Gmail scopes. If authorization is revoked/expired, disconnect and reconnect. Public distribution may require Google verification/security assessment; evaluate the applicable requirements before expanding beyond the personal pilot. [Token expiration](https://developers.google.com/identity/protocols/oauth2#expiration), [restricted scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)

## Security and persistence

- Only authenticated owners can manage their connection/senders. Google login continues to request basic identity only; its callback code is unchanged.
- Connect is a POST Server Action with framework origin protection and an explicit configured-origin check. The callback checks the authenticated dashboard user, random state, encrypted owner-bound HttpOnly cookie, ten-minute expiry and PKCE verifier. It deletes the cookie and redirects to a clean status URL. Codes, provider errors and tokens are not logged by application code; configure production proxy/access-log redaction for OAuth query strings too.
- `financial_senders` contains owner, email, friendly name, institution and enabled flag. Owner-read RLS; writes via owner-derived RPCs. At most 20 records, exact unique lowercase address per owner, no wildcards. Disabled is the default. Removal affects the whitelist, not Gmail messages.
- `gmail_connections` contains owner, unique connection ID, mailbox email, creation time, next-check throttle and AES-256-GCM encrypted refresh token. Random nonces and owner/purpose-bound authenticated encryption prevent ciphertext swapping between accounts.
- The normal table API grants only own metadata column reads. Ciphertext is accessible to the owner's check/disconnect RPCs; plaintext is decrypted only on the server. These RPCs return encrypted strings, never plaintext. No Supabase service-role key is introduced.
- Access tokens exist transiently in server memory and are discarded after the request. Every probe refreshes authorization; no tokens are sent to client components or URL query strings. Connections cannot be silently upserted/replaced.
- A database claim permits one check per connection per minute, including failed attempts. A check is limited to one page / 20 IDs and batches of five header requests. Provider requests time out after 12 seconds; provision a Node request duration of 90 seconds for the page's Server Actions.
- Disconnect removes the local token before attempting Google revocation. A failed revocation is clearly reported with a link to Google account permissions; sender records remain. In-flight checks may finish after disconnect or sender edits but do not persist content. Account deletion removes local records via cascade; it does not itself call Google revocation.
- A successful header match is not a transaction and is not proof of DKIM/DMARC authenticity. No bank/account numbers, amounts, subjects or email bodies are stored in Sprint 9.

## Tests and manual acceptance

Automated tests use synthetic `example.com` mailboxes, random test encryption keys, mocked HTTP responses and local PGlite. The actual migration is exercised for cross-owner isolation, denied token-column reads/direct writes, sender limits/duplicates, throttling and disconnect. Crypto/OAuth tests cover tampering, wrong owner/key/purpose, state expiry, scope refusal, PKCE, exact sender filtering, duplicate IDs and safe provider failures. Tests do not contact Gmail.

Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

After setup, verify:

- Existing dashboard sign-in, nutrition photo logging, history and Settings still work.
- Missing migration/config displays clear setup guidance without secrets.
- Deny consent; retry an expired/wrong-browser attempt; check that dashboard login is unaffected.
- Connect successfully; check the displayed mailbox. Reloading settings makes no Gmail message request.
- Add, rename, disable, re-enable and remove senders; duplicates and malformed addresses are rejected.
- No enabled senders means no Gmail message request. With a sender enabled, explicitly run the probe and check the bounded count message. Do not expect transactions yet.
- Simulate revoked access and retry: show a reconnect error, not fabricated zero results.
- Disconnect and reconnect; sender records remain, old connection ID cannot disconnect a new connection.
- Verify another signed-in account cannot read or alter the first account's connection or senders.
- Check keyboard focus, pending controls, consent labels and narrow-screen forms.

## Files and deferred work

New: `src/lib/gmail/{core.ts,config.ts,repository.ts,core.test.mjs,database.test.mjs}`, `src/app/settings/gmail/{page.tsx,actions.ts,loading.tsx,callback/route.ts}`, `src/components/settings/gmail-forms.tsx`, the migration and this guide.

Updated: settings link, auth public-callback allowlist/tests, database types, `.env.example`, test script and README. No new dependencies. No commit, push, remote migration, Google configuration change or live inbox check was performed during implementation.

Deferred: real OAuth/browser acceptance after manual setup; production restricted-scope review; transaction parsing/classification; robust authenticated-email validation; ingestion persistence/pagination/checkpoints; background jobs; retention/deletion policy for future financial records. Sprint 7–8 weighed-meal QA remains separately pending.
