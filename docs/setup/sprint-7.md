# Sprint 7 — photo meal review

## One-time manual setup

1. Sprints 5 and 6 must already be applied. In Supabase SQL Editor, run the full contents of `supabase/migrations/202609130001_photo_meals.sql` once. Do not rerun older migrations or delete tables. No remote migration is run by the agent.
2. Create an OpenAI API project/key and configure API billing as needed. Put the following in the ignored app `.env.local`, never `.env.example` or a browser-prefixed variable:

   ```dotenv
   OPENAI_API_KEY=your_actual_key
   OPENAI_VISION_MODEL=gpt-4.1-mini
   ```

   The old reserved `AI_API_KEY` is not used by this adapter. Google, USDA and Supabase keys are unrelated. OpenAI API access/billing is separate from the editor sign-in. Do not paste the key into chat or GitHub.
3. Restart the existing development server (Ctrl+C in its terminal, then `pnpm dev`). Keep port 3000 for the established Google login redirects.
4. Open Nutrition → Log meal with a photo. Select a JPEG/PNG/WebP up to 3 MB and 20 megapixels. Choose up to three saved utensils as references, read the consent notice, and click Analyze.
5. Review the result, fix food matches/portions, and confirm. Saved photos appear in the journal. Opening Recent analyses resumes a result without making another AI call.

Deployment must allow a Node request of up to 90 seconds (route maxDuration is 90; provider timeout is 55 seconds). Hosting limits may be lower. This is synchronous analysis with visible pending state, not a background job. Keep quick logging available when the provider is unavailable.

## Provider decision

The owner explicitly approved OpenAI and transmission of meal/selected utensil photos. The OpenAI Docs skill informed the Responses API image input, strict JSON schema, and server-side integration. The provider is behind `MealVisionProvider`; `OPENAI_VISION_MODEL` is configurable. GPT-4.1 mini is an initial supported vision/structured-output baseline, not a claim of best accuracy or lowest current cost. Validate it against weighed meals before relying on estimates.

