import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("kingdom world migration adds persistent map coordinates without replacing existing kingdom data", async () => {
  const migration = await read("migrations/0025_kingdom_world_queues_defense_audit.sql");
  for (const snippet of [
    "ALTER TABLE kingdoms ADD COLUMN map_x",
    "ALTER TABLE kingdoms ADD COLUMN map_z",
    "ALTER TABLE kingdoms ADD COLUMN map_region",
    "ALTER TABLE kingdoms ADD COLUMN food_capacity",
    "ALTER TABLE kingdoms ADD COLUMN wall_hp",
    "ALTER TABLE kingdoms ADD COLUMN wall_max_hp",
    "ALTER TABLE kingdoms ADD COLUMN defense_power",
    "ALTER TABLE kingdom_queues ADD COLUMN queue_slot",
    "CREATE TABLE IF NOT EXISTS action_logs",
    "territory_kind TEXT NOT NULL DEFAULT 'resource'"
  ]) assert.ok(migration.includes(snippet), "missing schema addition: " + snippet);
  assert.ok(migration.includes("idx_kingdom_queues_active_lane_slot"));
  assert.ok(migration.includes("INSERT OR IGNORE INTO world_territories"));
  assert.ok(!/DROP TABLE\s+(players|kingdoms|kingdom_buildings|army_units)/i.test(migration));
});

test("Worker maintains per-player castle map markers and caps passive production", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("kingdom_castle_"));
  assert.ok(worker.includes("territory_kind"));
  assert.ok(worker.includes("recalculateKingdomStats"));
  assert.ok(worker.includes("recalculateKingdomPower"));
  assert.ok(worker.includes("const capacities={food:"));
  assert.ok(worker.includes("Math.min(produced,Math.max(0,capacities[key]-current))"));
  assert.ok(worker.includes("map_region"));
  assert.ok(worker.includes("commander_name"));
});

test("construction and troop training each support two independent atomic queue slots", async () => {
  const worker = await read("worker.js");
  const migration = await read("migrations/0025_kingdom_world_queues_defense_audit.sql");
  assert.ok(migration.includes("queue_slot BETWEEN 1 AND 2"));
  assert.ok(worker.includes("occupiedBuildSlots"));
  assert.ok(worker.includes("occupiedTrainingSlots"));
  assert.ok(worker.includes("queue_slot=? AND status='running'"));
  assert.ok(worker.includes("SELECT id,queue_type,queue_slot,target_key"));
  assert.ok(worker.includes("async function processDueKingdomQueues"));
});

test("world map shows player castles but does not route unsupported PvP attacks", async () => {
  const page = await read("world-map.js");
  const scene = await read("world-map-3d.js");
  const worker = await read("worker.js");
  assert.ok(page.includes('territory.territory_kind === "castle"'));
  assert.ok(page.includes("territory.commander_name"));
  assert.ok(page.includes("territory.alliance_tag"));
  assert.ok(page.includes("if (isCastle)"));
  assert.ok(scene.includes('territory.territory_kind === "castle"'));
  assert.ok(scene.includes('ownership === "enemy" ? "enemy" : "home"'));
  assert.ok(worker.includes("O combate PvP será habilitado na Fase 10"));
});
