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
