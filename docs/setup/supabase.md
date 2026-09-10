# Supabase and Google sign-in setup

Sprint 2 includes the application integration, but live sign-in requires a personal Supabase project and Google OAuth credentials.

## 1. Create the Supabase project

Create a project at Supabase and copy its Project URL and publishable key into `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
DEFAULT_TIMEZONE=Asia/Kolkata
```

Never put a service-role key in a `NEXT_PUBLIC_` variable.

## 2. Apply the migration

Open the Supabase SQL editor and run `supabase/migrations/202609100001_create_users.sql`. This creates the application user profile, row-level security policies, and Auth synchronization trigger.

## 3. Configure Google

In Google Auth Platform, create a Web application OAuth client. Add the callback URL displayed in Supabase's Google provider settings, normally:

```text
https://YOUR-PROJECT.supabase.co/auth/v1/callback
```

Add `http://localhost:3000` as an authorized JavaScript origin. In Supabase **Authentication → Providers → Google**, enable Google and enter the client ID and secret.

## 4. Configure redirects

In Supabase **Authentication → URL Configuration** set:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`

Add the production URL later when deployment begins.

## 5. Test

Restart `pnpm dev`, visit `/sign-in`, and continue with Google. After sign-in, verify that a row exists in `public.users` and its timezone is `Asia/Kolkata`.

Application sign-in does not grant Gmail access. That remains a separate later-sprint permission.
