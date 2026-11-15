import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../migrations/0012_equipment_progression.sql", import.meta.url), "utf8");
const compatibility = await readFile(new URL("../migrations/0015_equipment_acquired_at.sql", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");

test("progression migration can coexist with the legacy kingdom_equipment table", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS kingdom_equipment/);
  assert.doesNotMatch(migration, /acquired_at/);
  assert.match(compatibility, /ALTER TABLE kingdom_equipment ADD COLUMN acquired_at TEXT NOT NULL DEFAULT ''/);
  assert.match(compatibility, /UPDATE kingdom_equipment[\s\S]*WHERE acquired_at = ''/);
  assert.match(compatibility, /CREATE TRIGGER IF NOT EXISTS trg_kingdom_equipment_acquired_at/);
});

test("worker equipment reads are supported after the compatibility migration", () => {
  assert.match(worker, /SELECT item_key,level,acquired_at FROM kingdom_equipment/);
  assert.match(worker, /INSERT OR IGNORE INTO kingdom_equipment/);
});
