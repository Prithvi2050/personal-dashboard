import assert from "node:assert/strict";
import test from "node:test";
import { isPublicAuthPath, safeNextPath } from "./paths.ts";

test("recognizes only public authentication routes", () => {
  assert.equal(isPublicAuthPath("/sign-in"), true);
  assert.equal(isPublicAuthPath("/auth/callback"), true);
  assert.equal(isPublicAuthPath("/nutrition"), false);
});

test("accepts local return paths and rejects external redirects", () => {
  assert.equal(safeNextPath("/nutrition?day=today"), "/nutrition?day=today");
  assert.equal(safeNextPath("//attacker.example"), "/");
  assert.equal(safeNextPath("/\\attacker.example"), "/");
  assert.equal(safeNextPath("https://attacker.example"), "/");
  assert.equal(safeNextPath(undefined), "/");
});
