# Sprint 4: Nutrition daily view and meal history

This increment uses the roadmap's fixture option. No new database tables, migrations, API permissions, meal writes, food library, AI, or uploads are introduced.

## Behavior

- /nutrition starts with an empty journal. Preview sample meals explicitly enables illustrative data via demo=1.
- All four totals (calories, protein, carbohydrate, fat) are calculated from individual sample food items.
- Goals and timezone come from the signed-in user's Sprint 3 settings. Missing goals display a Settings link, and zero goals never cause division by zero.
- Day navigation covers today and the previous six calendar days. Today follows the saved timezone. Invalid, repeated, future, or out-of-range query dates fall back to today.
- Meals group by Breakfast, Lunch, Snack, Dinner, Other and sort by local sample time.
- Expandable food details show portions and each item's macros; placeholder icons indicate absent photographs.
- Two days ago is deliberately an empty sample day. Three days ago includes an Other meal.
- Fixture times are illustrative local clock times, not stored UTC events. Real timestamp conversion and persisted history will arrive with meal storage.
- The app shell, authentication, onboarding, and Home's existing demo snapshot are preserved.
- Historical sample days use current saved goals; historical goal versioning and trend analytics are deferred to Sprint 8.

## Verification

Run pnpm lint, pnpm typecheck, pnpm test, pnpm build.

Manual checks:
1. Sign in and open Nutrition: empty journal with saved goals.
2. Click Preview sample meals: notice clearly labels sample data.
3. Select yesterday: dinner appears. Select two days ago: zero totals and empty state.
4. Expand Food and portion details and compare item sums to meal/day totals.
5. Change a goal in Settings, return to Nutrition, and confirm the updated target.
6. Check a missing/zero goal and an exceeded goal.
7. Check keyboard navigation, narrow screen scrolling of date controls, and browser back/forward.
8. Exit preview and refresh: sample records are absent.
9. Sign out and open /nutrition: authentication is required.

Automated tests cover timezone boundaries, leap/year dates, date query validation, macro sums, missing/zero/exceeded goals, all meal groups, and ordering without mutation. No personal data is used in fixtures.

## Git base

Sprint 4 was created from the locally available completed Sprint 3 branch because local main still ended at Sprint 2. Merge Sprint 3 into main before merging Sprint 4.
