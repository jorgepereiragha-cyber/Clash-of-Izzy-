import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

test("README production snapshot distinguishes live health from failed post-deploy smoke", () => {
  assert.match(readme, /Status verificado em 23\/11\/2026/);
  assert.match(readme, /api\/health.*HTTP 200/);
  assert.match(readme, /45121845533/);
  assert.match(readme, /fetch failed/);
  assert.match(readme, /prova final dos hashes foi ignorada/);
  // Equivalent negative wording must remain acceptable; the invariant is that
  // the independent GET does not certify global availability.
  assert.match(readme, /(?:não|nem) comprova disponibilidade global/);
});

test("README does not present an internal Android candidate as an official release", () => {
  assert.match(readme, /APK oficial assinado ainda não está publicado/);
  assert.match(readme, /APK interno de teste não equivale/);
});
