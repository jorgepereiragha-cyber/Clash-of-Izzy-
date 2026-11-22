import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const renderer = await readFile(new URL("../world-map-3d.js", import.meta.url), "utf8");

test("forest vegetation uses GPU instancing instead of building one mesh per tree", () => {
  assert.ok(renderer.includes("function addInstancedForest(parent, positions)"));
  assert.equal((renderer.match(/new THREE\\.InstancedMesh/g) || []).length, 4);
  assert.ok(renderer.includes("const forestPositions = []"));
  assert.ok(renderer.includes("addInstancedForest(terrainRoot, forestPositions)"));
  assert.ok(renderer.includes("addInstancedForest(territoryRoot, forestPositions)"));
  assert.ok(!renderer.includes("function addTree("));
});

test("world forest batches have updated bounds and release per-instance GPU buffers", () => {
  for (const text of [
    "batch.instanceMatrix.needsUpdate = true",
    "batch.computeBoundingBox()",
    "batch.computeBoundingSphere()",
    "batch.frustumCulled = true",
    "if (node.isInstancedMesh) node.dispose()"
  ]) assert.ok(renderer.includes(text), "missing GPU lifecycle marker: " + text);
});

test("tree optimization does not remove the world throne, castles or marching", () => {
  for (const text of [
    'territory.territory_kind === "throne"',
    "createRoyalThrone(parent,x,z,worldState?.throneShielded===true)",
    "function createCastle(",
    "function updateMarchPositions(",
    "function projectTerritories()",
    "const treeCount = quality === \"low\" ? 38 : quality === \"high\" ? 105 : 68"
  ]) assert.ok(renderer.includes(text), "missing world-map feature: " + text);
});

test("world-map rendering script passes Node syntax checks", () => {
  const pathname = fileURLToPath(new URL("../world-map-3d.js", import.meta.url));
  const result = spawnSync(process.execPath, ["--check", pathname], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
