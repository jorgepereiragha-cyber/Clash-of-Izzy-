import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Worker processa marchas vencidas sem depender do login do jogador", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(worker.includes("async function processDueMarches(env)"));
  assert.ok(worker.includes("SELECT DISTINCT kingdom_id FROM marches WHERE status='marching' AND arrives_at<=? ORDER BY kingdom_id LIMIT 100"));
  const schedulerStart = worker.indexOf("async scheduled(controller,env){");
  const schedulerEnd = worker.indexOf("async fetch(request,env)", schedulerStart);
  const scheduler = worker.slice(schedulerStart, schedulerEnd);
  assert.ok(scheduler.includes("await processDueKingdomQueues(env)"));
  assert.ok(scheduler.includes("await processDueMarches(env)"));
  assert.ok(scheduler.indexOf("await processDueKingdomQueues(env)") < scheduler.indexOf("await processDueMarches(env)"));
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
  assert.ok(worker.includes("AS selected WHERE selected.key=army_units.unit_type"));
});

test("PvP territorial valida o dono na chegada, trava os dois reinos e grava relatório bilateral", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const processMarches = worker.slice(worker.indexOf("async function processMarches"), worker.indexOf("const CASTLE_MATERIALS"));
  assert.ok(worker.includes("async function loadKingdomCombatProfile(env, kingdomId)"));
  assert.ok(worker.includes("async function acquireKingdomBattleLocks(env, kingdomIds)"));
  assert.ok(worker.includes("if (current.battle_token)"));
  assert.ok(processMarches.includes("target_owner_kingdom_id"));
  assert.ok(processMarches.includes("territory_owner_changed_or_invalid"));
  assert.ok(processMarches.includes("pvpDefenderRows"));
  assert.ok(processMarches.includes("defenderLosses"));
  assert.ok(processMarches.includes("defender_kingdom_id"));
  assert.ok(processMarches.includes("territory_lost"));
  assert.ok(processMarches.includes("territory_defended"));
  assert.ok(processMarches.includes("combat_lock_token"));
  assert.ok(processMarches.includes("releaseKingdomBattleLocks"));
  assert.ok(worker.includes("OR defender_kingdom_id=?"));
});

test("Worker não aceita PvP contra protegido ou membro da mesma aliança", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const marchStart = worker.indexOf('}else if(type==="march"){');
  const marchEnd = worker.indexOf('}else if(type==="battle"){', marchStart);
  const march = worker.slice(marchStart, marchEnd);
  assert.ok(march.includes("territory.shield_until"));
  assert.ok(march.includes("k.protection_until"));
  assert.ok(march.includes("alliance_members"));
  assert.ok(march.includes("Ataques contra membros da sua própria aliança estão bloqueados"));
  assert.ok(march.includes("target_owner_kingdom_id"));
  assert.ok(march.includes("COALESCE(battle_token,'')=''"));
});
