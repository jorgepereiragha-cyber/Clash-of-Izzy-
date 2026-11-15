import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../assets/3d/manifest.json", import.meta.url), "utf8"));

test("kingdom progressively loads Three.js with a safe 2D fallback", () => {
  assert.match(kingdom, /type="module" src="\/scripts\/kingdom-3d\.js"/);
  assert.match(kingdom, /drawKingdomScene\(buildings\)/);
  assert.match(renderer, /new THREE\.WebGLRenderer/);
  assert.match(renderer, /WebGL indisponível; mantendo arte procedural 2D/);
  assert.match(renderer, /coi:kingdom-render/);
  assert.match(renderer, /slice\(0, 16\)/);
  assert.match(renderer, /const col = i % 4/);
  assert.ok(renderer.includes("new THREE.InstancedMesh"));
  assert.match(renderer, /addForestInstances/);
  assert.match(kingdom, /type="importmap"/);
  assert.ok(kingdom.includes('"three":"https://cdn.jsdelivr.net'));
});

test("3D scene is mobile-conscious and does not run an unnecessary animation loop", () => {
  assert.match(renderer, /powerPreference: "low-power"/);
  assert.match(renderer, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.25\)/);
  assert.match(renderer, /renderer\.shadowMap\.enabled = host\.clientWidth > 680/);
  assert.match(renderer, /ResizeObserver/);
  assert.doesNotMatch(renderer, /requestAnimationFrame/);
});

test("glTF and KTX2/Basis loaders are configured for production assets", () => {
  assert.match(renderer, /GLTFLoader/);
  assert.match(renderer, /KTX2Loader/);
  assert.match(renderer, /setTranscoderPath/);
  assert.match(renderer, /makeSurfaceTexture/);
  assert.match(renderer, /applyProceduralSurfaceMaps/);
  assert.match(renderer, /surfaceTextureCache/);
  assert.match(renderer, /surfaceMaterial\(colors\[0\], "stone"/);
  assert.match(renderer, /surfaceMaterial\(colors\[1\], "roof"/);
  assert.match(renderer, /kind === "stone"/);
  assert.match(renderer, /kind === "wood"/);
  assert.match(renderer, /setKTX2Loader\(ktx2\)/);
  assert.deepEqual(manifest, { version: 1, models: [] });
});

test("procedural buildings are replaceable by explicitly enabled GLB assets", () => {
  assert.match(renderer, /asset\.enabled !== true/);
  assert.match(renderer, /glbTemplates\.set\(asset\.type, template\)/);
  assert.match(renderer, /glbTemplates\.get\(b\.building_type\)/);
  assert.match(renderer, /coIType/);
});

test("rendered scene preserves accessible interactive building controls", () => {
  assert.match(kingdom, /data-building=/);
  assert.match(kingdom, /data-upgrade=/);
  assert.match(kingdom, /setAttribute\("aria-hidden","true"\)/);
  assert.match(renderer, /setAttribute\("aria-hidden", "true"\)/);
});


test("state refresh keeps the live WebGL canvas mounted in the kingdom", () => {
  assert.match(kingdom, /const kingdom3d=city\.querySelector\("#kingdom3d"\)/);
  assert.match(kingdom, /if\(kingdom3d\)city\.append\(kingdom3d\)/);
});


test("renderer degrades gracefully on low-memory Android and WebGL context loss", () => {
  assert.match(renderer, /navigator\.deviceMemory/);
  assert.match(renderer, /deviceMemory <= 4 \? 1 : 1\.25/);
  assert.match(renderer, /host\.clientWidth > 680 && !\(deviceMemory > 0 && deviceMemory <= 4\)/);
  assert.match(renderer, /webglcontextlost/);
  assert.match(renderer, /host\.classList\.remove\("has-3d"\)/);
  assert.match(renderer, /arte 2D restaurada/);
});
