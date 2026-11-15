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


test("normal world PvE marches return all troops; permanent losses are reserved for the weekend boss event", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const processMarches = worker.slice(worker.indexOf("async function processMarches"), worker.indexOf("const CASTLE_MATERIALS"));
  assert.ok(processMarches.includes("survivors[u.unit_type]=u.quantity"));
  assert.ok(!processMarches.includes("u.quantity-Math.max(0,Number(losses[u.unit_type]||0))"));
  const battleStart = worker.indexOf('}else if(type==="battle"){');
  const battleEnd = worker.indexOf('}else if(type==="rename"){', battleStart);
  const battle = worker.slice(battleStart, battleEnd);
  assert.ok(battle.includes("SET quantity=quantity"));
  assert.ok(!battle.includes("SET quantity=quantity-CAST"));
  assert.ok(worker.includes("async function angelDeathEventAttack"));
  assert.ok(worker.includes("SET quantity=quantity-CAST"));
});
