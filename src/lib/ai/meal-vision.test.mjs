import assert from "node:assert/strict";
import test from "node:test";
import { openAiVision, parseAnalysis } from "./meal-vision.ts";
import { confidenceLabel } from "../nutrition/photo-model.ts";
const context = { foods: [{ id: "food", name: "Synthetic food", serving_basis: "g" }], utensils: [{ id: "bowl", name: "Synthetic bowl", capacity_ml: 250, diameter_cm: 10, height_cm: 5, image: "data:image/jpeg;base64,reference" }] };
const detection = { name: "Synthetic food", food_id: "food", utensil_id: "bowl", fraction: 0.5, quantity: 90, confidence: 0.8, note: "Example uncertainty" };
const analysis = { items: [detection], warning: "Synthetic fixture" };
test("validates bounded structured results and neutralizes unknown references", () => {
  assert.deepEqual(parseAnalysis(analysis, context), analysis);
  const invalid = parseAnalysis({ ...analysis, items: [{ ...detection, food_id: "other-user", utensil_id: "other-bowl" }] }, context).items[0];
  assert.equal(invalid.food_id, null); assert.equal(invalid.utensil_id, null); assert.equal(invalid.fraction, null); assert.ok(invalid.confidence < 0.6);
  for (const patch of [{ confidence: 1.1 }, { confidence: NaN }, { fraction: 0.7 }, { quantity: -1 }, { name: "" }, { note: "x".repeat(301) }]) assert.throws(() => parseAnalysis({ ...analysis, items: [{ ...detection, ...patch }] }, context));
  assert.throws(() => parseAnalysis({ ...analysis, items: Array(21).fill(detection) }, context));
  assert.deepEqual(parseAnalysis({ items: [], warning: "No food" }, context).items, []);
});
test("confidence thresholds prompt explicit verification at boundaries", () => {
  assert.match(confidenceLabel(0.59), /choose/); assert.match(confidenceLabel(0.6), /verify/);
  assert.match(confidenceLabel(0.85), /verify/); assert.match(confidenceLabel(0.86), /Suggested/);
});
test("provider sends selected images and structured schema without retaining responses", async () => {
  let calls = 0;
  const provider = openAiVision("synthetic-key", "test-model", async (url, options) => {
    calls++; assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.headers.Authorization, "Bearer synthetic-key");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false); assert.equal(body.model, "test-model"); assert.equal(body.text.format.strict, true);
    assert.equal(body.input[0].content.filter(c => c.type === "input_image").length, 2);
    assert.match(body.instructions, /untrusted/); assert.match(body.instructions, /Do not calculate calories/);
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(analysis) }] }] });
  });
  assert.deepEqual(await provider.analyze("data:image/jpeg;base64,meal", context), analysis); assert.equal(calls, 1);
});
test("refusal, incomplete response, HTTP failures and timeouts never fabricate foods", async () => {
  for (const payload of [{ status: "incomplete" }, { status: "completed", output: [{ content: [{ type: "refusal", refusal: "no" }] }] }, { status: "completed", output: [{ content: [{ type: "output_text", text: "invalid JSON" }] }] }]) await assert.rejects(openAiVision("key", "model", async () => Response.json(payload)).analyze("image", context));
  await assert.rejects(openAiVision("key", "model", async () => new Response("private error", { status: 429 })).analyze("image", context), /quota/);
  await assert.rejects(openAiVision("key", "model", async () => { throw new Error("secret exception"); }).analyze("image", context), error => !error.message.includes("secret exception"));
});