Official references: [images and vision](https://developers.openai.com/api/docs/guides/images-vision), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

## Privacy and validation

- Only an explicit Analyze submission sends data. OpenAI receives the resized meal image, selected reference images/dimensions, and up to 100 saved food names/IDs/units. No email, user profile, goals, spending, or authentication credentials are included. Internal food/utensil UUIDs are included solely for matching.
- The key stays in a server-only repository boundary. Requests use fixed provider/storage endpoints, never arbitrary browser URLs. Provider exceptions, keys and image contents are not logged or returned in errors.
- Sharp decodes and re-encodes images, removes EXIF/location metadata, rejects corrupt/type-mismatched/animated/oversized images, limits pixel count, and resizes meal images to fit 1600×1600 and references to fit 768×768. Existing utensil files are not modified.
- Responses use `store:false`. This is not a promise of zero provider retention: review OpenAI account data controls and policies separately. The app retains sanitized meal photos and validated analysis privately in Supabase, including failed/interrupted attempts whose upload succeeded. Automatic cleanup/retention and in-app deletion are deferred; an administrator must remove abandoned storage objects when appropriate.
- Photo storage is private. Authenticated owners can read their images and insert only the exact path of a processing draft. Client overwrites/deletes are not granted. Signed display links expire after 15 minutes; refresh to renew.
- Image text/library labels are treated as untrusted prompt data. Outputs have bounded names, quantities, fractions, confidence and item counts. Unknown food/utensil IDs are cleared; unmatched foods are flagged uncertain. Refusals, malformed/incomplete output and no-food photos never fabricate calories.
- The model suggests food, utensil, fraction or quantity; SQL calculates final macros from owned food/calibration records. Millilitres are not grams. Gram calibrations cannot be used for foods defined per ml/piece. Unknown quantities require manual review, not guessed conversions.

## Confidence and review

- Above 85%: prefilled editable suggestions; the final Confirm action accepts them. The reviewed checkbox can be cleared.
- 60–85%: require explicit food/portion verification.
- Below 60% or unmatched food: leave the food unselected and require the user to choose the food and portion.
- Confidence is a model self-estimate, not a calibrated probability or clinical accuracy score.
- Changes reset the row's reviewed checkbox. Users can remove false detections, add missed foods, and change fractions/quantity before confirming. Missing library foods can be added in another tab; reloading the review picks them up but resets unsaved review edits.
- The whole original validated analysis remains in the draft. Each final meal item stores its original `ai_detection` (or null for manually added items), plus the user-confirmed final food, quantity and nutrient snapshot. Final totals sum the saved item values.
- Meals use the analysis-start timestamp for their journal date, interpreted in the user's timezone. Later review does not move the meal to a new day.

## Database changes

- `photo_drafts`: owner, ID, private photo path, status, model, structured result, selected reference IDs, creation time and optional saved meal ID. RLS permits own reads and processing→ready/failed completion; completed results cannot be modified through the normal authenticated API. Status/result updates are owner-controlled during processing, so this is personal app provenance, not a tamper-proof AI audit log.
- `claim_photo_analysis`: owner-derived, locked per-user quota check; maximum 20 attempts in a rolling 24-hour window. No direct draft insert/delete privileges. Reusing a request ID does not run the model twice. A new request ID deliberately creates a new potentially billable attempt; identical image contents are not globally deduplicated.
- `meals.photo_path` and `photo_draft_id`, plus `meal_items.ai_detection`.
- `save_photo_meal`: locks an owned ready draft, requires reviewed items and an uploaded image, calls the existing atomic deterministic meal function, saves the association/original detections, and returns the same saved meal on retry. Direct totals and meal-item writes remain denied. No new trigger or service-role key is required.
- Existing foods, utensil photos, dimensions, capacities, calibrations, manual quick logging, login and navigation are preserved. No Gmail, recipes, spending, news or scheduled jobs added.

## Failure/retry behavior

An Analyze request claims its ID once before upload/provider work. A refused/failed/timed-out request does not save a meal. The UI does not automatically call AI again. Check Recent analyses before starting another attempt; timeouts may still incur charges. An interrupted process may leave `processing`; refresh only checks its status. If it remains interrupted, explicitly start a new attempt or use quick logging. Orphan uploads are retained for manual cleanup rather than risking deletion of an uncertain successful save. Repeated confirmation of the same ready draft is safe and atomic.

## Checks and acceptance

Automated tests use synthetic images/data and mocked AI responses, not personal photos or live AI calls. The PGlite test applies the actual migrations with minimal Supabase infrastructure stubs and checks private paths, owner isolation, immutable completed results, quotas, rollback, original/corrected snapshots and duplicate saves. This does not prove real Supabase Storage integration or actual model accuracy.

Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

After manual setup, verify:

1. Upload a clear meal with a calibrated utensil reference; review and save. Refresh the journal and confirm its photo, portions and totals persist.
2. Change a suggested food and fraction before saving; confirm final values reflect the correction, not the original estimate.
3. Try a non-food image, uncertain food and uncalibrated utensil; verify manual review and empty/error states.
4. Reload a ready draft: no new provider request. Confirm twice: exactly one meal. Verify a second account cannot read another draft or image.
5. Try missing/invalid key, corrupt/oversized file, and unavailable reference image. No raw provider errors or secrets should appear.
6. Check keyboard use and narrow-screen layouts. Confirm quick logging and original utensil images/dimensions still work.

## Changed files

New: `src/lib/ai/meal-vision.ts`, `meal-vision.test.mjs`; `src/lib/nutrition/photo-model.ts`, `photo-image.ts`, `photo-image.test.mjs`, `photo-repository.ts`; `src/components/nutrition/photo-upload.tsx`, `photo-review.tsx`; `src/app/nutrition/photo/page.tsx`, `actions.ts`, `loading.tsx`; the Sprint 7 migration and this guide.

Updated: `.env.example`, `package.json`, `pnpm-lock.yaml`, `README.md`, database types, nutrition domain/repository/daily view, and migration integration tests.

No commit, push, remote migration, or live AI request is performed without the corresponding review/setup step.
