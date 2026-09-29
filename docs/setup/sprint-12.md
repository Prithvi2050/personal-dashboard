# Sprint 12 — news-source foundation

## Scope and decisions

The user chose a mix of India and global coverage. This sprint replaces the dummy Briefing cards with a **Briefing inbox**, not a completed daily digest.

- Settings → News sources: opt into each source independently; all start disabled.
- Initial catalog: BBC News Business, BBC News Technology, Reserve Bank of India releases, and US Federal Reserve releases.
- India coverage currently means RBI financial releases, not comprehensive Indian business/technology reporting. Broader publishers need a separate feed/usage review.
- Manual collection of headline, original URL, publication time, source and collection time only. No full-text scraping, images, descriptions, AI summaries, clustering, paid provider, scheduled job or Home snapshot.
- Source choices and articles are private to the signed-in user, unlike household spending.
- Last seven days; newest 150 links from enabled sources. Up to 50 recent candidates per feed per collection. Repeated source/URL pairs do not create duplicates. Cross-publisher clustering belongs to Sprint 13.
- RBI's observed feed timestamps omit the offset. This adapter explicitly assumes India time (+05:30); other timezone-less dates are rejected. Times display in UTC.

## Manual setup

1. Open Supabase SQL Editor.
2. Run the complete new migration **once**: `supabase/migrations/202609290001_news_foundation.sql`.
3. Do not rerun the earlier successful migrations. No new API key, Google permission, environment variable or service-role key is needed.
4. If installing on another machine, run `pnpm install`. The new dependency is `saxes` for bounded XML parsing.
5. Refresh the app and open `/settings/news`.
6. Enable the sources you want, then click **Collect latest headlines**. Open `/briefing` to see the links.

No hosted migration is applied automatically. If setup fails, the app shows a setup/error state rather than invented or zero-success data.

## Security and failure behavior

- Server authenticates every action. RLS limits preferences/articles to their owner; catalog is read-only to authenticated users. Only controlled functions can write.
- Network destinations are fixed in a reviewed source catalog; no arbitrary URL input or redirect following. Publisher article links must match that source's host allowlist and use HTTPS.
- Eight-second fetch timeout, 512 KiB decompressed response limit, XML-only content types, DTD/entity rejection, maximum 32 nesting levels and 500 parsed entries. Malformed feeds fail closed.
- One claim per user/source every five minutes, atomically enforced in PostgreSQL. Disabling a source invalidates pending results; re-enabling cannot bypass the cooldown. A failed/interrupted request can be retried after five minutes.
- Sources fail independently. A failed feed does not remove previously saved links or roll back successful sources. UI reports source errors and skipped items.
- Old articles are hidden by RLS after seven days and physically removed for that user on the next completed collection (including an error result). There is no scheduled purge or provider-backup erasure guarantee yet.
- A zero-item feed is not proof that no news exists. Old, undated, unsafe, repeated or over-limit items are skipped and counted.
- Public feeds are fetched anonymously; no email, account or financial data is sent to publishers.

## Publisher and dependency notes

Use as a private, personal reader with visible publisher attribution and original links. Do not assume this authorizes public/commercial redistribution or later full-text processing. Review usage again before broader deployment or Sprint 13 content acquisition.

- [BBC feed documentation](https://support.bbc.co.uk/platform/feeds/NewsFeeds.htm) and [terms](https://www.bbc.co.uk/usingthebbc/terms/).
- [RBI feed directory](https://www.rbi.org.in/Scripts/rss.aspx).
- [Federal Reserve feed directory](https://www.federalreserve.gov/feeds/feeds.htm).
- [saxes parser documentation](https://github.com/lddubeau/saxes). Version 6.0.0 is pinned; the upstream repository is archived. Application-level size/depth/DTD limits are mandatory, and dependency replacement/security review remains a maintenance consideration.

The Economic Times was not included: its feed terms contain additional aggregation/display restrictions. Additional sources should not be added merely because an RSS endpoint exists.

## Acceptance checklist

- Before the migration: see an actionable setup message.
- With no enabled sources: no requests, disabled collection button and a clear empty inbox.
- Enable one source and collect: only its headlines appear with publisher/date/original link.
- Enable RBI plus global sources: check both appear; no fixed count of five is promised yet.
- Repeat within five minutes: source is skipped. Repeat after cooldown: existing links are not duplicated.
- Disable a source: its links disappear from the inbox; other sources continue working.
- Provider/network failure: visible per-source error; old links retained; retry after cooldown.
- Another signed-in user sees neither your source preferences nor your saved links.
- Check keyboard controls, mobile layout, loading states, and publisher links.

Hosted database and authenticated browser acceptance still require these manual steps. Automated tests use synthetic XML and an isolated local PostgreSQL-compatible database.

The user subsequently confirmed that the Sprint 12 flow works and approved committing and merging it before Sprint 13.

## Deferred work

Sprint 13: story clustering, ranking, five stories per category when enough evidence exists, grounded summaries and source-linked expanded stories. Sprint 14: schedules, snapshots and prepared Home integration. Additional publishers, custom feeds, full-text licensing and richer article pagination remain separately scoped.

## Verification — September 29, 2026

- Full test suite: **92 passed, zero failed**.
- Full ESLint, TypeScript and production build passed; both `/briefing` and `/settings/news` are included.
- Tracked-file `git diff --check` passed, with line-ending warnings only.
- Synthetic tests cover feed normalization, unsafe links, malformed XML, DTDs, bounds, RSS/Atom dates, RBI timezone handling, duplicate URLs, opt-in/cooldown, stale claims, transactional rollback, owner isolation and rendered UI empty/setup states.
- Read-only live smoke checks returned recent links from all four sources; no live articles were written to Supabase.
- Node's existing module-type warnings remain non-fatal. Hosted migration and authenticated browser acceptance remain manual.

Changed code: `src/lib/news/{model,feed,repository}.ts`, three news test files, `src/components/news/`, `src/app/settings/news/`, Briefing page/loading, Settings navigation, database types, package/lock files, and the new SQL migration. Documentation: this guide, README and the spec index.

The preceding Sprints 9–11 package was merged through GitHub PR #5 (`ba43f3e`), and local `main` matches `origin/main`. The earlier local merge is retained on `sprints-9-11-local-backup`. Sprint 12 changes remain uncommitted on `sprint-12-news-foundation` for review.
