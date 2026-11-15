import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("legacy inventory remains server-authoritative and separate from the Royal Forge", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const ui = await readFile(new URL("../equipment-system.js", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/0008_kingdom_equipment.sql", import.meta.url), "utf8");
  const runtimeMigration = await readFile(new URL("../migrations/0009_runtime_tables.sql", import.meta.url), "utf8");
  assert.match(worker, /ensureEquipmentTables/);
  assert.match(worker, /LEGACY_EQUIPMENT_CATALOG/);
  assert.match(worker, /type==="legacy_equipment_upgrade"/);
  assert.match(worker, /type==="equipment_lock"/);
  assert.match(worker, /legacyEquipment/);
  assert.match(worker, /legacyEquipmentBonuses/);
  assert.match(worker, /equipmentProductionBonus/);
  assert.match(migration, /PRIMARY KEY \(kingdom_id, item_key\)/);
  for (const table of ["hero_inventory", "hero_summon_history", "kingdom_cosmetics", "kingdom_cosmetic_wallet", "kingdom_collection_claims", "shop_inventory", "merchant_stock"]) assert.match(runtimeMigration, new RegExp("CREATE TABLE IF NOT EXISTS " + table));
  assert.doesNotMatch(worker, /CREATE TABLE IF NOT EXISTS/);
  assert.match(ui, /state\?\.legacyEquipment/);
  assert.match(ui, /type:"legacy_equipment_upgrade"/);
  assert.match(ui, /type:"equipment_lock"/);
  assert.doesNotMatch(ui, /playerState\.gold\s*[-+]=/);
  assert.doesNotMatch(ui, /item\.level\s*\+=/);
});

test("Royal Forge state and combat actions are separate, equipped and server validated", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const ui = await readFile(new URL("../equipment-lab.js", import.meta.url), "utf8");
  assert.match(worker, /EQUIPMENT_CATALOG as FORGE_EQUIPMENT_CATALOG/);
  assert.match(worker, /equipmentBonuses as forgeEquipmentBonuses/);
  assert.match(worker, /return \{equipment,legacyEquipment,cosmetics/);
  for (const action of ["equipment_craft", "equipment_upgrade", "equipment_equip", "equipment_research", "cosmetic_buy"]) {
    assert.ok(worker.includes('type==="' + action + '"'), "missing Forge action: " + action);
    assert.ok(ui.includes('type:"' + action + '"'), "UI does not call Forge action: " + action);
  }
  assert.match(worker, /equipmentAttackPercent:gear\.attackPercent/);
  assert.match(worker, /equipmentDefensePercent:gear\.defensePercent/);
  assert.match(worker, /equipmentHealthPercent:gear\.healthPercent/);
  assert.match(worker, /criticalChancePercent:gear\.criticalChancePercent/);
  assert.match(worker, /calculateMarchDuration\(baseSeconds,forgeState\.bonuses\.marchSpeedPercent\)/);
});
