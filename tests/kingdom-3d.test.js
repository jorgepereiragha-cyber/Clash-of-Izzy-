import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectKingdomQualityProfile, calculateKingdomPixelRatio, createFrameTimingSampler } from "../scripts/kingdom-quality.js";

const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../assets/3d/manifest.json", import.meta.url), "utf8"));

test("Kenney castle kit progressively replaces the default castle without leaking shared GLB geometry", () => {
  assert.match(renderer, /function createCastleGlbGroup\(\)/);
  assert.match(renderer, /glbTemplates\.get\("watchtower"\)/);
  assert.match(renderer, /glbTemplates\.get\("wall"\)/);
  assert.match(renderer, /towerTemplate\.clone\(true\)/);
  assert.match(renderer, /wallTemplate\.clone\(true\)/);
  assert.match(renderer, /latestCastleSkinId === 0/);
  assert.match(renderer, /const group = castleKit \|\| \(template \? template\.clone\(true\) : createBuilding/);
  assert.match(renderer, /neededTypes\.add\("watchtower"\)/);
  assert.match(renderer, /neededTypes\.add\("wall"\)/);
  assert.match(renderer, /if \(!towerTemplate \|\| !wallTemplate \|\| qualityProfile\?\.tier === "low"\) return null/);
  assert.match(renderer, /PCFSoftShadowMap/);
});

test("mobile GLB trees scale to device tier without discarding instanced procedural forest", () => {
  const trees=manifest.props.find(asset=>asset.id==="kenney-tree-high");
  assert.equal(trees.positions.length,6);
  assert.match(renderer,/positions\.slice\(0, qualityProfile\?\.tier === "high" \? 6 : 3\)/);
  assert.match(renderer,/function addForestInstances\(\)/);
  assert.match(renderer,/new THREE\.InstancedMesh\(trunkGeometry/);
});

test("kingdom progressively loads Three.js with a safe 2D fallback", () => {
  assert.match(kingdom, /type="module" src="\/scripts\/kingdom-visual-boot\.js"/);
  assert.match(kingdom, /drawKingdomScene\(buildings,Number\(k\.equipped_skin_id\|\|0\)\)/);
  assert.match(renderer, /new THREE\.WebGLRenderer/);
  assert.match(renderer, /WebGL indisponível; mantendo arte procedural 2D/);
  assert.match(renderer, /coi:kingdom-render/);
  assert.match(renderer, /Math\.min\(9, qualityProfile\?\.maxBuildings \|\| 9\)/);
  assert.match(renderer, /const \{ x, z \} = cityWorldPoint\(b, i\)/);
  assert.match(renderer, /frameCityBuildings\(list\)/);
  assert.match(renderer, /Number\(building\?\.position_x\)/);
  assert.ok(renderer.includes("new THREE.InstancedMesh"));
  assert.match(renderer, /addForestInstances/);
  assert.match(kingdom, /type="importmap"/);
  assert.ok(kingdom.includes('"three":"/vendor/three/build/three.module.js"'));
});

test("bundled CC0 models can render props and only display units present in the army", () => {
  assert.match(renderer, /manifestProps = Array\.isArray\(manifest\.props\)/);
  assert.match(renderer, /manifestUnits = Array\.isArray\(manifest\.units\)/);
  assert.match(renderer, /function renderManifestProps\(\)/);
  assert.match(renderer, /function renderKingdomTroops\(troops = \[\]\)/);
  assert.match(renderer, /unit\?\.unit_type === "archer"/);
  assert.match(renderer, /cloneSkinned\(asset\.template\)/);
  assert.match(renderer, /new THREE\.AnimationMixer\(root\)/);
  assert.match(kingdom, /window\.__coiKingdomTroops=state\.troops\|\|\[\]/);
  assert.match(kingdom, /detail:\{buildings,troops:state\.troops\|\|\[\],defenses:state\.cityDefenses\|\|\[\],heroes:window\.__coiKingdomHeroAssignments,castleSkinId:Number\(k\.equipped_skin_id\|\|0\),castleVipLevel:window\.__coiKingdomCastleVipLevel\}/);
});

test("quality profile uses the real viewport while the kingdom panel is initially hidden", () => {
  assert.match(renderer, /viewportWidth: host\.clientWidth \|\| window\.innerWidth/);
});

test("3D scene is mobile-conscious and does not run an unnecessary animation loop", () => {
  assert.match(renderer, /powerPreference: highGpuRequested \? "high-performance" : "default"/);
  assert.match(renderer, /calculateKingdomPixelRatio\(\{ width: host\.clientWidth, height: host\.clientHeight, devicePixelRatio: window\.devicePixelRatio \|\| 1, profile: qualityProfile \}\)/);
  assert.match(renderer, /renderer\.shadowMap\.enabled = qualityProfile\.shadows/);
  assert.match(renderer, /ResizeObserver/);
  assert.match(renderer, /requestAnimationFrame\(renderArmyFrame\)/);
  assert.match(renderer, /qualityProfile\?\.tier === "low"/);
  assert.match(renderer, /qualityProfile\?\.prefersReducedMotion/);
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
  assert.equal(manifest.version, 2);
  assert.ok(manifest.models.some(asset => asset.type === "watchtower"));
  assert.ok(manifest.models.some(asset => asset.type === "wall"));
  assert.ok(manifest.props.length >= 2);
  assert.ok(manifest.units.some(asset => asset.unit_type === "archer"));
});

test("procedural buildings are replaceable by explicitly enabled GLB assets", () => {
  assert.match(renderer, /asset\?\.enabled === true/);
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


test("building hit targets are projected from the isometric camera and refreshed after resize", () => {
  assert.match(renderer, /function publishBuildingHitTargets\(buildings = latestBuildings\)/);
  assert.match(renderer, /new THREE\.Vector3\(x, \.18, z\)\.project\(camera\)/);
  assert.match(renderer, /new CustomEvent\("coi:kingdom-projection"/);
  assert.match(renderer, /publishBuildingHitTargets\(latestBuildings\)/);
  assert.match(renderer, /url\.pathname\.startsWith\("\/assets\/3d\/"\)/);
  assert.match(kingdom, /button\.style\.left=point\.left\.toFixed\(3\)/);
  assert.match(kingdom, /button\.style\.top=point\.top\.toFixed\(3\)/);
  assert.match(kingdom, /coi:kingdom-2d-fallback/);
});

test("state refresh preserves the WebGL, 2D and ambient scene DOM nodes", () => {
  assert.match(kingdom, /city\.querySelectorAll\(":scope > \.building"\)/);
  assert.match(kingdom, /city\.insertAdjacentHTML\("beforeend"/);
  assert.doesNotMatch(kingdom, /city\.innerHTML=buildings/);
  assert.doesNotMatch(kingdom, /city\.append\(kingdom3d\)/);
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
  assert.match(renderer, /const neededTypes = new Set/);
  assert.match(renderer, /Object\.hasOwn\(palettes, type\)/);
  assert.match(renderer, /neededTypes\.has\(asset\.type\)/);
  assert.match(renderer, /url\.origin !== window\.location\.origin/);
  assert.match(renderer, /url\.pathname\.startsWith\("\/assets\/3d\/"\)/);
  assert.match(renderer, /pathname\.toLowerCase\(\)\.endsWith\("\.glb"\)/);
  assert.match(renderer, /indisponível; mantendo o fallback procedural/);
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
  assert.match(renderer, /renderBuildings\(latestBuildings\);\s*renderManifestProps\(\);\s*renderKingdomTroops\(latestTroops\)/);
  assert.match(renderer, /function disposeDetachedObject3D\(root\)/);
});

test("GLTF ImageBitmap resources are explicitly closed with GPU textures", () => {
  assert.match(renderer, /resources\.imageBitmaps\.add\(bitmap\)/);
  assert.match(renderer, /for \(const bitmap of resources\.imageBitmaps\) bitmap\.close\(\)/);
  assert.match(renderer, /const resources = \{ geometries: new Set\(\), materials: new Set\(\), textures: new Set\(\), imageBitmaps: new Set\(\) \}/);
});


test("Data Saver avoids optional 3D downloads while preserving the procedural kingdom", () => {
  const profile = selectKingdomQualityProfile({ deviceMemory: 12, hardwareConcurrency: 12, viewportWidth: 1200, maxTextureSize: 16384, saveData: true });
  assert.equal(profile.tier, "low");
  assert.equal(profile.shadows, false);
  assert.equal(profile.loadOptionalAssets, false);
  assert.equal(profile.maxBuildings, 8);
  assert.match(renderer, /if \(!qualityProfile\?\.loadOptionalAssets \|\| disposed \|\| !renderer\) return/);
  assert.match(renderer, /dataSaver: !qualityProfile\.loadOptionalAssets/);
});

test("reduced-motion preference is detected without requiring optional browser APIs", () => {
  const reduced = selectKingdomQualityProfile({ prefersReducedMotion: true });
  const standard = selectKingdomQualityProfile({});
  assert.equal(reduced.prefersReducedMotion, true);
  assert.equal(standard.prefersReducedMotion, false);
  assert.match(renderer, /window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\?\.matches === true/);
});


test("partial WebGL initialization failure runs the complete GPU and listener teardown", () => {
  assert.match(renderer, /Initialization can fail after GPU resources or listeners were already created/);
  assert.match(renderer, /resizeObserver\?\.disconnect\(\)/);
  assert.match(renderer, /window\.removeEventListener\("coi:kingdom-render", kingdomRenderHandler\)/);
  assert.match(renderer, /disposeSceneResources\(\);[\s\S]*?ktx2\?\.dispose\(\)/);
  assert.match(renderer, /renderer\?\.domElement\.remove\(\);[\s\S]*?renderer\?\.dispose\(\)/);
  assert.match(renderer, /delete window\.__coiKingdomDiagnostics/);
  assert.match(renderer, /delete host\.dataset\.qualityTier/);
});


test("GLB assets are normalized to a mobile building footprint and grounded at y=0", () => {
  assert.ok(renderer.includes("targetFootprint = Math.max(.25, Math.min(3.5"));
  assert.ok(renderer.includes("targetHeight = Math.max(.25, Math.min(4.5"));
  assert.ok(renderer.includes("normalizedModel.scale.setScalar(uniformScale)"));
  assert.ok(renderer.includes("-sourceBounds.min.y * uniformScale"));
  assert.ok(renderer.includes("template.add(normalizedModel)"));
});


test("optional GLB assets load only for present building types with bounded concurrency", () => {
  assert.ok(renderer.includes("const neededTypes = new Set"));
  assert.ok(renderer.includes("glbLoadPromises.has(entry.key)"));
  assert.ok(renderer.includes("Math.min(3, queue.length)"));
  assert.ok(renderer.includes("loadOptionalGlbAssets(list, latestTroops)"));
  assert.ok(renderer.includes("loadOptionalGlbAssets(window.__coiKingdomBuildings, latestTroops)"));
  assert.ok(renderer.includes("manifestLoad = null"));
});

test("failed optional GLB downloads preserve procedural models and allow later retries", () => {
  assert.ok(renderer.includes("GLB assets not ready; procedural models remain active"));
  assert.ok(renderer.includes("glbLoadPromises.delete(key)"));
  assert.ok(renderer.includes("manifestLoad = null"));
});


test("a narrow Android viewport does not downgrade capable GPU hardware", () => {
  const high = selectKingdomQualityProfile({ deviceMemory: 8, hardwareConcurrency: 8, viewportWidth: 390, maxTextureSize: 8192 });
  const balanced = selectKingdomQualityProfile({ deviceMemory: 6, hardwareConcurrency: 6, viewportWidth: 390, maxTextureSize: 8192 });
  assert.equal(high.tier, "high");
  assert.equal(high.surfaceTextureSize, 512);
  assert.equal(balanced.tier, "balanced");
  assert.equal(balanced.surfaceTextureSize, 256);
});

test("procedural material texels scale from 128 to 256 and 512 without coarse high-tier grain", () => {
  const low = selectKingdomQualityProfile({ deviceMemory: 4, hardwareConcurrency: 4, viewportWidth: 390, maxTextureSize: 4096 });
  const balanced = selectKingdomQualityProfile({ deviceMemory: 6, hardwareConcurrency: 6, viewportWidth: 390, maxTextureSize: 8192 });
  const high = selectKingdomQualityProfile({ deviceMemory: 8, hardwareConcurrency: 8, viewportWidth: 390, maxTextureSize: 8192 });
  assert.equal(low.surfaceTextureSize, 128);
  assert.equal(balanced.surfaceTextureSize, 256);
  assert.equal(high.surfaceTextureSize, 512);
  assert.equal(low.pbrMaps, false);
  assert.equal(balanced.pbrMaps, true);
  assert.equal(high.pbrMaps, true);
  assert.match(renderer, /const textureSize = qualityProfile\?\.surfaceTextureSize \|\| 128/);
  assert.match(renderer, /ctx\.setTransform\(detailScale, 0, 0, detailScale, 0, 0\)/);
  assert.match(renderer, /const grainCount = Math\.round\(1200 \* detailScale \* detailScale\)/);
  assert.match(renderer, /ctx\.setTransform\(1, 0, 0, 1, 0, 0\)/);
  assert.match(renderer, /rand\(\) \* textureSize/);
});

test("the requestAnimationFrame sampler is bounded and reports callback intervals", () => {
  const sampler = createFrameTimingSampler(3);
  assert.deepEqual(sampler.snapshot(), { sampleCount: 0, p50Ms: null, p95Ms: null });
  sampler.record(16.67);
  sampler.record(20);
  sampler.record(33.33);
  sampler.record(10);
  sampler.record(-2);
  assert.deepEqual(sampler.snapshot(), { sampleCount: 3, p50Ms: 20, p95Ms: 33.33 });
  sampler.reset();
  assert.equal(sampler.snapshot().sampleCount, 0);
});

test("army and optional shader animation pause when hidden or outside the viewport", () => {
  assert.match(renderer, /function canRunArmyAnimation\(\)/);
  assert.match(renderer, /!document\.hidden && sceneInViewport/);
  assert.match(renderer, /new IntersectionObserver\(/);
  assert.match(renderer, /document\.addEventListener\("visibilitychange", visibilityChangeHandler\)/);
  assert.match(renderer, /sceneVisibilityObserver\?\.disconnect\(\)/);
  assert.match(renderer, /animationLoop: \{ active: Boolean\(animationFrame\)/);
  assert.match(renderer, /animationFrameTiming\.snapshot\(\)/);
});


test("procedural PBR material maps are attached and disposed as owned GPU resources", () => {
  assert.match(renderer, /import \{ derivePbrTextureData \} from "\.\/kingdom-materials\.js"/);
  assert.match(renderer, /textureSet\.normalMap = createLinearMap\(derived\.normalData\)/);
  assert.match(renderer, /textureSet\.roughnessMap = createLinearMap\(derived\.roughnessData\)/);
  assert.match(renderer, /mat\.normalMap = textureSet\.normalMap/);
  assert.match(renderer, /mat\.roughnessMap = textureSet\.roughnessMap/);
  assert.match(renderer, /for \(const textureSet of surfaceTextureCache\.values\(\)\)/);
  assert.match(renderer, /if \(texture\?\.isTexture\) resources\.textures\.add\(texture\)/);
  assert.match(renderer, /pbrMaps: qualityProfile\.pbrMaps/);
});


test("the city ambient layer is loaded and respects Android power and lifecycle preferences", async () => {
  const ambient = await readFile(new URL("../scripts/ambient-particles.js", import.meta.url), "utf8");
  assert.match(kingdom, /scripts\/ambient-particles\.js/);
  assert.match(ambient, /prefers-reduced-motion/);
  assert.match(ambient, /saveData/);
  assert.match(ambient, /navigator\.deviceMemory/);
  assert.match(ambient, /new IntersectionObserver/);
  assert.match(ambient, /document\.addEventListener\("visibilitychange"/);
  assert.match(ambient, /if \(event\.persisted\)/);
  assert.match(ambient, /setAttribute\("aria-hidden", "true"\)/);
  assert.doesNotMatch(ambient, /new THREE\.WebGLRenderer/);
  assert.match(ambient, /FRAME_INTERVAL_MS = 1000 \/ 30/);
  assert.match(ambient, /timestamp - lastFrame < FRAME_INTERVAL_MS/);
});
