import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Worker processa marchas vencidas sem depender do login do jogador", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(worker.includes("async function processDueMarches(env)"));
  assert.ok(worker.includes("SELECT DISTINCT kingdom_id FROM marches WHERE status='marching' AND arrives_at<=? ORDER BY kingdom_id LIMIT 100"));
  assert.match(worker, /async scheduled\(controller,env\)\s*\{\s*await processDueMarches\(env\);/);
  assert.ok(worker.includes('console.error("scheduled_march_resolution_failed"'));
});

test("Cloudflare agenda a resolução automática de marchas a cada minuto", async () => {
  const raw = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(raw);
  assert.deepEqual(config.triggers?.crons, ["* * * * *"]);
});
