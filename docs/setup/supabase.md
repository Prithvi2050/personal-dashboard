# Supabase and Google sign-in setup

Sprint 2 contains the local integration and SQL migration. Live authentication still requires manual configuration in your own Supabase and Google projects. No remote migration is applied by this repository change.

## 1. Create and configure Supabase

Create a Supabase project. Copy `.env.example` to `.env.local`, then replace only these placeholders with values from **Project Settings → API**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
DEFAULT_TIMEZONE=Asia/Kolkata
```

The URL and publishable key are designed for browser use and are protected by row-level security. Never put a service-role key or Google client secret in a `NEXT_PUBLIC_` variable, source file, or committed environment file.

Restart the development server whenever environment values change.

## 2. Review and apply the migration manually

Review `supabase/migrations/202609100001_create_users.sql`. When ready, open the Supabase SQL editor, paste the migration, and run it once against the intended project. This creates:

- `public.users`, linked one-to-one to `auth.users`;
- `public.user_settings`, linked one-to-one to `public.users`;
- ownership-only RLS policies for both tables; and
- a trigger that creates or synchronizes the application records after an Auth user is created or updated.

The migration also backfills both tables for Auth users that already exist. Do not use a service-role client in the application to bypass these policies.

## 3. Create the Google OAuth client

In Google Auth Platform, configure the consent screen for basic identity, then create an **OAuth client ID → Web application**. Add:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`

Use the exact callback URL shown in Supabase if it differs. The Google client ID and secret belong in Supabase's provider configuration, not in browser code. This flow requests only Google identity information used by Supabase Auth; it does not request Gmail scopes or grant inbox access.

## 4. Enable Google in Supabase

In **Authentication → Sign In / Providers → Google**, enable the provider and enter the Google client ID and secret.

In **Authentication → URL Configuration**, set:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`

Add the deployed application URL and callback later, when deployment begins.

## 5. Verify locally

Run `pnpm dev`, open `http://localhost:3000/sign-in`, and continue with Google. Confirm that:

1. Google returns to `/auth/callback` and the app opens Home.
2. Refreshing a protected route preserves the session.
3. A row with the Auth user ID exists in both `public.users` and `public.user_settings`.
4. Signing out returns to `/sign-in` and protected routes redirect there.
5. A signed-in user cannot select or update another user's profile or settings row.

If sign-in reports a redirect mismatch, compare all callback URLs character-for-character and ensure the development server was restarted after changing `.env.local`.
