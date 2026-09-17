# Sprint 8 — Nutrition history, goals and weighed-meal QA

## Implemented scope

Nutrition now shows all seven local calendar days (today plus six preceding days), meal counts, calories/protein/carbs/fat, logged totals and average per logged day. Select a row to inspect its meals and daily goal progress. Goals remain editable in Settings. Sample mode uses only illustrative meals and is explicitly labelled.

Unlogged days show dashes, not asserted zero intake. Averages exclude unlogged days but include today if logged; partially logged days are not complete dietary records. Current goals apply to past-day comparisons; historical goal snapshots are not implemented. No automated data deletion is introduced by the seven-day display window.

Existing owner-scoped queries and RLS remain in use. Seven bounded day reads run in parallel; incomplete/truncated results produce the existing recoverable error, never misleading partial totals. Photos are signed only for the selected day. No AI calls occur when reading history. No new database migration, credentials, dependency, scheduler or Gmail access is required. Sprint 7's migration must already be applied.

## Manual acceptance checklist

- Open Nutrition: seven dates reflect the timezone saved in Settings.
- Select each day: row totals match meal-item totals and daily cards.
- Confirm empty days show “No meals logged”; all-empty history has no average.
- Save a quick meal and a photo-reviewed meal: both update today's row and total, survive refresh, and duplicate confirmation does not double-count.
- Change a goal in Settings and return: current-goal row and daily progress update, including unset optional goals and exceeded goals.
- Switch sample mode on/off: no sample data is saved or mixed with real meals.
- Test narrow screens and keyboard access: table scrolls, date links work, focus is visible.
- Verify an account cannot see another account's meals (existing database isolation tests also cover this).

## Weighed-meal pilot — still requires real samples

Do not call photo accuracy validated until real comparisons are recorded. Start with five meals covering a calibrated bowl at quarter/half/full, a piece-based item, and a mixed plate. Use saved food data matching preparation (for example cooked versus dry weight). Tare the empty utensil and weigh each edible food separately. Reference photos and dimensions stay intact.

1. Record measured grams and the stored nutrition per serving for each food.
2. Analyze a photo once using the actual utensil reference. Record the initial suggested identity and quantity before correction. For a calibrated fraction, convert to grams using its food-specific full weight—not ml equals grams.
3. Calculate reference macros = measured grams / serving grams × stored serving macros. For ml/piece records, use matching units or a valid measured conversion; never invent density.
4. Record absolute portion error and percentage error: `abs(estimated - measured) / measured * 100`. Mark percentage N/A for zero weight or incompatible units. Record missed/extra foods separately.
5. Correct the review to measured quantities and save once. Confirm per-item macros and their sum agree with deterministic reference arithmetic (allow 0.1 display rounding per metric/item).
6. Confirm daily and weekly totals reflect only the corrected saved meal, and refreshing/reopening it makes no further AI request.

| Sample | Food / utensil | Measured quantity + unit | Initial estimate + unit | Portion error % | Identity correct? | Corrected macros match? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |

Keep personal results private; do not commit meal photos or health records. These checks assess portion estimation and arithmetic against stored nutrition data, not laboratory calorie accuracy. No percentage accuracy threshold has been agreed; review observed error before choosing one. Synthetic tests do not establish real-world model accuracy.

## Changed files

- `src/lib/nutrition/daily.ts`: pure seven-day summary calculation.
- `src/lib/nutrition/daily.test.mjs`: aggregate, empty/zero, decimal and timezone regression tests.
- `src/lib/nutrition/repository.ts`: skip signing off-screen photos.
- `src/components/nutrition/history-view.tsx`: accessible overview table and goal context.
- `src/components/nutrition/daily-view.tsx`: integrate overview without replacing photo/quick logging.
- `src/app/nutrition/page.tsx`: load seven-day history and reuse selected-day meals.
- This guide and README.

No commit, push, remote migration or paid AI call is part of this implementation. Browser acceptance and weighed-meal evidence remain manual checks before the combined Sprint 7–8 review.
