import assert from "node:assert/strict";
import test from "node:test";
import { createUsdaProvider, normalizeFood, parseQuery, parseFdcId } from "./food-data.ts";

// Synthetic nutrition only; no personal or live provider records in fixtures.
const nutrients = [[1008, "KCAL", 200], [1003, "G", 10.123], [1005, "G", 30], [1004, "G", 0]];
const sample = (full = false) => ({ fdcId: 123, description: "Example cooked food", dataType: "Foundation",
  foodNutrients: nutrients.map(([id, unitName, value]) => full ? { nutrient: { id, unitName }, amount: value } : { nutrientId: id, unitName, value }) });

test("search and full detail formats normalize equally and preserve a real zero", () => {
  const search = normalizeFood(sample());
  assert.deepEqual(search, normalizeFood(sample(true)));
  assert.equal(search.protein, 10.12);
  assert.equal(search.fat, 0);
  assert.match(search.source, /food-details\/123\/nutrients/);
});
test("missing, negative, wrong-unit, nonfinite nutrients and branded records are excluded", () => {
  for (const value of [-1, null, "10", Infinity, NaN, 1001]) {
    const food = sample(); food.foodNutrients[0].value = value;
    assert.equal(normalizeFood(food), null);
  }
  const wrongUnit = sample(); wrongUnit.foodNutrients[0].unitName = "kJ";
  assert.equal(normalizeFood(wrongUnit), null);
  const missing = sample(); missing.foodNutrients.pop();
  assert.equal(normalizeFood(missing), null);
  assert.equal(normalizeFood({ ...sample(), dataType: "Branded" }), null);
  assert.equal(normalizeFood(null), null);
});
test("Foundation Atwater energy is supported without deriving calories from macros", () => {
  const food = sample(); food.foodNutrients[0].nutrientId = 2048;
  assert.equal(normalizeFood(food).calories, 200);
});
test("untrusted query and IDs are bounded", () => {
  assert.equal(parseQuery(" rice "), "rice");
  for (const query of [null, " ", "a", "a".repeat(81)]) assert.throws(() => parseQuery(query));
  for (const id of [null, "0", "-1", "1.2", "1/../../", "123?key=secret", "1e4"]) assert.throws(() => parseFdcId(id));
  assert.equal(parseFdcId("123"), 123);
});
test("search limits requests, hides credentials from URLs, deduplicates and filters incomplete matches", async () => {
  let calls = 0;
  const provider = createUsdaProvider("synthetic-key", async (url, init) => {
    calls++;
    assert.equal(url, "https://api.nal.usda.gov/fdc/v1/foods/search");
    assert.equal(init.headers["X-Api-Key"], "synthetic-key");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal);
    const body = JSON.parse(init.body);
    assert.equal(body.pageSize, 20);
    assert.equal(body.query, "rice");
    assert.equal(body.dataType.includes("Branded"), false);
    return Response.json({ foods: [sample(), sample(), { fdcId: 456 }] });
  });
  assert.equal((await provider.search(" rice ")).length, 1);
  assert.equal(calls, 1);
});
test("detail fetch checks the requested ID and does not accept browser nutrient values", async () => {
  const provider = createUsdaProvider("synthetic-key", async url => {
    assert.equal(url, "https://api.nal.usda.gov/fdc/v1/food/123?format=full");
    return Response.json(sample(true));
  });
  assert.equal((await provider.get(123)).calories, 200);
  const wrong = createUsdaProvider("synthetic-key", async () => Response.json({ ...sample(true), fdcId: 456 }));
  await assert.rejects(wrong.get(123), /incomplete/);
});
test("missing credentials fail without a request; HTTP, malformed, and network failures are safe", async () => {
  await assert.rejects(createUsdaProvider(undefined, async () => { throw new Error("must not call"); }).search("rice"), /USDA_API_KEY/);
  for (const [status, pattern] of [[429, /request limit/], [403, /authenticate/], [500, /unavailable/]]) {
    await assert.rejects(createUsdaProvider("synthetic-key", async () => new Response("secret raw error", { status })).search("rice"), pattern);
  }
  await assert.rejects(createUsdaProvider("synthetic-key", async () => Response.json({})).search("rice"), /unexpected/);
  await assert.rejects(createUsdaProvider("synthetic-key", async () => { throw new Error("secret-token"); }).search("rice"), error => !error.message.includes("secret-token"));
});
