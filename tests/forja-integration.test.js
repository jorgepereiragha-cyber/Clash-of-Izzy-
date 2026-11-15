import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const legacyPage = await readFile(new URL("../equipment-ui.html", import.meta.url), "utf8");
const forgePage = await readFile(new URL("../equipment-lab.html", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("kingdom and legacy equipment screen expose the Royal Forge", () => {
  assert.ok(kingdom.includes('href="/equipment-lab.html"'));
  assert.ok(legacyPage.includes('href="/equipment-lab.html"'));
  assert.ok(forgePage.includes('src="/equipment-lab.js"'));
});

test("game state keeps the legacy inventory and Forge state contracts separate", () => {
  assert.ok(worker.includes("return {equipment,legacyEquipment,cosmetics"));
  assert.ok(worker.includes("getEquipmentState(env,kingdom.id)"));
  assert.ok(worker.includes("legacyEquipment=(await ensureEquipmentTables"));
});

test("PWA caches the Forge page, scripts and shared catalog", () => {
  for (const path of ["/equipment-lab.html", "/equipment-lab.js", "/equipment-engine.js", "/equipment-ui.html", "/equipment-system.js", "/equipment-styles.css"]) {
    assert.ok(sw.includes('"' + path + '"'), "missing cached Forge asset: " + path);
  }
});
