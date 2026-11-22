import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("the free-plan scheduler processes bounded batches instead of unbounded backlogs", async () => {
  const worker = await read("worker.js");
  const rally = await read("rally.js");
  const rewards = await read("valhalla-rewards.js");

  assert.ok(worker.includes("ORDER BY completes_at,id LIMIT 3"));
  assert.ok(worker.includes("async function processMarches(env,kingdomId,batchSize=50)"));
  assert.ok(worker.includes("ORDER BY kingdom_id LIMIT 1"));
  assert.ok(worker.includes("await processMarches(env,row.kingdom_id,2)"));
  assert.ok(worker.includes("ORDER BY ends_at LIMIT 1"));
  assert.ok(worker.includes("ROW_NUMBER() OVER (ORDER BY ep.score DESC,ep.damage DESC,ep.last_attack_at ASC,ep.kingdom_id ASC) AS final_rank"));
  assert.ok(worker.includes("ORDER BY ranked.final_rank LIMIT 10"));
  assert.ok(worker.includes("await processEmailQueue(env,1)"));
  assert.ok(worker.includes("ORDER BY expires_at LIMIT 100"));
  assert.ok(worker.includes("ORDER BY replay_expires_at,id LIMIT 25"));

  assert.ok(rally.includes("processDueRallies(env,batchSize=1)"));
  assert.ok(rally.includes("ORDER BY departure_time,id LIMIT ?)"));
  assert.ok(rally.includes("ORDER BY arrival_time,id LIMIT ?"));

  assert.ok(rewards.includes("const ACTIVE_KINGDOM_PAGE_SIZE = 10"));
  assert.ok(rewards.includes("const D1_BATCH_KINGDOM_SIZE = 10"));
  assert.ok(rewards.includes("const maxPagesPerScheduledRun = 1"));
});

test("active players still reconcile their own queues and marches when loading the kingdom state", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("await processMarches(env,kingdom.id)"));
  assert.ok(worker.includes("await processDueKingdomQueues(env,kingdom.id)"));
});


test("kingdom state groups its 14 independent D1 reads into one invocation batch", async () => {
  const worker = await read("worker.js");
  const start = worker.indexOf("async function gameState(env,playerId)");
  const end = worker.indexOf("\nasync function gameAction", start);
  assert.ok(start >= 0 && end > start, "gameState function boundaries must exist");
  const state = worker.slice(start, end);
  const batchStart = state.indexOf("const stateResults=await env.DB.batch([");
  const batchEnd = state.indexOf("]);", batchStart);
  assert.ok(batchStart >= 0 && batchEnd > batchStart, "game state reads must be grouped in one D1 batch");
  const batch = state.slice(batchStart, batchEnd);
  assert.equal(batch.split("env.DB.prepare(").length - 1, 15);
  assert.ok(state.includes("const fresh=stateResults[0]?.results?.[0]||null"));
  assert.ok(state.includes("const recentEvents=stateResults[12],queues=stateResults[13],castleSkins=stateResults[14]"));
  assert.ok(!batch.includes("await Promise.all(["));
  assert.ok(state.includes("const [pendingInvites,alliance]=await env.DB.batch(["));
  assert.ok(state.includes("const [members,chat,invites,wars]=await env.DB.batch(["));
});

test("derived kingdom capacity and power calculations batch their independent D1 reads", async () => {
  const worker = await read("worker.js");
  const statsStart = worker.indexOf("async function recalculateKingdomStats(env,kingdomId)");
  const powerStart = worker.indexOf("async function recalculateKingdomPower(env,kingdomId)", statsStart);
  const logStart = worker.indexOf("async function logKingdomAction(env", powerStart);
  assert.ok(statsStart >= 0 && powerStart > statsStart && logStart > powerStart);
  const stats = worker.slice(statsStart, powerStart);
  const power = worker.slice(powerStart, logStart);
  assert.ok(stats.includes("const reads=await env.DB.batch(["));
  assert.ok(stats.includes("SELECT food,wood,stone,iron,gold,wall_hp,castle_level FROM kingdoms"));
  assert.ok(stats.includes("let defense=50+(levels.wall||1)*40+(levels.watchtower||0)*50+(Number(kingdom.castle_level)||1)*10"));
  assert.ok(stats.includes("defense+=defensePowerFromRows(defenseRows.results||[])"));
  assert.ok(power.includes("const reads=await env.DB.batch(["));
  assert.ok(power.includes("const dragon=reads[4]?.results?.[0]||null"));
  assert.ok(power.includes("const kingdom=reads[5]?.results?.[0]||null"));
  assert.ok(!stats.includes("Promise.all("));
  assert.ok(!power.includes("Promise.all("));
});


test("shop, cosmetics, heroes and pets collapse independent state reads into D1 batches", async () => {
  const worker = await read("worker.js");
  const pets = await read("pets.js");
  const shopStart = worker.indexOf("async function getShopState(env,kingdomId)");
  const shopEnd = worker.indexOf("function rollHeroRarity()", shopStart);
  const cosmeticStart = worker.indexOf("async function getCosmeticState(env,kingdomId)");
  const cosmeticEnd = worker.indexOf("const SHOP_ITEMS", cosmeticStart);
  const heroStart = worker.indexOf("async function syncHeroSystems(env,kingdomId)");
  const heroEnd = worker.indexOf("async function gameState", heroStart);
  const petsStart = pets.indexOf("export async function getPetsState(env, kingdomId)");
  const petsEnd = pets.indexOf("async function unlockPet", petsStart);
  assert.ok(shopStart >= 0 && shopEnd > shopStart);
  assert.ok(cosmeticStart >= 0 && cosmeticEnd > cosmeticStart);
  assert.ok(heroStart >= 0 && heroEnd > heroStart);
  assert.ok(petsStart >= 0 && petsEnd > petsStart);
  const shop = worker.slice(shopStart, shopEnd);
  const cosmetics = worker.slice(cosmeticStart, cosmeticEnd);
  const heroes = worker.slice(heroStart, heroEnd);
  const petState = pets.slice(petsStart, petsEnd);
  assert.ok(shop.includes("const [rows,inventory]=await env.DB.batch(["));
  assert.ok(cosmetics.includes("const [owned,claims,wallet]=await env.DB.batch(["));
  assert.ok(cosmetics.includes("wallet?.results?.[0]?.shards||0"));
  assert.ok(heroes.includes("const [,inventory]=await env.DB.batch(["));
  assert.ok(heroes.includes("await env.DB.batch(statements)"));
  assert.ok(petState.includes("const reads = await env.DB.batch(["));
  assert.ok(petState.includes("petBonusesFromRow(reads[2]?.results?.[0] || null)"));
  assert.ok(!shop.includes("Promise.all("));
  assert.ok(!cosmetics.includes("Promise.all("));
  assert.ok(!petState.includes("Promise.all("));
});
