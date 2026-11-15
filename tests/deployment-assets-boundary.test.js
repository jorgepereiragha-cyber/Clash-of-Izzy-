import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ignore = (await readFile(new URL("../.assetsignore", import.meta.url), "utf8"))
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

test("Cloudflare public assets exclude local tooling, tests and database artifacts", () => {
  for (const pattern of [".wrangler/", "tests/", "coverage/", ".dev.vars*", ".env*", "*.sqlite", "*.sqlite-*", "*.db", "*.log", "*.map"]) {
    assert.ok(ignore.includes(pattern), "missing assets exclusion: " + pattern);
  }
});

test("server-only modules are not exposed while client modules remain available", () => {
  for (const pattern of ["worker.js", "game-adapter.js", "api-rate-limit.js", "liveops-engine.js", "task-engine.js", "story-engine.js", "realm-policy.js"]) {
    assert.ok(ignore.includes(pattern), "missing server exclusion: " + pattern);
  }
  for (const path of ["equipment-engine.js", "equipment-lab.js", "scripts/kingdom-3d.js", "scripts/kingdom-quality.js", "engine/asset-loader.js", "engine/texture-manager.js"]) {
    assert.ok(!ignore.some(pattern => path === pattern || path.startsWith(pattern.replace(/\*\*$/, ""))), "client module must remain public: " + path);
  }
});
