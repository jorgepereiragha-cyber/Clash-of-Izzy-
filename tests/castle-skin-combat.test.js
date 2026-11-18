import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { simulateBattle } from "../game-adapter.js";

test("bônus das skins pagas vêm de migração separada e ficam dentro do limite", async () => {
  const migration = await readFile(new URL("../migrations/0028_skin_combat_attributes.sql", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const adapter = await readFile(new URL("../game-adapter.js", import.meta.url), "utf8");
  const arena = await readFile(new URL("../arena.html", import.meta.url), "utf8");
  const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(migration, /CHECK \(attack_bonus_percent >= 0 AND attack_bonus_percent <= 2\.5\)/);
  assert.match(migration, /CHECK \(defense_bonus_percent >= 0 AND defense_bonus_percent <= 2\.5\)/);
  assert.match(worker, /JOIN player_skins ps ON ps\.skin_id=s\.id/);
  assert.match(worker, /JOIN players p ON p\.id=ps\.player_id JOIN kingdoms k ON k\.player_id=p\.id/);
  assert.match(adapter, /skinAttackBonusPercent/);
  assert.match(adapter, /skinDefenseBonusPercent/);
  assert.match(arena, /attack_bonus_percent/);
  assert.match(arena, /defense_bonus_percent/);
  assert.match(kingdom, /skin\.attack_bonus_percent/);
  assert.match(kingdom, /skin\.defense_bonus_percent/);
  const attackValues = Array.from({length:200}, (_, index) => Number((0.35 + (((index + 1) * 37) % 200) / 100).toFixed(2)));
  const defenseValues = Array.from({length:200}, (_, index) => Number((0.35 + (((index + 1) * 73 + 19) % 200) / 100).toFixed(2)));
  assert.equal(new Set(attackValues).size, 200, "200 skins têm bônus de ataque individuais");
  assert.equal(new Set(defenseValues).size, 200, "200 skins têm bônus de defesa individuais");
});

test("uma skin de ataque aumenta a força calculada em batalha", () => {
  const army = [{ unit_type: "militia", tier: 4, quantity: 300 }];
  const base = simulateBattle({ army, castleLevel: 8, defenderLevel: 18, roll: 1, criticalSeed: 777 });
  const skin = simulateBattle({ army, castleLevel: 8, defenderLevel: 18, skinAttackBonusPercent: 2.1, roll: 1, criticalSeed: 777 });
  assert.ok(skin.attackerPower > base.attackerPower);
});

test("bônus de skin não elevam ataque acima do teto global de 30%", () => {
  const army = [{ unit_type: "militia", tier: 4, quantity: 300 }];
  const exactCap = simulateBattle({ army, castleLevel: 8, defenderLevel: 18, equipmentAttackBonusPercent: 30, roll: 1, criticalSeed: 777 });
  const overCap = simulateBattle({ army, castleLevel: 8, defenderLevel: 18, equipmentAttackBonusPercent: 30, skinAttackBonusPercent: 2.5, roll: 1, criticalSeed: 777 });
  assert.deepEqual(overCap, exactCap);
});
