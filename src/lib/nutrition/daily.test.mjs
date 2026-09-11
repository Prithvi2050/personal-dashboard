import assert from "node:assert/strict";
import test from "node:test";
import { localDate, recentDays, selectedDay, totalMacros, goalProgress, groupMeals } from "./daily.ts";
test("today follows the user's timezone on either side of midnight", () => {
  const now = new Date("2026-09-11T20:00:00Z");
  assert.equal(localDate(now, "Asia/Kolkata"), "2026-09-12");
  assert.equal(localDate(now, "America/Los_Angeles"), "2026-09-11");
});
test("seven calendar days cross year, leap day and DST boundaries", () => {
  assert.deepEqual(recentDays("2026-01-02"), ["2026-01-02","2026-01-01","2025-12-31","2025-12-30","2025-12-29","2025-12-28","2025-12-27"]);
  assert.equal(recentDays("2024-03-01")[1], "2024-02-29");
  assert.equal(new Set(recentDays("2026-03-10")).size, 7);
});
test("unsupported, repeated, future and malformed date parameters fall back to today", () => {
  const days = recentDays("2026-09-11");
  for (const value of [undefined, ["2026-09-10"], "2026-09-12", "2026-02-31", "../", "2020-01-01"]) assert.equal(selectedDay(value, days), days[0]);
  assert.equal(selectedDay("2026-09-10", days), "2026-09-10");
});
test("meal and day totals derive from items and empty days total zero", () => {
  assert.deepEqual(totalMacros([]), {calories:0,protein:0,carbs:0,fat:0});
  assert.deepEqual(totalMacros([{calories:105,protein:1.3,carbs:27,fat:0.4},{calories:310,protein:18,carbs:42,fat:8}]), {calories:415,protein:19.3,carbs:69,fat:8.4});
});
test("missing or zero goals avoid division by zero; exceeded goals keep exact difference", () => {
  assert.equal(goalProgress(100, null), null);
  assert.equal(goalProgress(100, 0), null);
  assert.deepEqual(goalProgress(250, 200), {percent:100,difference:-50});
  assert.deepEqual(goalProgress(0, 200), {percent:0,difference:200});
  assert.deepEqual(goalProgress(200, 200), {percent:100,difference:0});
});
test("all five meal groups are supported and meals sort within each group without mutation", () => {
  const meals = [{id:"b",type:"Snack",time:"16:00",items:[]},{id:"a",type:"Snack",time:"10:00",items:[]},{id:"c",type:"Other",time:"21:00",items:[]}];
  const groups=groupMeals(meals);
  assert.equal(groups.length,5);
  assert.deepEqual(groups.find(g=>g.type==="Snack").meals.map(m=>m.id),["a","b"]);
  assert.equal(groups.find(g=>g.type==="Other").meals.length,1);
  assert.equal(meals[0].id,"b");
});
