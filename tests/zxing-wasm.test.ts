import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// The scanner loads ZXing's WebAssembly from public/zxing instead of a CDN;
// this fails when the barcode-detector update brings another version.
test("the served ZXing WebAssembly matches the installed zxing-wasm", () => {
  const root = process.cwd();
  const { version } = JSON.parse(
    readFileSync(join(root, "node_modules/zxing-wasm/package.json"), "utf8")
  );
  const sha256 = (path: string) =>
    createHash("sha256").update(readFileSync(join(root, path))).digest("hex");

  assert.equal(
    sha256(`public/zxing/zxing_reader-${version}.wasm`),
    sha256("node_modules/zxing-wasm/dist/reader/zxing_reader.wasm")
  );
});
