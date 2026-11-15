import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectKingdomQualityProfile, calculateKingdomPixelRatio } from "../scripts/kingdom-quality.js";

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

test("quality profile uses the real viewport while the kingdom panel is initially hidden", () => {
  assert.match(renderer, /viewportWidth: host\.clientWidth \|\| window\.innerWidth/);
});

test("3D scene is mobile-conscious and does not run an unnecessary animation loop", () => {
  assert.match(renderer, /powerPreference: "low-power"/);
  assert.match(renderer, /calculateKingdomPixelRatio\(\{ width: host\.clientWidth, height: host\.clientHeight, devicePixelRatio: window\.devicePixelRatio \|\| 1, profile: qualityProfile \}\)/);
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
  assert.match(renderer, /calculateKingdomPixelRatio/);
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
  assert.equal(low.maxBuildings, 8);
  assert.equal(balanced.tier, "balanced");
  assert.equal(balanced.pixelRatioCap, 1.25);
  assert.equal(balanced.shadows, false);
  assert.equal(balanced.maxBuildings, 12);
  assert.equal(high.tier, "high");
  assert.equal(high.pixelRatioCap, 1.5);
  assert.equal(high.shadows, true);
  assert.equal(high.maxBuildings, 16);
});

test("pixel budget wins over the old half-resolution floor on extreme mobile viewports", () => {
  const low = selectKingdomQualityProfile({ deviceMemory: 3, hardwareConcurrency: 4, viewportWidth: 390, maxTextureSize: 4096 });
  const ratio = calculateKingdomPixelRatio({ width: 2160, height: 3840, devicePixelRatio: 3, profile: low });
  assert.ok(ratio < 0.5);
  assert.ok(2160 * 3840 * ratio * ratio <= low.maxPixelCount + 1);
});

test("renderer diagnostics expose only local rendering counters and are cleaned on fallback", () => {
  assert.match(renderer, /window\.__coiKingdomDiagnostics = diagnostics/);
  assert.match(renderer, /drawCalls: info\.render\.calls/);
  assert.match(renderer, /triangles: info\.render\.triangles/);
  assert.match(renderer, /geometries: info\.memory\.geometries/);
  assert.match(renderer, /textures: info\.memory\.textures/);
  assert.match(renderer, /delete window\.__coiKingdomDiagnostics/);
});


test("drawing buffer pixel count is capped for tall and high-density mobile viewports", () => {
  const low = selectKingdomQualityProfile({ deviceMemory: 3, hardwareConcurrency: 4, viewportWidth: 390, maxTextureSize: 4096 });
  const balanced = selectKingdomQualityProfile({ deviceMemory: 6, hardwareConcurrency: 6, viewportWidth: 720, maxTextureSize: 8192 });
  const lowRatio = calculateKingdomPixelRatio({ width: 1080, height: 2400, devicePixelRatio: 3, profile: low });
  const balancedRatio = calculateKingdomPixelRatio({ width: 1440, height: 3200, devicePixelRatio: 3, profile: balanced });
  assert.ok(1080 * 2400 * lowRatio * lowRatio <= low.maxPixelCount + 1);
  assert.ok(1440 * 3200 * balancedRatio * balancedRatio <= balanced.maxPixelCount + 1);
  assert.ok(lowRatio < 1);
  assert.ok(balancedRatio < balanced.pixelRatioCap);
  assert.equal(calculateKingdomPixelRatio({ width: 1, height: 1, devicePixelRatio: 0, profile: low }), 1);
});


test("pixel budget is reapplied on resize for tall high-density mobile viewports", () => {
  const profile = selectKingdomQualityProfile({ deviceMemory: 4, hardwareConcurrency: 4, viewportWidth: 390, maxTextureSize: 4096 });
  const ratio = calculateKingdomPixelRatio({ width: 390, height: 844, devicePixelRatio: 3, profile });
  assert.ok(ratio <= 1);
  assert.ok(390 * 844 * ratio * ratio <= profile.maxPixelCount + 1);
  assert.match(renderer, /const resize = \(\) => \{[\s\S]*?calculateKingdomPixelRatio/);
});


test("WebGL fallback explicitly disposes GPU resources and unregisters kingdom listeners", () => {
  assert.match(renderer, /function disposeObject3D\(root, resources\)/);
  assert.match(renderer, /function disposeSceneResources\(\)/);
  assert.match(renderer, /resources\.geometries\.add\(node\.geometry\)/);
  assert.match(renderer, /resources\.textures\.add\(value\)/);
  assert.match(renderer, /for \(const geometry of resources\.geometries\) geometry\.dispose\(\)/);
  assert.match(renderer, /for \(const texture of resources\.textures\) texture\.dispose\(\)/);
  assert.match(renderer, /for \(const mat of resources\.materials\) mat\.dispose\(\)/);
  assert.match(renderer, /window\.removeEventListener\("coi:kingdom-render", kingdomRenderHandler\)/);
  assert.match(renderer, /ktx2\?\.dispose\(\)/);
  assert.match(renderer, /if \(disposed\) return/);
});


test("late GLB loads are disposed when WebGL context is lost during async loading", () => {
  assert.match(renderer, /if \(disposed \|\| !renderer\) return/);
  assert.match(renderer, /if \(disposed \|\| !renderer\) \{/);
  assert.match(renderer, /disposeDetachedObject3D\(gltf\.scene\)/);
  assert.match(renderer, /if \(!disposed && renderer && glbTemplates\.size\) renderBuildings\(latestBuildings\)/);
  assert.match(renderer, /function disposeDetachedObject3D\(root\)/);
});

test("GLTF ImageBitmap resources are explicitly closed with GPU textures", () => {
  assert.match(renderer, /resources\.imageBitmaps\.add\(bitmap\)/);
  assert.match(renderer, /for \(const bitmap of resources\.imageBitmaps\) bitmap\.close\(\)/);
  assert.match(renderer, /const resources = \{ geometries: new Set\(\), materials: new Set\(\), textures: new Set\(\), imageBitmaps: new Set\(\) \}/);
});
