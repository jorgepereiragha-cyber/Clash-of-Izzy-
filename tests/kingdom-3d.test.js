import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectKingdomQualityProfile } from "../scripts/kingdom-quality.js";

const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../assets/3d/manifest.json", import.meta.url), "utf8"));

test("kingdom progressively loads Three.js with a safe 2D fallback", () => {
  assert.match(kingdom, /type="module" src="\/scripts\/kingdom-3d\.js"/);
  assert.match(kingdom, /drawKingdomScene\(buildings\)/);
  assert.match(renderer, /new THREE\.WebGLRenderer/);
  assert.match(renderer, /WebGL indisponível; mantendo arte procedural 2D/);
  assert.match(renderer, /coi:kingdom-render/);
  assert.match(renderer, /slice\(0, qualityProfile\?\.maxBuildings \|\| 16\)/);
  assert.match(renderer, /const col = i % 4/);
  assert.ok(renderer.includes("new THREE.InstancedMesh"));
  assert.match(renderer, /addForestInstances/);
  assert.match(kingdom, /type="importmap"/);
  assert.ok(kingdom.includes('"three":"https://cdn.jsdelivr.net'));
});

test("3D scene is mobile-conscious and does not run an unnecessary animation loop", () => {
  assert.match(renderer, /powerPreference: "low-power"/);
  assert.match(renderer, /Math\.min\(window\.devicePixelRatio \|\| 1, qualityProfile\.pixelRatioCap\)/);
  assert.match(renderer, /renderer\.shadowMap\.enabled = qualityProfile\.shadows/);
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
  assert.match(renderer, /selectKingdomQualityProfile/);
  assert.match(renderer, /qualityProfile\.pixelRatioCap/);
  assert.match(renderer, /qualityProfile\.shadows/);
  assert.match(renderer, /qualityProfile\.shadowMapSize/);
  assert.match(renderer, /qualityProfile\?\.anisotropy/);
  assert.match(renderer, /webglcontextlost/);
  assert.match(renderer, /host\.classList\.remove\("has-3d"\)/);
  assert.match(renderer, /arte 2D restaurada/);
});


test("GLB clones are attached to the scene and late asset loads use the newest kingdom state", () => {
  assert.match(renderer, /scene\.add\(group\);\s*activeModels\.push\(group\)/);
  assert.match(renderer, /let latestBuildings = \[\]/);
  assert.match(renderer, /latestBuildings = Array\.isArray\(buildings\) \? buildings : \[\]/);
  assert.match(renderer, /renderBuildings\(latestBuildings\)/);
});

test("WebGL loss disconnects resize observers and prevents rendering through a disposed renderer", () => {
  assert.match(renderer, /resizeObserver\?\.disconnect\(\)/);
  assert.match(renderer, /if \(!renderer \|\| !scene \|\| !camera\) return/);
  assert.match(renderer, /renderer = null/);
  assert.match(renderer, /window\.removeEventListener\("resize", resizeHandler\)/);
});


test("GLB manifest accepts only bounded same-origin assets for known buildings", () => {
  assert.match(renderer, /manifest\.models\.slice\(0, 32\)/);
  assert.match(renderer, /Object\.hasOwn\(palettes, asset\.type\)/);
  assert.match(renderer, /assetUrl\.origin !== window\.location\.origin/);
  assert.match(renderer, /assetUrl\.pathname\.startsWith\("\/assets\/3d\/"\)/);
  assert.match(renderer, /pathname\.toLowerCase\(\)\.endsWith\("\.glb"\)/);
  assert.match(renderer, /GLB \$\{asset\.type\} indisponível; mantendo modelo procedural/);
});

test("quality profiles scale conservatively across low, balanced and high capability devices", () => {
  const low = selectKingdomQualityProfile({ deviceMemory: 4, hardwareConcurrency: 4, viewportWidth: 390, maxTextureSize: 4096 });
  const balanced = selectKingdomQualityProfile({ deviceMemory: 6, hardwareConcurrency: 6, viewportWidth: 720, maxTextureSize: 8192 });
  const high = selectKingdomQualityProfile({ deviceMemory: 12, hardwareConcurrency: 12, viewportWidth: 1200, maxTextureSize: 16384 });
  assert.equal(low.tier, "low");
  assert.equal(low.pixelRatioCap, 1);
  assert.equal(low.shadows, false);
  assert.equal(balanced.tier, "balanced");
  assert.equal(balanced.pixelRatioCap, 1.25);
  assert.equal(balanced.shadows, false);
  assert.equal(high.tier, "high");
  assert.equal(high.pixelRatioCap, 1.5);
  assert.equal(high.shadows, true);
  assert.equal(high.maxBuildings, 16);
});

test("renderer diagnostics expose only local rendering counters and are cleaned on fallback", () => {
  assert.match(renderer, /window\.__coiKingdomDiagnostics = diagnostics/);
  assert.match(renderer, /drawCalls: info\.render\.calls/);
  assert.match(renderer, /triangles: info\.render\.triangles/);
  assert.match(renderer, /geometries: info\.memory\.geometries/);
  assert.match(renderer, /textures: info\.memory\.textures/);
  assert.match(renderer, /delete window\.__coiKingdomDiagnostics/);
});
