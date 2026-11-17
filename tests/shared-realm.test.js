import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getSharedWorldCoordinates } from "../shared-world-coordinates.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("all player castles stay in one shared realm, including beyond the first 400", () => {
  const expected = new Map([
    [1, { mapX: -50, mapZ: -50 }],
    [20, { mapX: 45, mapZ: -50 }],
    [21, { mapX: -50, mapZ: -45 }],
    [400, { mapX: 45, mapZ: 45 }],
    [401, { mapX: -50, mapZ: 50 }],
    [800, { mapX: 45, mapZ: 145 }],
  ]);

  for (const [id, position] of expected) {
    const actual = getSharedWorldCoordinates(id);
    assert.deepEqual(actual, { ...position, mapRegion: 1 });
  }

  const unique = new Set();
  for (let id = 1; id <= 10000; id++) {
    const position = getSharedWorldCoordinates(id);
    assert.equal(position.mapRegion, 1);
    const key = position.mapX + "," + position.mapZ;
    assert.ok(!unique.has(key), "duplicate shared-world coordinate for kingdom " + id);
    unique.add(key);
  }
});

test("shared-world coordinates reject invalid kingdom IDs", () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, "not-an-id"]) {
    assert.throws(() => getSharedWorldCoordinates(value), RangeError);
  }
});

test("migration consolidates existing castles without deleting player or progression data", async () => {
  const migration = await read("migrations/0026_single_shared_realm.sql");
  assert.match(migration, /DROP INDEX IF EXISTS idx_kingdoms_map_position/);
  assert.match(migration, /UPDATE kingdoms[\\s\\S]*?map_region = 1/);
  assert.match(migration, /UPDATE world_territories[\\s\\S]*?owner_kingdom_id/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdoms_map_position/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM (players|kingdoms|world_territories)/i);
});

test("new castles use the shared coordinate policy and map lookup no longer partitions by region", async () => {
  const worker = await read("worker.js");
  assert.match(worker, /getSharedWorldCoordinates\\(id\\)/);
  assert.doesNotMatch(worker, /mapRegion=Math\\.floor\\(mapSlot\\/400\\)\\+1/);
  assert.doesNotMatch(worker, /owner\\.map_region=/);
  assert.match(worker, /wt\\.x BETWEEN \\? AND \\? AND wt\\.z BETWEEN \\? AND \\?/);
});
