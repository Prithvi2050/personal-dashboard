# Automatic food lookup (Sprint 5 extension)

## One-time setup

1. Obtain a FoodData Central API key using the official [USDA API guide](https://fdc.nal.usda.gov/api-guide/) → Get an API Key.
2. Add `USDA_API_KEY=your-key` to the app's ignored `.env.local`. Never use a `NEXT_PUBLIC_` prefix or commit the key. This key is unrelated to Google/Supabase credentials.
3. Restart `pnpm dev`. For deployment, configure the same server-only variable in the hosting environment.
4. Sign in and open Settings → Foods & utensils. Search for a food such as `cooked rice`, check preparation, and click **Save to my foods**.

No additional SQL migration is required beyond Sprint 5. End users do not obtain API keys or copy nutrient values.

## Design and scope

- USDA is the initial provider behind `FoodDataProvider`. Its API guide publishes data under CC0 and requests attribution. Each imported food retains its USDA ID and source URL in `source`.
- Searches include Foundation, SR Legacy, and Survey (FNDDS), not Branded. Values are explicitly per 100 grams; no assumption that a millilitre or piece equals a gram. Missing nutrients are excluded, not treated as zero. kcal energy IDs 1008, 2048, then 2047 are supported in that order.
- Only query text and selected USDA ID leave the app for USDA. No account identity, photos, saved foods, or utensil details are sent. Searches are explicit submissions, not a request per keystroke; requests have a 10-second timeout and bounded result count. Do not log keys, request headers, or search text.
- Every search/import authenticates on the server. The browser sends only the selected ID when saving; authoritative nutrients are fetched again. The API key stays in the server-only integration and is sent as a header, not a URL parameter.
- A deterministic owner/USDA-derived UUID makes repeated imports insert-once without schema changes. Existing food values are never overwritten, including user corrections. Existing manual entries are not automatically merged by name. Long USDA descriptions are truncated to the existing 120-character food-name limit; the source link retains the exact identity.
- Imported foods are persisted in the existing owner-protected `foods` table for reuse without further provider calls. Utensil photos, storage paths, dimensions, capacity, and calibration records are unchanged. Imported foods appear in the calibration dropdown after saving.
- This is food-library search, not Sprint 6 meal logging or Sprint 7 photo analysis. Reference photos remain available for that future portion-estimation pipeline. Volume is not mass; food-specific full weights remain necessary for calibrated gram estimates.
- Recipes remain excluded by the MVP specification. Indian dataset importing is deferred pending source/reuse review. Generic dishes are estimates and may differ from a user's recipe. Packaged foods use manual label entry for now.
- Search results are not persistently cached. Before a multi-user rollout add shared per-user/provider rate limits and caching; current bounded requests and provider 429 handling are intended for the personal pilot, not abuse prevention.

## Manual acceptance checks

- With no key: searching shows actionable setup guidance; saved foods and manual entry remain usable.
- With a valid key: search, review per-100-g values/source, save, refresh, and confirm persistence. Repeat the same import: no extra row and no overwritten edits.
- Edit an imported food, then re-import: your correction must survive.
- Confirm the imported food appears in the calibration selector. Save a food/utensil weight and refresh. Existing photos, dimensions, and calibration weights must remain intact.
- Try an unmatched term and invalid/revoked key: show empty/error states with retry/manual fallback, not a crash.
- Signed-out requests must not contact USDA or write foods. A second account must not see another user's saved records (existing RLS).
- Inspect browser network/source: no USDA key and no direct browser requests to USDA. Real authenticated save/RLS/photo checks require the configured local app and user accounts; adapter unit tests do not prove them.
