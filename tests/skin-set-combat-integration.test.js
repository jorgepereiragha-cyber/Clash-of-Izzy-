import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { simulateBattle } from "../game-adapter.js";
import { SKIN_SET_CATALOG, getSkinSetBonuses } from "../skin-sets.js";

test("bônus de conjunto aumenta poder de ataque no simulador server-authoritative", () => {
  const set = SKIN_SET_CATALOG.find(item => item.id === "egyptian_solar_court");
  const equipped = set.items.map(item => ({ item_id: item.id, equipped_slot: item.slot }));
  const bonuses = getSkinSetBonuses(equipped);
  const base = {
    army: [{ unit_type: "swordsman", quantity: 100, tier: 1 }],
    castleLevel: 1,
    defenderLevel: 1,
    heroLevel: 1,
    dragonLevel: 1,
    researchLevel: 0,
    castlePowerBonusPercent: 0,
    criticalSeed: 123456,
    roll: 1
  };
  const withoutSet = simulateBattle(base);
  const withSet = simulateBattle({
    ...base,
    skinSetAttackBonusPercent: bonuses.attackPercent,
    skinSetDefenseBonusPercent: bonuses.defensePercent,
    skinSetHealthBonusPercent: bonuses.healthPercent,
    skinSetCriticalChancePercent: bonuses.criticalChancePercent
  });
  assert.ok(withSet.attackerPower > withoutSet.attackerPower);
});

test("Worker valida equipamento por propriedade e aplica bônus dos conjuntos no combate", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(worker.includes('type==="skin_set_equip"'));
  assert.ok(worker.includes("Você precisa adquirir esta peça antes de equipá-la."));
  assert.ok(worker.includes("SELECT item_id,kind,acquired_at,equipped_slot FROM kingdom_cosmetics"));
  assert.ok(worker.includes("skinSetAttackBonusPercent:cosmeticState.skinSetBonuses.attackPercent"));
  assert.ok(worker.includes("skinSetDefenseBonusPercent:cosmeticState.skinSetBonuses.defensePercent"));
  assert.ok(worker.includes("skin_sets:cosmeticState.skinSetBonuses"));
});

test("migração de loadout é aditiva e não apaga itens existentes", async () => {
  const migration = await readFile(new URL("../migrations/0029_skin_set_gallery.sql", import.meta.url), "utf8");
  assert.ok(migration.includes("ADD COLUMN equipped_slot TEXT"));
  assert.ok(migration.includes("idx_kingdom_cosmetics_equipped_slot"));
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM kingdom_cosmetics/i);
});
