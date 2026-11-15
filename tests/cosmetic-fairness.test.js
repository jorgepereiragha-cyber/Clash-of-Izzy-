import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { equipmentBonuses } from "../equipment-engine.js";

const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const equipmentSource = await readFile(new URL("../equipment-engine.js", import.meta.url), "utf8");

function catalogBlock(source, name, endMarker) {
  const candidates = [`const ${name}=`, `const ${name} =`, `export const ${name}=`, `export const ${name} =`].map(marker => source.indexOf(marker)).filter(index => index >= 0);
  const start = candidates.length ? Math.min(...candidates) : -1;
  assert.ok(start >= 0, `catálogo ${name} encontrado`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `fim do catálogo ${name} encontrado`);
  return source.slice(start, end + endMarker.length);
}

test("skins de coleção, sazonais e fusões são exclusivamente cosméticas", () => {
  for (const [name, end] of [
    ["COSMETIC_SKINS", "};"],
    ["SEASONAL_COSMETICS", "];"],
    ["SKIN_FUSIONS", "];"],
  ]) {
    const block = catalogBlock(worker, name, end);
    assert.doesNotMatch(block, /\b(?:atk|def|attack|defense|special)\s*:/i,
      `${name} não pode declarar atributos ou efeitos de combate`);
    assert.doesNotMatch(block, /\+\s*\d+\s*%/,
      `${name} não pode prometer bônus percentuais`);
  }
});

test("skins do panteão nórdico não concedem atributos de combate", () => {
  const skins = catalogBlock(equipmentSource, "NORSE_SKINS", "]);");
  assert.doesNotMatch(skins, /\b(?:atk|def|attack|defense|stats|bonus)\s*:/i);
  assert.match(skins, /visuais?/i);
});

test("bônus de batalha continuam vindo apenas de equipamento equipado e pesquisa", () => {
  const empty = equipmentBonuses([], [], []);
  assert.deepEqual(empty, {
    attackPercent: 0,
    defensePercent: 0,
    healthPercent: 0,
    marchSpeedPercent: 0,
    criticalChancePercent: 0,
  });
  assert.match(equipmentSource, /EQUIPMENT_CATALOG\.find\(x=>x\.id===row\.item_key\)/);
  assert.doesNotMatch(equipmentSource.slice(equipmentSource.indexOf("export function equipmentBonuses")),
    /NORSE_SKINS|COSMETIC_SKINS|SEASONAL_COSMETICS|SKIN_FUSIONS/);
});
