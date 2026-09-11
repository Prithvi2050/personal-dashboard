import assert from "node:assert/strict";
import test from "node:test";
import { FALLBACK_TIMEZONE, getDefaultTimezone, getMissingSupabaseEnv, requireSupabaseConfig } from "./config.ts";

test("reports required public Supabase variables", () => {
  assert.deepEqual(getMissingSupabaseEnv({}), ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
});

test("returns trimmed validated configuration", () => {
  assert.deepEqual(requireSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: " https://example.supabase.co ", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " key " }), { url: "https://example.supabase.co", publishableKey: "key" });
});

test("throws an actionable error when configuration is missing", () => {
  assert.throws(() => requireSupabaseConfig({}), /Add them to \.env\.local/);
});

test("uses configured and fallback timezones", () => {
  assert.equal(getDefaultTimezone({}), FALLBACK_TIMEZONE);
  assert.equal(getDefaultTimezone({ DEFAULT_TIMEZONE: "Europe/London" }), "Europe/London");
});
