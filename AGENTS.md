<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Personal Dashboard Development Guidelines

## Source of truth

Read `docs/spec/README.md` and the referenced project specification before editing. If code, a prompt, and the specification disagree, surface the conflict instead of silently changing product behavior.

## Scope

- Implement only the requested sprint or task.
- Do not add features unless requested.
- Keep the MVP simple and monolithic; do not introduce microservices.
- Use TypeScript, avoid `any`, and validate unknown external data.
- Keep business logic outside UI components.
- Keep integrations isolated behind interfaces in `src/lib`.
- Keep secrets and provider calls server-side.
- Store structured facts and user corrections, not only AI prose or totals.

## Product and UI

The app contains Home, Nutrition, Spending, Briefing, and Settings. It should be clean, modern, minimal, card-based, spacious, desktop-first, and responsive. Primary navigation will use a polished pill-style control in Sprint 1.

## Privacy

- Use OAuth; never store email passwords.
- Separate Google login from Gmail consent.
- Request least-privilege scopes and process only approved financial senders.
- Never use real financial, health, email, or API data in fixtures or logs.

## Completion

Run relevant tests, lint, type checks, and the production build. Never claim a check passed unless it was run. Report changed files, results, assumptions, and deferred work.
