import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worldMap = await readFile(new URL("../world-map-3d.js", import.meta.url), "utf8");

test("world map batches repeated terrain and territory trees into bounded InstancedMesh groups", () => {
  assert.match(worldMap, /function addTreeInstances\(parent, trees\)/);
  assert.equal((worldMap.match(/new THREE\.InstancedMesh\(/g) || []).length, 3);
  assert.match(worldMap, /trunks\.setMatrixAt\(index, dummy\.matrix\)/);
  assert.match(worldMap, /crowns\.setMatrixAt\(index, dummy\.matrix\)/);
  assert.match(worldMap, /crownTops\.setMatrixAt\(index, dummy\.matrix\)/);
  assert.match(worldMap, /mesh\.computeBoundingBox\(\)/);
  assert.match(worldMap, /mesh\.computeBoundingSphere\(\)/);
  assert.match(worldMap, /mesh\.frustumCulled = true/);
  assert.match(worldMap, /addTreeInstances\(terrainRoot, terrainTrees\)/);
  assert.match(worldMap, /addTreeInstances\(territoryRoot, forestTrees\)/);
  assert.match(worldMap, /quality === "low" \? 38 : quality === "high" \? 105 : 68/);
});

test("forest territory decoration is batched after all territory features are built", () => {
  assert.match(worldMap, /const forestTrees = \[\]/);
  assert.match(worldMap, /createTerritoryFeature\(territoryRoot, territory, forestTrees\)/);
  assert.match(worldMap, /forestTrees\.push\(/);
});
