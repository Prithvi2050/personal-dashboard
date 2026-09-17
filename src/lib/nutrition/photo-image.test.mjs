import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { preparePhoto } from "./photo-image.ts";
test("meal images are decoded, resized and stripped of metadata", async () => {
  const input = await sharp({ create: { width: 1800, height: 1000, channels: 3, background: "white" } }).withMetadata().jpeg().toBuffer();
  const output = await preparePhoto(input, "image/jpeg");
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, "jpeg"); assert.equal(meta.width, 1600); assert.equal(meta.exif, undefined);
});
test("rejects corrupt, oversized, mismatched and unsupported images", async () => {
  await assert.rejects(preparePhoto(new Uint8Array([255,216,255]), "image/jpeg"));
  await assert.rejects(preparePhoto(new Uint8Array(3*1024*1024+1), "image/jpeg"));
  await assert.rejects(preparePhoto(new TextEncoder().encode("<svg/>"), "image/svg+xml"));
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(preparePhoto(png, "image/jpeg"));
});
