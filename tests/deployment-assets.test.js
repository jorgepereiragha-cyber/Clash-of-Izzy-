import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ignore = await readFile(new URL("../.assetsignore", import.meta.url), "utf8");

test("Cloudflare public assets exclude local tooling, tests, and database artifacts", () => {
  for (const pattern of [".wrangler/", "tests/", "coverage/", "wrangler.preview-migrations.jsonc", "scripts/vendor-three.mjs", ".dev.vars*", ".env*", "*.sqlite", "*.sqlite-*", "*.db", "*.log", "*.map"]) {
    assert.ok(ignore.split("\n").some(line => line.trim() === pattern), "missing assets exclusion: " + pattern);
  }
});

test("Worker-only modules stay in the Worker bundle and out of public static assets", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const workerOnlyModules = [
    "hero-catalog.js",
    "skin-sets.js",
    "angel-death-event.js",
    "api-rate-limit.js",
    "battle-replay.js",
    "email-system.js",
    "kingdom-queue-rules.js",
    "mercadopago-orders.js",
    "pets.js",
    "player-accounts.js",
    "rally.js",
    "search-ranking.js",
    "realm-progression.js",
    "throne-war.js",
    "march-capacity.js",
    "march-slots.js",
    "valhalla-admin.js",
    "valhalla-config.js",
    "valhalla-rewards.js",
    "valhalla-shop.js",
  ];

  assert.ok(ignore.split("\n").includes("shared-world-coordinates.js"),"legacy map helper stays private");
  for (const path of workerOnlyModules) {
    assert.ok(worker.includes("./" + path), "Worker import missing: " + path);
    assert.ok(ignore.split("\n").some(line => line.trim() === path),
      "Worker-only module must not be a public asset: " + path);
  }
});

test("Durable Object source must not leak via public static hosting", () => {
  assert.ok(ignore.split("\n").some(line => line.trim() === "eldoria-room.js"));
});

test("staging load probe is excluded from public assets", () => {
  assert.ok(ignore.split("\n").some(line => line.trim() === "scripts/staging-load-smoke.mjs"));
});


test("every root JavaScript Worker import is excluded from public assets", async () => {
  // Workers bundles the modules itself: no backend JavaScript needs a static URL.
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const modules = [...worker.matchAll(/^(?:import|export)[^\n]+from\s+"\.\/([^"/]+\.js)";/gm)]
    .map(([, module]) => module);
  assert.ok(modules.length >= 25, "Worker root-import discovery unexpectedly empty");
  const excluded = new Set(ignore.split("\n").map(line => line.trim()));
  for (const module of modules) {
    assert.ok(excluded.has(module), "Worker module must never be a public asset: " + module);
  }
});

test("D1 audit and validation CLIs do not deploy as public scripts", () => {
  assert.ok(ignore.split("\n").includes("scripts/*.mjs"));
});
