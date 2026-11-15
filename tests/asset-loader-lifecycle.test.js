import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createResourceRegistry,
  collectObject3DResources,
  disposeResourceRegistry,
} from "../engine/resource-disposal.js";

const assetLoader = await readFile(new URL("../engine/asset-loader.js", import.meta.url), "utf8");
const textureManager = await readFile(new URL("../engine/texture-manager.js", import.meta.url), "utf8");
const arena = await readFile(new URL("../arena.html", import.meta.url), "utf8");

test("shared geometry, material, texture and ImageBitmap resources are disposed exactly once", () => {
  const calls = { geometry: 0, material: 0, texture: 0, bitmap: 0 };
  const bitmap = { close() { calls.bitmap += 1; } };
  const texture = { isTexture: true, image: bitmap, dispose() { calls.texture += 1; } };
  const geometry = { dispose() { calls.geometry += 1; } };
  const material = { map: texture, dispose() { calls.material += 1; } };
  const nodes = [
    { geometry, material, traverse(callback) { callback(this); } },
    { geometry, material, traverse(callback) { callback(this); } },
  ];
  const root = { traverse(callback) { nodes.forEach(callback); } };
  const resources = collectObject3DResources(root, createResourceRegistry());

  assert.equal(resources.geometries.size, 1);
  assert.equal(resources.materials.size, 1);
  assert.equal(resources.textures.size, 1);
  assert.equal(resources.imageBitmaps.size, 1);

  disposeResourceRegistry(resources);
  disposeResourceRegistry(resources);
  assert.deepEqual(calls, { geometry: 1, material: 1, texture: 1, bitmap: 1 });
});

test("GLTF loader invalidates stale generations and releases cached models on teardown", () => {
  assert.match(assetLoader, /loaderGeneration/);
  assert.match(assetLoader, /generation !== loaderGeneration/);
  assert.match(assetLoader, /disposeGLTFResources\(gltf\)/);
  assert.match(assetLoader, /promise\.then\(disposeGLTFResources\)/);
  assert.match(assetLoader, /activeInstances/);
  assert.match(assetLoader, /instance\.dispose\(\)/);
});

test("late texture responses are disposed instead of repopulating a closed scene", () => {
  assert.match(textureManager, /textureGeneration/);
  assert.match(textureManager, /generation !== textureGeneration/);
  assert.match(textureManager, /disposeTexture\(texture\)/);
  assert.match(textureManager, /textureGeneration \+= 1/);
});

test("arena and shared loaders use the same pinned Three.js version and page teardown cleanup", () => {
  assert.match(arena, /three@0\.187\.0/);
  assert.match(assetLoader, /three@0\.187\.0/);
  assert.match(arena, /pagehide/);
  assert.match(arena, /window\.COI_ASSETS\.dispose\(\)/);
});


test("asset loaders reject external URLs and non-approved file paths", () => {
  assert.match(assetLoader, /parsed\.origin !== window\.location\.origin/);
  assert.match(assetLoader, /parsed\.pathname\.startsWith\('\/assets\/models\/'\)/);
  assert.ok(assetLoader.includes("!/\\.glb$/i.test(parsed.pathname)"));
  assert.match(textureManager, /parsed\.pathname\.startsWith\('\/assets\/textures\/'\)/);
  assert.match(textureManager, /!\['png','jpg','jpeg','webp','avif'\]\.includes\(extension\)/);
});
