import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("equipamentos usam estado persistente e validação no servidor", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const ui = await readFile(new URL("../equipment-system.js", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/0008_kingdom_equipment.sql", import.meta.url), "utf8");
  const runtimeMigration = await readFile(new URL("../migrations/0009_runtime_tables.sql", import.meta.url), "utf8");
  assert.match(worker, /ensureEquipmentTables/);
  assert.match(worker, /kingdom_equipment/);
  assert.match(worker, /type==="equipment_upgrade"/);
  assert.match(worker, /gold=gold-\?/);
  assert.match(worker, /level=level\+1/);
  assert.match(worker, /type==="equipment_lock"/);
  assert.match(worker, /equipment,cosmetics,player/);
  assert.match(worker, /function equipmentBonuses/);
  assert.match(worker, /equipmentProductionBonus/);
  assert.match(worker, /equipmentAttackBonusPercent:gear\.attackPercent/);
  assert.match(worker, /equipmentHealthBonusPercent:gear\.healthPercent/);
  assert.match(worker, /gear\.defensePercent/);
  assert.match(migration, /PRIMARY KEY \(kingdom_id, item_key\)/);
  for (const table of ["hero_inventory", "hero_summon_history", "kingdom_cosmetics", "kingdom_cosmetic_wallet", "kingdom_collection_claims", "shop_inventory", "merchant_stock"]) assert.match(runtimeMigration, new RegExp("CREATE TABLE IF NOT EXISTS " + table));
  assert.doesNotMatch(worker, /CREATE TABLE IF NOT EXISTS/);
  assert.match(ui, /type:"equipment_upgrade"/);
  assert.match(ui, /type:"equipment_lock"/);
  assert.doesNotMatch(ui, /playerState\.gold\s*[-+]=/);
  assert.doesNotMatch(ui, /item\.level\s*\+=/);
});
