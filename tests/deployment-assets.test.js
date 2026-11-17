import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ignore = await readFile(new URL("../.assetsignore", import.meta.url), "utf8");

test("Cloudflare public assets exclude local tooling, tests, and database artifacts", () => {
  for (const pattern of [".wrangler/", "tests/", "coverage/", "wrangler.preview-migrations.jsonc", "scripts/vendor-three.mjs", ".dev.vars*", ".env*", "*.sqlite", "*.sqlite-*", "*.db", "*.log", "*.map"]) {
    assert.ok(ignore.split("\n").some(line => line.trim() === pattern), "missing assets exclusion: " + pattern);
  }
});
