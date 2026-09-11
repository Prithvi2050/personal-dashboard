# Decision 0001: Supabase foundation

## Status

Accepted for Sprint 2.

## Decision

Use Supabase for managed PostgreSQL and Google-backed application authentication. Use `@supabase/ssr` with cookie-backed PKCE sessions. Keep provider configuration inside Supabase.

The application profile is stored in `public.users`, keyed to `auth.users.id`, with row-level security restricting access to its signed-in owner. The profile includes an IANA timezone and defaults to `Asia/Kolkata` for the initial personal pilot.

## Boundaries

- Google sign-in identifies the application user only.
- Gmail scopes, tokens, and consent are not requested or stored in Sprint 2.
- Gmail will use a separate authorization flow in Sprint 9.
- Service-role keys must never be exposed to the browser or committed.

## Consequences

Supabase supplies both PostgreSQL and auth session infrastructure, reducing MVP maintenance. Provider access remains isolated under `src/lib/supabase` so it can be replaced later.
