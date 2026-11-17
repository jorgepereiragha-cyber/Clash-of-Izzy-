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
  const end = worker.indexOf("\\nasync function gameAction", start);
  assert.ok(start >= 0 && end > start, "gameState function boundaries must exist");
  const state = worker.slice(start, end);
  const batchStart = state.indexOf("const stateResults=await env.DB.batch([");
  const batchEnd = state.indexOf("]);", batchStart);
  assert.ok(batchStart >= 0 && batchEnd > batchStart, "game state reads must be grouped in one D1 batch");
  const batch = state.slice(batchStart, batchEnd);
  assert.equal((batch.match(/env\\.DB\\.prepare\\(/g) || []).length, 14);
  assert.match(state, /const fresh=stateResults\\[0\\]\\?\\.results\\?\\.\\[0\\]\\|\\|null/);
  assert.match(state, /const recentEvents=stateResults\\[12\\],queues=stateResults\\[13\\]/);
  assert.doesNotMatch(state, /fresh,buildings,troops,heroes,dragon,research,territories,marches,reports,heroInventory,heroHistory,inventoryItems,recentEvents,queues\\]=await Promise\\.all/);
});


test("derived kingdom capacity and power calculations batch their independent D1 reads", async () => {
  const worker = await read("worker.js");
  const statsStart = worker.indexOf("async function recalculateKingdomStats(env,kingdomId)");
  const powerStart = worker.indexOf("async function recalculateKingdomPower(env,kingdomId)", statsStart);
  const logStart = worker.indexOf("async function logKingdomAction(env", powerStart);
  assert.ok(statsStart >= 0 && powerStart > statsStart && logStart > powerStart);
  const stats = worker.slice(statsStart, powerStart);
  const power = worker.slice(powerStart, logStart);
  assert.match(stats, /const reads=await env\\.DB\\.batch\\(\\[/);
  assert.match(stats, /SELECT food,wood,stone,iron,gold,wall_hp,castle_level FROM kingdoms/);
  assert.match(stats, /const defense=.*kingdom\\.castle_level/);
  assert.match(power, /const reads=await env\\.DB\\.batch\\(\\[/);
  assert.match(power, /const dragon=reads\\[4\\]\\?\\.results\\?\\.\\[0\\]/);
  assert.match(power, /const kingdom=reads\\[5\\]\\?\\.results\\?\\.\\[0\\]/);
  assert.doesNotMatch(stats+power, /Promise\\.all\\(/);
});
