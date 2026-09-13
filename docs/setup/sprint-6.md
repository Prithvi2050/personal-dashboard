# Sprint 6 — quick meal logging

## Manual setup

1. Complete the Sprint 5 library migration first. Existing foods, USDA imports, utensil photographs, dimensions, and calibrations stay in place.
2. In Supabase → SQL Editor → New query, paste the entire file `supabase/migrations/202609120001_quick_meals.sql` and run it **once**. Do not rerun earlier migrations or delete existing tables. The migration runs in a transaction.
3. Refresh `/nutrition`. No additional credentials are required. If the app was stopped, run `pnpm dev`; do not start another server while port 3000 is already occupied.
4. Open Today, choose a food, then a calibrated utensil and ¼/½/¾/Full, or an exact quantity in the food's declared unit. Add one or more foods, choose meal type, and **Confirm & save meal**.

Until the migration is applied, Nutrition displays a setup/retry message, not misleading zero totals. The food library continues to work.

## Behavior and boundaries

- New meals are logged at database server time (now). The journal groups them by the user's saved timezone. This sprint does not add backdating or meal editing/deletion. Existing seven-day navigation reads saved meals; deeper history analytics and weighed-meal QA remain Sprint 8.
- One draft supports 1–20 items. Portions can be removed/replaced before confirmation. Exact input accepts 0.01–10,000 g/ml/pieces with two decimal places. A calibrated weight must be positive and no greater than 10,000 g.
- Only gram-based foods can use food-specific gram calibrations. A food defined per piece or ml must use that unit; no density or piece weight is invented. A future mass-conversion feature can expand this explicitly.
- Calories/macros are computed as `food nutrient × consumed quantity / reference serving quantity`. Calibrated quantity is `full_serving_grams × fraction`. Each item's nutrients are rounded to one decimal and the meal total is the sum of those rounded items.
- Browser previews are estimates based on the loaded library. Saving recalculates from current database foods/calibrations, so library changes in another tab can change the final values. No AI service or USDA request runs during meal logging.
- Drafts live in the current page only. Successful save disables the draft; **Log another meal** creates a fresh request ID. Retry an uncertain request without changing the draft; the owner/request uniqueness constraint prevents another meal from being created.
- Sample preview remains opt-in and never mixes with persisted meals. It has no save form. Home remains its existing demonstration/snapshot work; this sprint updates Nutrition only.
- Reference image paths, private storage policies, dimensions, capacity, and calibration data are not altered. The selected utensil's reference thumbnail helps recognition; image-based portion detection is not implemented until Sprint 7.

## Database and security

- `meals`: owner, request ID, meal type, UTC time, calculated totals, creation timestamp.
- `meal_items`: owner, parent meal, food/utensil IDs, saved food name/source, serving basis/quantity, consumed quantity, fraction, utensil name/full weight, calculated nutrients, confirmed flag, stable position, creation timestamp.
- Historical snapshots prevent later food/calibration edits from rewriting meal history. Referenced foods and utensils cannot be deleted while referenced; no delete UI exists in this sprint. Account deletion still cascades owned records.
- Both tables enable RLS with authenticated owner-only SELECT policies. Direct INSERT/UPDATE/DELETE privileges are revoked. There are no new triggers.
- `save_quick_meal(uuid,text,jsonb)` is the only write entry point. It derives identity from `auth.uid()`, validates input independently of the app, checks all food/utensil/calibration ownership, calculates from database facts, and atomically inserts header/items/totals. Any failure rolls back all records. Duplicate owner/request IDs return the first saved meal.
- The function is SECURITY DEFINER because direct writes must be prevented. It uses an empty search path, fully qualified tables, explicit ownership checks, and revoked PUBLIC/anon execution with authenticated-only EXECUTE. See [Supabase function security](https://supabase.com/docs/guides/database/functions).
- No service-role credentials, Google secrets, or new browser secrets are used.

## Verification

Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.

Automated tests include fraction/exact-unit calculations, invalid/missing calibration rejection, bounded input, and deterministic rounding. `quick-meal-db.test.mjs` uses a development-only, in-memory PGlite PostgreSQL instance. It applies the actual Sprint 5 and 6 migrations against minimal Supabase infrastructure stubs and verifies atomic rollback, duplicate retries, saved snapshots, unchanged utensil reference paths/capacity, owner isolation, and denied anonymous/direct writes. It does not connect to remote Supabase. PGlite is not a replacement for live Supabase/browser verification.

Manual acceptance after migration:

1. Save a one-food half-bowl meal. Check quantity equals half the calibrated full weight and macros equal the proportional food values.
2. Save a meal with multiple foods; expand portion details and confirm the total equals its items. Refresh and confirm persistence and today's totals.
3. Try an exact portion of a per-piece or ml food. Confirm it never uses a gram calibration.
4. Confirm the meal appears only in the correct local day. Sample preview must not alter real totals.
5. Reload the library: prior images, capacities, dimensions, and full weights must still be present.
6. Use a second account to confirm meals/items are private. Sign-out must block logging.
7. After a network failure, retry the unchanged draft; confirm only one meal is created. Edit a food/calibration later and check old meal totals remain unchanged.

## Changed files for this increment

- New: `supabase/migrations/202609120001_quick_meals.sql`
- New: `src/lib/nutrition/quick-meal.ts`, `repository.ts`, `quick-meal.test.mjs`, `quick-meal-db.test.mjs`
- New: `src/components/nutrition/quick-meal-form.tsx`, `src/app/nutrition/actions.ts`, this guide
- Updated: `src/app/nutrition/page.tsx`, `src/components/nutrition/daily-view.tsx`, `src/types/database.ts`, `package.json`, `pnpm-lock.yaml`, `README.md`

No migrations are applied remotely and no changes are committed or pushed automatically.
