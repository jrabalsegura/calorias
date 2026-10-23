import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePhoto, scaledSize } from "./photo";

test("the photo must be a base64 image of an accepted type and size", () => {
  const data = "A".repeat(200);
  assert.ok(parsePhoto({ data, mediaType: "image/jpeg" }).ok);
  assert.equal(parsePhoto({ data, mediaType: "image/gif" }).ok, false);
  assert.equal(parsePhoto({ data: "no es base64!", mediaType: "image/png" }).ok, false);
  assert.equal(parsePhoto({ data: "A".repeat(5_000_004), mediaType: "image/png" }).ok, false);
});

test("photos are reduced to 1.500 px on the longest side, never enlarged", () => {
  assert.deepEqual(scaledSize(4032, 3024), { width: 1500, height: 1125 });
  assert.deepEqual(scaledSize(3024, 4032), { width: 1125, height: 1500 });
  assert.deepEqual(scaledSize(800, 600), { width: 800, height: 600 });
});
