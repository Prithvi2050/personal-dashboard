import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { calculatePortion } from "./quick-meal.ts";

test("quick-meal migration and owner-isolated atomic persistence in local PostgreSQL", async t => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const foodId = "33333333-3333-4333-8333-333333333333";
  const utensilId = "44444444-4444-4444-8444-444444444444";
  const otherFoodId = "55555555-5555-4555-8555-555555555555";
  const otherUtensilId = "66666666-6666-4666-8666-666666666666";
  const requestId = "77777777-7777-4777-8777-777777777777";
  const exact = { food_id: foodId, utensil_id: null, fraction: null, quantity: 50 };
  const calibrated = { food_id: foodId, utensil_id: utensilId, fraction: 0.5, quantity: null };
  const save = (items, id = crypto.randomUUID()) => db.query("select public.save_quick_meal($1::uuid, 'Lunch', $2::jsonb) as id", [id, JSON.stringify(items)]);
  const count = async table => Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);
  try {
    // Supabase infrastructure stand-ins only. Actual Sprint 5 and 6 migrations run below.
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      grant usage on schema auth to authenticated, anon;
      create table public.users(id uuid primary key);
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key, bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as 'select string_to_array($1, ''/'')';`);
    await db.exec(await readFile(new URL("../../../supabase/migrations/202609110002_foods_utensils.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../../../supabase/migrations/202609120001_quick_meals.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../../../supabase/migrations/202609130001_photo_meals.sql", import.meta.url), "utf8"));
    await db.exec("grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated");
    await db.query("insert into public.users(id) values ($1), ($2)", [owner, other]);
    for (const [id, user] of [[foodId, owner], [otherFoodId, other]]) await db.query("insert into public.foods(id,user_id,name,serving_basis,serving_quantity,calories,protein,carbs,fat,source) values($1,$2,'Synthetic food','g',100,200,10,30,4,'Synthetic test source')", [id, user]);
    for (const [id, user] of [[utensilId, owner], [otherUtensilId, other]]) await db.query("insert into public.utensils(id,user_id,name,type,capacity_ml,reference_image_path) values($1,$2,'Synthetic bowl','bowl',250,$3)", [id, user, `${user}/reference.jpg`]);
    await db.query("insert into public.utensil_food_profiles values($1,$2,$3,180)", [owner, utensilId, foodId]);
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);

    await t.test("saves several items with SQL totals matching deterministic preview", async () => {
      await save([exact, calibrated], requestId);
      assert.equal(await count("meals"), 1); assert.equal(await count("meal_items"), 2);
      const meal = (await db.query("select * from public.meals")).rows[0];
      assert.equal(Number(meal.total_calories), 280);
      const items = (await db.query("select * from public.meal_items order by position")).rows;
      const preview = calculatePortion({ id: foodId, serving_basis: "g", serving_quantity: 100, calories: 200, protein: 10, carbs: 30, fat: 4 }, calibrated, [{ food_id: foodId, utensil_id: utensilId, full_serving_grams: 180 }]);
      assert.equal(Number(items[1].calories), preview.calories);
      assert.equal(Number(items[1].quantity), 90);
      assert.equal(items[1].source, "Synthetic test source");
      assert.equal(items[1].user_confirmed, true);
    });
    await t.test("retry is idempotent and direct totals/items writes are denied", async () => {
      await save([exact, calibrated], requestId);
      assert.equal(await count("meals"), 1);
      await assert.rejects(db.query("update public.meals set total_calories=0"), /permission denied/);
      await assert.rejects(db.query("delete from public.meal_items"), /permission denied/);
    });
    await t.test("foreign ownership and invalid second item roll back the whole meal", async () => {
      for (const bad of [{ ...exact, food_id: otherFoodId }, { ...calibrated, utensil_id: otherUtensilId }, { ...exact, quantity: -1 }, { ...exact, quantity: 1.001 }, { ...calibrated, fraction: 0.3 }]) {
        await assert.rejects(save([exact, bad]));
        assert.equal(await count("meals"), 1); assert.equal(await count("meal_items"), 2);
      }
      await assert.rejects(save([])); await assert.rejects(save(Array(21).fill(exact)));
    });
    await t.test("saved snapshots survive edits and utensil photo/capacity stay untouched", async () => {
      await db.query("update public.foods set calories=500 where id=$1", [foodId]);
      await db.query("update public.utensil_food_profiles set full_serving_grams=300 where food_id=$1", [foodId]);
      const rows = (await db.query("select calories,full_serving_grams from public.meal_items order by position")).rows;
      assert.equal(Number(rows[1].calories), 180); assert.equal(Number(rows[1].full_serving_grams), 180);
      const utensil = (await db.query("select capacity_ml,reference_image_path from public.utensils")).rows[0];
      assert.equal(Number(utensil.capacity_ml), 250); assert.equal(utensil.reference_image_path, `${owner}/reference.jpg`);
    });
    await t.test("RLS hides both tables from a second account, even with known meal ID", async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
      assert.equal(await count("meals"), 0); assert.equal(await count("meal_items"), 0);
      await assert.rejects(save([exact]));
      await save([{ ...exact, food_id: otherFoodId }], requestId);
      assert.equal(await count("meals"), 1);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
      assert.equal(await count("meals"), 1);
    });
    await t.test("photo analysis claims, private uploads, review snapshots and save retries", async () => {
      const draftId = crypto.randomUUID();
      const claim = () => db.query("select public.claim_photo_analysis($1,'test-model',$2::uuid[]) as claimed", [draftId, [utensilId]]);
      assert.equal((await claim()).rows[0].claimed, true);
      assert.equal((await claim()).rows[0].claimed, false);
      await assert.rejects(db.query("select public.claim_photo_analysis($1,'test-model',$2::uuid[])", [crypto.randomUUID(), [otherUtensilId]]));
      const result = { items: [{ name: "Synthetic detection", food_id: foodId, utensil_id: utensilId, confidence: 0.4, quantity: 90, fraction: 0.5, note: "Uncertain" }], warning: "Test" };
      await db.query("insert into storage.objects(id,bucket_id,name) values($1,'meal-images',$2)", [crypto.randomUUID(), `${owner}/${draftId}.jpg`]);
      await assert.rejects(db.query("insert into storage.objects(id,bucket_id,name) values($1,'meal-images',$2)", [crypto.randomUUID(), `${other}/${draftId}.jpg`]));
      await db.query("update public.photo_drafts set status='ready',result=$1::jsonb where id=$2", [JSON.stringify(result), draftId]);
      const changed = await db.query("update public.photo_drafts set result='{}' where id=$1 returning id", [draftId]);
      assert.equal(changed.rows.length, 0);
      const reviewed = { ...exact, quantity: 25, source_index: 0, reviewed: true };
      const confirm = items => db.query("select public.save_photo_meal($1,'Lunch',$2::jsonb) as id", [draftId, JSON.stringify(items)]);
      await assert.rejects(confirm([{ ...reviewed, reviewed: false }]));
      await assert.rejects(confirm([{ ...reviewed, source_index: 19 }]));
      await assert.rejects(confirm([reviewed, { ...reviewed, food_id: otherFoodId }]));
      assert.equal(await count("meals"), 1);
      const savedId = (await confirm([reviewed])).rows[0].id;
      assert.equal((await confirm([reviewed])).rows[0].id, savedId);
      assert.equal(await count("meals"), 2);
      const saved = (await db.query("select * from public.meal_items where meal_id=$1", [savedId])).rows[0];
      assert.equal(Number(saved.quantity), 25); assert.equal(Number(saved.calories), 125);
      assert.equal(saved.ai_detection.quantity, 90); assert.equal(saved.ai_detection.confidence, 0.4);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
      assert.equal(await count("photo_drafts"), 0);
      assert.equal((await db.query("select * from storage.objects where bucket_id='meal-images'")).rows.length, 0);
      await assert.rejects(confirm([reviewed]));
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
      for (let i=1;i<20;i++) await db.query("select public.claim_photo_analysis($1,'test-model','{}'::uuid[])", [crypto.randomUUID()]);
      await assert.rejects(db.query("select public.claim_photo_analysis($1,'test-model','{}'::uuid[])", [crypto.randomUUID()]), /Daily analysis limit/);
    });
    await t.test("signed-out users cannot execute the write function or read tables", async () => {
      await db.query("select set_config('request.jwt.claim.sub','',false)");
      await assert.rejects(save([exact]), /Sign in required/);
      await db.exec("reset role; set role anon");
      await assert.rejects(save([exact]), /permission denied/);
      await assert.rejects(db.query("select * from public.meals"), /permission denied/);
    });
  } finally { await db.close(); }
});
