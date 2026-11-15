import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { simulateBattle, calculateMarchDuration } from "../game-adapter.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("forja usa o catálogo e a tabela de inventário existentes, sem criar outro motor", async () => {
  const worker = await read("worker.js");
  for (const id of ["iron_sword","rune_spear","raven_helm","warden_plate","storm_boots","frost_ring","mjolnir_fragment","valkyrie_charm"]) assert.ok(worker.includes(id));
  assert.ok(worker.includes("const STARTER_EQUIPMENT_KEYS="));
  assert.ok(worker.includes("STARTER_EQUIPMENT_KEYS.map"));
  assert.ok(worker.includes('type==="equipment_craft"'));
  assert.ok(worker.includes("UPDATE kingdoms SET gold=gold-?,iron=iron-?"));
  assert.ok(worker.includes("INSERT INTO kingdom_equipment(kingdom_id,item_key,level,is_locked) SELECT"));
  assert.ok(!worker.includes("CREATE TABLE IF NOT EXISTS kingdom_equipment"));
});

test("ciência da forja usa a tabela research existente e exige academia", async () => {
  const worker = await read("worker.js");
  for (const id of ["gear_forging","gear_ward","gear_vitality","gear_logistics"]) assert.ok(worker.includes(id));
  assert.ok(worker.includes('type==="research"'));
  assert.ok(worker.includes("key.startsWith(\"gear_\")"));
  assert.ok(worker.includes("building_type='academy'"));
  assert.ok(worker.includes("Math.min(maxLevel,centerLevel*3)"));
});

test("bônus de equipamento e pesquisa são calculados no servidor", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("criticalChancePercent:Math.min(15,totals.critical)"));
  assert.ok(worker.includes("marchSpeedPercent:Math.min(25,totals.march+logistics)"));
  assert.ok(worker.includes("equipmentBonuses(equippedRows.results||[],gearResearchRows.results||[])"));
  assert.ok(worker.includes("criticalChancePercent:gear.criticalChancePercent"));
  assert.ok(worker.includes("calculateMarchDuration(baseSeconds,marchBonus)"));
});

test("interface mostra pesquisa, custos de forja e bônus efetivos", async () => {
  const html = await read("equipment-ui.html");
  const client = await read("equipment-system.js");
  for (const id of ["forge-research-list","forge-catalog-list","equipment-bonus-summary"]) assert.ok(html.includes('id="'+id+'"'));
  assert.ok(client.includes('type:"equipment_craft"'));
  assert.ok(client.includes('type:"research"'));
  assert.ok(client.includes("renderForge()"));
});

test("críticos são determinísticos e a duração da marcha respeita limites", () => {
  const input = {army:[{unit_type:"knight",tier:2,quantity:30}],defenderLevel:3,criticalChancePercent:100,criticalDamageMultiplier:2,criticalSeed:12345,roll:1};
  const critical = simulateBattle(input);
  assert.ok(critical.criticalHits > 0);
  assert.deepEqual(critical,simulateBattle(input));
  assert.equal(calculateMarchDuration(120,0),120);
  assert.equal(calculateMarchDuration(120,50),80);
  assert.equal(calculateMarchDuration(120,100),80);
});
