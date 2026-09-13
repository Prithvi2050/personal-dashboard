# Sprint 5: Personal foods, utensils and calibration

## Manual setup

In Supabase SQL Editor, review and run `supabase/migrations/202609110002_foods_utensils.sql` once after the previous migrations. It creates three tables and the private utensil-images bucket with a 3 MB size limit and JPEG/PNG/WebP allowlist. No additional credentials or environment variables are required. This migration has not been applied remotely by the coding agent.

Restart pnpm dev after updating next.config.ts (Server Action body limit is 4 MB, allowing a 3 MB image plus multipart overhead).

## Model and scope decisions

- Foods have user_id despite the architecture sketch omitting it: the product specifies a private personal library.
- Foods record serving quantity/unit (g, ml, piece), nutrients for that entire serving, and a required source label. No recipe builder, paid API or inferred nutrition.
- Utensils record physical capacity/dimensions separately from food-specific mass.
- Calibrations are unique per utensil/food pair. Saving an existing pair updates its weight.
- Composite foreign keys require calibration, food and utensil to have the same owner; RLS additionally restricts reads/inserts/updates to auth.uid().
- reference_image_path stores a private object key instead of a permanent public URL. Images use signed links valid for 15 minutes; refresh the page to renew.
- Upload filenames are generated UUIDs under the authenticated user's folder. The server checks file size, MIME type and signature; bucket restrictions are additional checks. Photos retain their original bytes and may contain metadata; use reference photos without sensitive background content.
- Replacing a photo saves the new record before best-effort removal of the previous object. Failed record saves attempt to remove the new upload. Storage and database operations are not a distributed transaction: failed cleanup can leave private orphan objects for administrator review.
- Add/edit is implemented. Record deletion, image removal without replacement, search/pagination, food image galleries, meals, AI and portion calculations are deferred.
- Loading all personal-library records is suitable for the pilot; pagination is deferred.
- Existing Nutrition sample meals remain independent of library data.

## Manual acceptance checks

1. Open Settings > Open personal library. Empty states should appear.
2. Add a food with nutrients per 100 g and a source label. Refresh and edit it; confirm persistence.
3. Add a utensil with capacity/dimensions and a JPEG/PNG/WebP image up to 3 MB.
4. Refresh and confirm the private image displays. Edit without choosing a file and confirm it is retained; replace it and confirm the new image.
5. Save a full-serving food weight, excluding utensil weight. Refresh and update the same pair: only one calibration should remain.
6. Try negative values, missing source, invalid image types and oversized files. Confirm rejection and retry behavior.
7. With a second user, confirm tables and bucket folders cannot be read or changed across accounts. A calibration pointing at another owner's food/utensil must fail.
8. Sign out: /settings/library requires login.
9. Confirm Sprint 3 settings and Sprint 4 sample preview still work.

Run pnpm lint, pnpm typecheck, pnpm test, pnpm build. Unit tests use synthetic records only. Live database/storage behavior and authenticated visual review require manual migration and account testing.

## Sources

[Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [private bucket behavior](https://supabase.com/docs/guides/storage/buckets/fundamentals).
