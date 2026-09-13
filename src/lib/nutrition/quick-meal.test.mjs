import assert from "node:assert/strict";
import test from "node:test";
import { calculatePortion, parseMealInput } from "./quick-meal.ts";
const foodId = "11111111-1111-4111-8111-111111111111";
const utensilId = "22222222-2222-4222-8222-222222222222";
const food = { id: foodId, serving_basis: "g", serving_quantity: 100, calories: 200, protein: 10, carbs: 30, fat: 4 };
const calibration = [{ food_id: foodId, utensil_id: utensilId, full_serving_grams: 180 }];
const exact = { food_id: foodId, utensil_id: null, fraction: null, quantity: 50 };
const form = (items = [exact]) => {
  const value = new FormData(); value.set("request_id", foodId); value.set("meal_type", "Lunch"); value.set("items", JSON.stringify(items)); return value;
};
test("calibrated fractions use food mass, not utensil capacity", () => {
  for (const fraction of [0.25, 0.5, 0.75, 1]) {
    const result = calculatePortion(food, { ...exact, utensil_id: utensilId, fraction, quantity: null }, calibration);
    assert.equal(result.quantity, 180 * fraction);
    assert.equal(result.calories, 360 * fraction);
  }
});
test("exact grams, ml and pieces scale only within their declared serving unit", () => {
  assert.equal(calculatePortion(food, exact, []).calories, 100);
  assert.equal(calculatePortion({ ...food, serving_basis: "ml", serving_quantity: 250 }, { ...exact, quantity: 125 }, []).calories, 100);
  assert.equal(calculatePortion({ ...food, serving_basis: "piece", serving_quantity: 2 }, { ...exact, quantity: 1 }, []).calories, 100);
});
test("missing/wrong calibrations and millilitre-to-gram assumptions are rejected", () => {
  const item = { ...exact, utensil_id: utensilId, fraction: 0.5, quantity: null };
  assert.throws(() => calculatePortion(food, item, []));
  assert.throws(() => calculatePortion({ ...food, serving_basis: "ml" }, item, calibration));
  assert.throws(() => calculatePortion(food, { ...item, fraction: 0.3 }, calibration));
});
test("input validation bounds meals and discards browser totals/owner", () => {
  const result = parseMealInput(form([{ ...exact, user_id: "attacker", calories: 999 }]));
  assert.deepEqual(result.items, [exact]);
  for (const items of [[], Array(21).fill(exact), [{ ...exact, quantity: 0 }], [{ ...exact, quantity: -1 }], [{ ...exact, quantity: 1.001 }], [{ ...exact, quantity: "20" }], [{ ...exact, utensil_id: "bad" }], [{ ...exact, food_id: "bad" }], [{ ...exact, fraction: 1 }]]) assert.throws(() => parseMealInput(form(items)));
  const invalid = form(); invalid.set("items", "not json"); assert.throws(() => parseMealInput(invalid));
  invalid.set("meal_type", "Unknown"); assert.throws(() => parseMealInput(invalid));
});
test("calculation rejects invalid quantities and rounds each item to journal precision", () => {
  for (const quantity of [0, -1, NaN, Infinity, 10001]) assert.throws(() => calculatePortion(food, { ...exact, quantity }, []));
  assert.equal(calculatePortion(food, { ...exact, quantity: 33.33 }, []).calories, 66.7);
});
