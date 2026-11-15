import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const legacyPage = await readFile(new URL("../equipment-ui.html", import.meta.url), "utf8");
const legacyScript = await readFile(new URL("../equipment-system.js", import.meta.url), "utf8");
const forgePage = await readFile(new URL("../equipment-lab.html", import.meta.url), "utf8");
const forgeScript = await readFile(new URL("../equipment-lab.js", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("Royal Forge navigation does not replace the existing hero equipment screen", () => {
  assert.ok(kingdom.includes('href="/equipment-lab.html"'));
  assert.ok(legacyPage.includes('href="/equipment-lab.html"'));
  assert.ok(forgePage.includes('src="/equipment-lab.js"'));
  assert.ok(legacyScript.includes("state.equipment"));
  assert.ok(legacyScript.includes("heroEquipment"));
});

test("game state exposes Forge separately from legacy and hero equipment", () => {
  assert.ok(worker.includes("forgeEquipment,cosmetics"));
  assert.ok(worker.includes("getForgeEquipmentState(env,kingdom.id)"));
  assert.ok(worker.includes("const equipmentRows=await ensureEquipmentTables"));
  assert.ok(worker.includes("const heroEquipment="));
  assert.ok(forgeScript.includes("state.forgeEquipment"));
  assert.ok(!forgeScript.includes("state.equipment?.owned"));
});

test("Forge actions are namespaced and validated by the Worker", () => {
  for (const action of ["forge_equipment_craft", "forge_equipment_upgrade", "forge_equipment_equip", "forge_equipment_research", "forge_cosmetic_buy"]) {
    assert.ok(worker.includes('type==="' + action + '"'), "missing server action: " + action);
    assert.ok(forgeScript.includes('type:"' + action + '"'), "UI does not call action: " + action);
  }
  assert.ok(worker.includes("equipmentAttackPercent:gear.attackPercent"));
  assert.ok(worker.includes("equipmentDefensePercent:gear.defensePercent"));
  assert.ok(worker.includes("equipmentHealthPercent:gear.healthPercent"));
  assert.ok(worker.includes("criticalChancePercent:gear.criticalChancePercent"));
  assert.ok(worker.includes("calculateMarchDuration(baseSeconds,forgeState.bonuses.marchSpeedPercent)"));
});

test("PWA caches the Forge page, scripts and shared catalog", () => {
  for (const path of ["/equipment-lab.html", "/equipment-lab.js", "/equipment-engine.js", "/equipment-ui.html", "/equipment-system.js", "/equipment-styles.css"]) {
    assert.ok(sw.includes('"' + path + '"'), "missing cached Forge asset: " + path);
  }
});
