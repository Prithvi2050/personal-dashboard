import assert from "node:assert/strict";
import test from "node:test";
import { validateSettings } from "./validation.ts";
const valid = { daily_calorie_goal: "2000", daily_protein_goal: "100", daily_carbs_goal: "", daily_fat_goal: "", monthly_spending_budget: "50000", timezone: "Asia/Kolkata" };

test("parses decimal budgets, trims input, and preserves optional goals as null", () => {
  const result = validateSettings({ ...valid, monthly_spending_budget: " 1234.50 " });
  assert.equal(result.success, true);
  assert.equal(result.data.monthly_spending_budget, 1234.5);
  assert.equal(result.data.daily_carbs_goal, null);
  assert.equal(result.data.daily_fat_goal, null);
});
test("zero budget and optional zero macro goals are valid", () => {
  const result = validateSettings({ ...valid, monthly_spending_budget: "0", daily_carbs_goal: "0", daily_fat_goal: "0" });
  assert.equal(result.success, true);
  assert.equal(result.data.daily_carbs_goal, 0);
});
test("required goals cannot be blank or zero", () => {
  for (const field of ["daily_calorie_goal", "daily_protein_goal"]) {
    for (const value of ["", " ", "0"]) assert.equal(validateSettings({ ...valid, [field]: value }).success, false);
  }
  assert.equal(validateSettings({ ...valid, monthly_spending_budget: "" }).success, false);
});
test("rejects non-finite, negative, excessive, and non-decimal numeric input", () => {
  for (const value of ["NaN", "Infinity", "-1", "1e3", "0x10", "12.345", "1000000001", "1,000", {}, null]) {
    const result = validateSettings({ ...valid, monthly_spending_budget: value });
    assert.equal(result.success, false, String(value));
    assert.ok(result.errors.monthly_spending_budget);
  }
});
test("rejects invalid and offset timezones; accepts UTC and DST-aware zones", () => {
  for (const timezone of ["", "Mars/Base", "+05:30", null, {}]) assert.equal(validateSettings({ ...valid, timezone }).success, false);
  for (const timezone of ["UTC", "Europe/London", "America/New_York"]) assert.equal(validateSettings({ ...valid, timezone }).success, true);
});
test("does not accept caller-controlled identity or completion metadata", () => {
  const result = validateSettings({ ...valid, user_id: "someone-else", onboarding_completed_at: "fake" });
  assert.equal(result.success, true);
  assert.equal("user_id" in result.data, false);
  assert.equal("onboarding_completed_at" in result.data, false);
});
test("clearing optional goals is distinct from saving zero", () => {
  const blank = validateSettings({ ...valid, daily_carbs_goal: "  " });
  const zero = validateSettings({ ...valid, daily_carbs_goal: "0" });
  assert.equal(blank.data.daily_carbs_goal, null);
  assert.equal(zero.data.daily_carbs_goal, 0);
});
