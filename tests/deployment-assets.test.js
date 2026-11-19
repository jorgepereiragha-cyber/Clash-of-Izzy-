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
    "shared-world-coordinates.js",
    "valhalla-admin.js",
    "valhalla-config.js",
    "valhalla-rewards.js",
    "valhalla-shop.js",
  ];

  for (const path of workerOnlyModules) {
    assert.ok(worker.includes("./" + path), "Worker import missing: " + path);
    assert.ok(ignore.split("\\n").some(line => line.trim() === path),
      "Worker-only module must not be a public asset: " + path);
  }
});
