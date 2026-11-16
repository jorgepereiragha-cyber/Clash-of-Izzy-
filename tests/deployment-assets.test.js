import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ignore = await readFile(new URL("../.assetsignore", import.meta.url), "utf8");
const patterns = new Set(ignore.split("\n").map(line => line.trim()));

test("Cloudflare public assets exclude local tooling, tests, and database artifacts", () => {
  for (const pattern of [".wrangler/", "tests/", "coverage/", ".dev.vars*", ".env*", "*.sqlite", "*.sqlite-*", "*.db", "*.log", "*.map"]) {
    assert.ok(patterns.has(pattern), "missing assets exclusion: " + pattern);
  }
});

test("Cloudflare public assets exclude Node-only production and asset validation scripts", () => {
  for (const pattern of ["scripts/production-smoke.js", "scripts/validate-3d-assets.js"]) {
    assert.ok(patterns.has(pattern), "missing assets exclusion: " + pattern);
  }
});
