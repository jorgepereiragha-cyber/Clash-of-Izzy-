import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { simulateBattle } from "../game-adapter.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("cinco espaços possuem progressão completa Comum, Raro, Épico e Lendário", async () => {
  const worker = await read("worker.js");
  const expectedPaths = [
    ["iron_sword","espada_guerreiro","rune_spear","mjolnir_fragment"],
    ["iron_helm","raven_helm","runic_helm","coroa_izzy"],
    ["leather_armor","warden_plate","manto_real","aegis_asgard"],
    ["scout_boots","wolf_boots","storm_boots","asgardian_greaves"],
    ["copper_ring","frost_ring","moon_charm","valkyrie_charm"]
  ];
  assert.ok(worker.includes("const EQUIPMENT_PROGRESSION="));
  assert.ok(worker.includes('rarity:"comum",tierRank:1'));
  assert.ok(worker.includes('rarity:"raro",tierRank:2'));
  assert.ok(worker.includes('rarity:"epico",tierRank:3'));
  assert.ok(worker.includes('rarity:"lendario",tierRank:4'));
  for (const path of expectedPaths) {
    for (const item of path) assert.ok(worker.includes(item), "item ausente: " + item);
  }
  assert.ok(worker.includes("const STARTER_EQUIPMENT_KEYS=[\"iron_sword\",\"iron_helm\",\"leather_armor\",\"scout_boots\",\"copper_ring\"]"));
});

test("forja exige peça anterior, desbloqueio, pesquisa e custo pelo Worker", async () => {
  const worker = await read("worker.js");
  const start = worker.indexOf('}else if(type==="equipment_craft"){');
  const end = worker.indexOf('}else if(type==="equipment_upgrade"){', start);
  assert.ok(start >= 0 && end > start);
  const craft = worker.slice(start, end);
  assert.ok(craft.includes("if(def.requiresItem)"));
  assert.ok(craft.includes("if(!predecessor)"));
  assert.ok(craft.includes("Number(predecessor.is_locked)"));
  assert.ok(craft.includes("def.requiredResearch"));
  assert.ok(craft.includes("AND EXISTS(SELECT 1 FROM kingdom_equipment WHERE kingdom_id=? AND item_key=? AND is_locked=0)"));
  assert.ok(craft.includes("gold=gold-?,iron=iron-?"));
  assert.ok(craft.includes("INSERT INTO kingdom_equipment"));
});

test("o estado do jogo entrega as cinco trilhas e estágios de cada reino", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("function buildEquipmentProgression"));
  assert.ok(worker.includes("equipmentProgression,equipmentBonuses:activeGear"));
  assert.ok(worker.includes("EQUIPMENT_PROGRESSION.map"));
  const ui = await read("equipment-system.js");
  const html = await read("equipment-ui.html");
  assert.ok(ui.includes('state?.equipmentProgression||[]'));
  assert.ok(ui.includes("Disponível para forjar"));
  assert.ok(html.includes('id="equipment-progression-grid"'));
});

test("bônus de combate de skin são lidos do cadastro que pertence ao reino", async () => {
  const worker = await read("worker.js");
  const migration = await read("migrations/0028_skin_combat_attributes.sql");
  assert.ok(worker.includes("function getEquippedCastleSkinCombatBonuses"));
  assert.ok(worker.includes("JOIN player_skins ps ON ps.skin_id=s.id"));
  assert.ok(worker.includes("WHERE k.id=? AND s.id=?"));
  assert.ok(worker.includes("skinAttackBonusPercent:skinBonus.attackPercent"));
  assert.ok(worker.includes("skinDefenseBonusPercent:skinBonus.defensePercent"));
  assert.ok(migration.includes("attack_bonus_percent"));
  assert.ok(migration.includes("defense_bonus_percent"));
  assert.ok(migration.includes("(id * 37) % 200"));
  assert.ok(migration.includes("(id * 73 + 19) % 200"));
});

test("skin equipada altera poder de ataque e bônus não ultrapassam o teto global", () => {
  const army = [{unit_type:"militia",tier:5,quantity:500}];
  const base = simulateBattle({army,castleLevel:10,defenderLevel:20,heroLevel:20,dragonLevel:10,researchLevel:10,criticalSeed:42,roll:1});
  const withSkin = simulateBattle({army,castleLevel:10,defenderLevel:20,heroLevel:20,dragonLevel:10,researchLevel:10,skinAttackBonusPercent:2.34,skinDefenseBonusPercent:2.34,criticalSeed:42,roll:1});
  const capped = simulateBattle({army,castleLevel:10,defenderLevel:20,heroLevel:20,dragonLevel:10,researchLevel:10,equipmentAttackBonusPercent:30,skinAttackBonusPercent:2.5,defenseBonusPercent:30,skinDefenseBonusPercent:2.5,criticalSeed:42,roll:1});
  const exactAttackCap = simulateBattle({army,castleLevel:10,defenderLevel:20,heroLevel:20,dragonLevel:10,researchLevel:10,equipmentAttackBonusPercent:30,defenseBonusPercent:30,criticalSeed:42,roll:1});
  assert.ok(withSkin.attackerPower > base.attackerPower);
  assert.deepEqual(capped, exactAttackCap);
  assert.ok(Number.isFinite(capped.attackerPower));
});

test("o conjunto lendário só recebe bônus com as cinco peças equipadas e destravadas", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes('const legendaryKeys=["mjolnir_fragment","coroa_izzy","aegis_asgard","asgardian_greaves","valkyrie_charm"]'));
  assert.ok(worker.includes("legendaryKeys.every(key=>equippedKeys.has(key))"));
  assert.ok(worker.includes("legendarySetActive"));
  assert.ok(worker.includes("if(!item||item.isLocked)continue"));
});
