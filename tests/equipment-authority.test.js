import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("equipamentos usam estado persistente e validação no servidor", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const ui = await readFile(new URL("../equipment-system.js", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/0008_kingdom_equipment.sql", import.meta.url), "utf8");
  assert.match(worker, /CREATE TABLE IF NOT EXISTS kingdom_equipment/);
  assert.match(worker, /type==="equipment_upgrade"/);
  assert.match(worker, /gold=gold-\?/);
  assert.match(worker, /level=level\+1/);
  assert.match(worker, /type==="equipment_lock"/);
  assert.match(worker, /equipment,cosmetics,player/);
  assert.match(migration, /PRIMARY KEY \(kingdom_id, item_key\)/);
  assert.match(ui, /type:"equipment_upgrade"/);
  assert.match(ui, /type:"equipment_lock"/);
  assert.doesNotMatch(ui, /playerState\.gold\s*[-+]=/);
  assert.doesNotMatch(ui, /item\.level\s*\+=/);
});
