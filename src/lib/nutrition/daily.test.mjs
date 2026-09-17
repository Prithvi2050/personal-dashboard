import assert from "node:assert/strict";
import test from "node:test";
import { localDate, recentDays, selectedDay, totalMacros, goalProgress, groupMeals, summarizeHistory } from "./daily.ts";

test("weekly totals sum saved items; averages exclude unlogged days", () => {
  const item = {name:"Synthetic food",portion:"50 g",calories:125,protein:5,carbs:20,fat:2.5};
  const days = recentDays("2026-09-16");
  const history = days.map((day,index) => ({day,meals:index < 2 ? [{id:day,type:"Lunch",time:"12:00",items:[item,item]}] : []}));
  const before = JSON.stringify(history);
  const result = summarizeHistory(history);
  assert.equal(result.loggedDays,2);
  assert.equal(result.days.length,7);
  assert.deepEqual(result.totals,{calories:500,protein:20,carbs:80,fat:10});
  assert.deepEqual(result.average,{calories:250,protein:10,carbs:40,fat:5});
  assert.equal(result.days[2].mealCount,0);
  assert.equal(JSON.stringify(history),before);
});
test("empty history has no average; logged zero is distinct from an unlogged day", () => {
  assert.equal(summarizeHistory([]).average,null);
  assert.equal(summarizeHistory([{day:"2026-09-16",meals:[]}]).average,null);
  const result = summarizeHistory([{day:"2026-09-16",meals:[{id:"zero",type:"Other",time:"12:00",items:[{name:"Water",portion:"1",calories:0,protein:0,carbs:0,fat:0}]}]}]);
  assert.equal(result.loggedDays,1);
  assert.equal(result.average.calories,0);
});
test("weekly decimal sums round once across items", () => {
  const result = summarizeHistory([1,2,3].map(n => ({day:`2026-09-${n+10}`,meals:[{id:String(n),type:"Other",time:"12:00",items:[{calories:0.14,protein:0.14,carbs:0.14,fat:0.14}]}]})));
  assert.equal(result.totals.calories,0.4);
  assert.equal(result.average.calories,0.1);
});
test("DST repeated hours and extreme offsets keep the correct local calendar date", () => {
  assert.equal(localDate(new Date("2026-11-01T05:30:00Z"),"America/New_York"),"2026-11-01");
  assert.equal(localDate(new Date("2026-11-01T06:30:00Z"),"America/New_York"),"2026-11-01");
  assert.equal(localDate(new Date("2026-09-16T11:00:00Z"),"Pacific/Kiritimati"),"2026-09-17");
});
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
