import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateQueueDurationSeconds } from "../kingdom-queue-rules.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("construction and research timers grow with level and adapt to facility quality", () => {
  const firstBuild = calculateQueueDurationSeconds("construction", { level: 1, facilityLevel: 1 });
  const nextBuild = calculateQueueDurationSeconds("construction", { level: 2, facilityLevel: 1 });
  const improvedBuild = calculateQueueDurationSeconds("construction", { level: 2, facilityLevel: 10 });
  assert.equal(firstBuild, 60);
  assert.ok(nextBuild > firstBuild);
  assert.ok(improvedBuild < nextBuild);

  const firstResearch = calculateQueueDurationSeconds("research", { level: 1, facilityLevel: 1 });
  const laterResearch = calculateQueueDurationSeconds("research", { level: 3, facilityLevel: 1 });
  const fasterResearch = calculateQueueDurationSeconds("research", { level: 3, facilityLevel: 10 });
  assert.equal(firstResearch, 180);
  assert.ok(laterResearch > firstResearch);
  assert.ok(fasterResearch < laterResearch);
});

test("training duration scales with troop quantity, unit complexity and barracks level", () => {
  const militia = calculateQueueDurationSeconds("training", { targetKey: "militia", quantity: 10, facilityLevel: 1 });
  const knights = calculateQueueDurationSeconds("training", { targetKey: "knight", quantity: 10, facilityLevel: 1 });
  const upgradedBarracks = calculateQueueDurationSeconds("training", { targetKey: "militia", quantity: 10, facilityLevel: 10 });
  assert.equal(militia, 20);
  assert.ok(knights > militia);
  assert.ok(upgradedBarracks < militia);
  assert.ok(calculateQueueDurationSeconds("training", { targetKey: "mage", quantity: 100 }) > militia);
});

test("queue durations are bounded and reject unsupported unit/queue types", () => {
  assert.equal(calculateQueueDurationSeconds("construction", { level: 0 }), 60);
  assert.ok(calculateQueueDurationSeconds("training", { targetKey: "militia", quantity: 1000 }) <= 200);
  assert.throws(() => calculateQueueDurationSeconds("training", { targetKey: "unknown" }), /tropa/);
  assert.throws(() => calculateQueueDurationSeconds("unknown"), /fila/);
});

test("migration aligns the troop schema and creates independent persistent queues", async () => {
  const migration = await read("migrations/0016_strategy_queues_and_mage.sql");
  assert.match(migration, /'crossbowman','mage','catapult'/);
  assert.match(migration, /CREATE TABLE kingdom_queues/);
  assert.match(migration, /idx_kingdom_queues_one_active_lane/);
  assert.match(migration, /WHERE status='running'/);
});

test("Worker charges resources when starting and grants results only at queue completion", async () => {
  const worker = await read("worker.js");
  assert.match(worker, /async function processDueKingdomQueues/);
  assert.match(worker, /status='running' AND completes_at<=\?/);
  assert.match(worker, /troop_training_started/);
  assert.match(worker, /construction_started/);
  assert.match(worker, /research_started/);
  assert.match(worker, /await processDueKingdomQueues\(env,kingdom\.id\)/);
  assert.match(worker, /await processDueKingdomQueues\(env\)/);
  assert.match(worker, /queues:queues\.results\|\|\[\]/);
});
