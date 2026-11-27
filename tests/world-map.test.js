import test from "node:test";
import assert from "node:assert/strict";
import { clampMapViewport, mapViewportTransform, nextMapZoom } from "../world-map-viewport.js";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const html = await readFile(new URL("../world.html", import.meta.url), "utf8");
const script = await readFile(new URL("../world-map.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("kingdom navigation opens the actual world map, not the combat arena", () => {
  assert.ok(kingdom.includes('document.getElementById("goMap").addEventListener("click",()=>location.href="/world.html")'));
  assert.ok(!kingdom.includes('document.getElementById("goMap").addEventListener("click",()=>location.href="/arena.html")'));
});

test("world map page loads authenticated territory and march interface", () => {
  for (const marker of ['id="worldMap"', 'id="territoryDetails"', 'id="troops"', 'id="marches"', 'src="/world-map.js"']) assert.ok(html.includes(marker), "missing world map marker: " + marker);
});

test("world map handles inaccessible browser storage before importing world state", () => {
  const start = script.indexOf("function readWorldSession()");
  const check = script.indexOf("const RESOURCE", start);
  assert.ok(start > 0 && check > start);
  const storage = script.slice(start, check);
  assert.ok(storage.includes("() => window.localStorage"));
  assert.ok(storage.includes("() => window.sessionStorage"));
  assert.ok(storage.includes("return { token: \"\", blocked: !readable }"));
  assert.ok(script.includes('if (!token && checked.blocked) { showWorldSessionRecovery(); return; }'));
  assert.ok(script.includes('retry.id = "retryWorldSession"'));
  assert.ok(script.includes('link.href = "/account.html"'));
  assert.ok(script.includes("error.status = response.status;"), "preserve error status to display account recovery");
  assert.ok(script.includes('if (error.status === 401 || error.status === 403)'));

});

test("world map presents an isometric 3D strategy view instead of a free-roaming arena hero", async () => {
  const scene = await readFile(new URL("../world-map-3d.js", import.meta.url), "utf8");
  for (const marker of ['id="world3d"', 'Mapa estratégico 3D', 'world-map-visual-boot.js']) assert.ok(html.includes(marker), "missing 3D map presentation: " + marker);
  for (const marker of ['OrthographicCamera', 'createCastle', 'createTerritoryFeature', 'createMarchFormation', 'updateMarchPositions', 'projectTerritories']) assert.ok(scene.includes(marker), "missing strategic scene feature: " + marker);
  assert.ok(scene.includes('march.status === "marching"'));
  assert.ok(script.includes('window.__coiWorldMap3D.update(visualState)'));
});

test("strategic 3D world map and territory controls parse before deployment", () => {
  for (const file of ["../world-map.js", "../world-map-3d.js", "../scripts/world-map-visual-boot.js"]) {
    const target = fileURLToPath(new URL(file, import.meta.url));
    const result = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout || ("Syntax check failed: " + file));
  }
});

test("territory actions submit intent and troop quantities to the server API", () => {
  for (const marker of ['request("/game/state")', 'request("/game/action"', 'type: "march"', 'targetId: target.id', 'marchType, units', 'selectedUnits[type] || 0', 'availableTypes.has(unitType)']) assert.ok(script.includes(marker), "missing march contract: " + marker);
  assert.ok(script.includes('Number(unit.tier) === 1'));
});

test("world map renders untrusted territory labels with DOM text, not HTML injection", () => {
  assert.ok(script.includes("textContent"));
  assert.ok(script.includes("createElement"));
  assert.ok(!script.includes("innerHTML"));
});

test("PWA shell includes the world map and increments its cache version", () => {
  for (const marker of ['"/styles/landing.css"', '"/landing.js"', '"/world.html"', '"/world-map.js"', '"/world-map-3d.js"', '"/events.html"', '"/events.js"', '"/styles/coi-theme.css"', '"/admin.html"', '"/valhalla-admin-ui.js"', '"/styles/valhalla-admin.css"', '"/valhalla-shop-ui.js"', '"/styles/valhalla-shop.css"']) assert.ok(serviceWorker.includes(marker), "missing cached asset: " + marker);
  const cacheVersion = Number(serviceWorker.match(/const CACHE_NAME="clash-of-izzy-shell-v(\d+)"/)?.[1] || 0);
  assert.ok(cacheVersion > 40, `expected Service Worker cache version above v40, got v${cacheVersion || "missing"}`);
  assert.ok(serviceWorker.includes('url.pathname.startsWith("/api/")'));
});


test("world map opens a territory selected from global search parameters", () => {
  assert.ok(script.includes('new URLSearchParams(location.search).get("search")'));
  assert.ok(script.includes("requestedTerritorySearch"));
  assert.ok(script.includes("requestedTerritoryApplied"));
});


test("world map exposes pan and zoom controls without enabling PvP", () => {
  for (const marker of [
    'id="zoomIn"', 'id="zoomOut"', 'id="mapReset"', 'id="mapScale"',
    'id="mapContent"', 'class="map-controls"', 'Arraste para explorar',
  ]) assert.ok(html.includes(marker), "missing map navigation marker: " + marker);
  for (const marker of [
    'import { clampMapViewport, mapViewportTransform, nextMapZoom }',
    'setPointerCapture(event.pointerId)', 'pointermove', 'pointerup',
    'addEventListener("wheel"', 'changeMapZoom(0.25)', 'resetMapViewport()',
  ]) assert.ok(script.includes(marker), "missing map navigation behavior: " + marker);
  assert.ok(script.includes('Boolean(territory.owner_kingdom_id)'));
  assert.ok(script.includes('request("/game/action"'));
});

test("map zoom stays inside supported bounds and keeps pan within visible map edges", () => {
  assert.equal(nextMapZoom(1, -0.5), 1);
  assert.equal(nextMapZoom(1, 0.25), 1.25);
  assert.equal(nextMapZoom(2.9, 0.5), 3);
  assert.deepEqual(clampMapViewport({
    zoom: 2, panX: 900, panY: -800, width: 400, height: 300,
  }), { zoom: 2, panX: 200, panY: -150 });
  assert.deepEqual(clampMapViewport({
    zoom: 1, panX: 100, panY: -100, width: 400, height: 300,
  }), { zoom: 1, panX: 0, panY: 0 });
});

test("map viewport transform is finite and deterministic", () => {
  assert.equal(
    mapViewportTransform({ zoom: 1.5, panX: 22.222, panY: -9.999 }),
    "translate3d(22.22px, -10px, 0) scale(1.5)"
  );
  assert.equal(
    mapViewportTransform({ zoom: Number.NaN, panX: Number.POSITIVE_INFINITY }),
    "translate3d(0px, 0px, 0) scale(1)"
  );
});


test("shared world map applies the local player's equipped skin to the central castle", async () => {
  const scene = await readFile(new URL("../world-map-3d.js", import.meta.url), "utf8");
  assert.ok(script.includes("castleSkinId: Number(state.kingdom?.equipped_skin_id || 0)"));
  assert.match(scene, /homeCastleGroup=createCastle\(terrainRoot,[^\n]+Number\(worldState.castleSkinId\)\|\|0,worldState.castleLevel\)/);
  assert.ok(scene.includes("Number(window.__coiWorldMapState?.castleSkinId)||0"));
});


test("3D world-map marches pause when the app is hidden or the map leaves the viewport", async () => {
  const scene = await readFile(new URL("../world-map-3d.js", import.meta.url), "utf8");
  assert.ok(scene.includes("function canAnimateMarches()"));
  assert.ok(scene.includes("!document.hidden && sceneInViewport"));
  assert.ok(scene.includes("new IntersectionObserver"));
  assert.ok(scene.includes('document.addEventListener("visibilitychange", visibilityChangeHandler)'));
  assert.ok(scene.includes("sceneVisibilityObserver?.disconnect()"));
  assert.ok(scene.includes("function stopMarchAnimation()"));
  assert.ok(scene.includes("contextLost = true"));
});

test("world-map renderer caps drawing-buffer pixels and restores from Android back/forward cache", async () => {
  const scene = await readFile(new URL("../world-map-3d.js", import.meta.url), "utf8");
  assert.ok(scene.includes("pixelBudgetRatio"));
  assert.ok(scene.includes("window.addEventListener(\"pageshow\""));
  assert.ok(scene.includes("if (!event.persisted) dispose()"));
  assert.ok(scene.includes("syncMarchAnimation()"));
});

test("map forest instancing minimizes WebGL draw calls without changing territory state", async () => {
  const scene = await readFile(new URL("../world-map-3d.js", import.meta.url), "utf8");
  assert.match(scene, /function addInstancedForest\(parent, positions\)/);
  assert.match(scene, /new THREE\.InstancedMesh\(trunkGeo/);
  assert.match(scene, /new THREE\.InstancedMesh\(crownGeo/);
  assert.match(scene, /batch\.instanceMatrix\.needsUpdate = true/);
  assert.match(scene, /addInstancedForest\(terrainRoot, forestPositions\)/);
  assert.match(scene, /quality === "low" \? 38 : quality === "high" \? 105 : 68/);
  assert.doesNotMatch(scene, /addTree\(terrainRoot/);
  assert.match(scene, /for \(const geometry of geometries\) geometry\.dispose\(\)/);
});

test("tactical world fits distant castles without collapsing markers at the map edge",async()=>{
 const {tacticalWorldBounds,tacticalWorldPoint}=await import("../world-map-viewport.js");
 const home={x:-50,z:350};
 const locations=[{x:45,z:355},{x:45,z:360},{x:-12,z:24},{x:0,z:0}];
 const bounds=tacticalWorldBounds(home,locations);
 for(const p of [home,...locations]){
  const projected=tacticalWorldPoint(p.x,p.z,bounds);
  assert.ok(projected.left>0&&projected.left<100&&projected.top>0&&projected.top<100);
 }
 assert.notDeepEqual(tacticalWorldPoint(45,355,bounds),tacticalWorldPoint(45,360,bounds));
 assert.ok(tacticalWorldPoint(45,360,bounds).top<tacticalWorldPoint(45,355,bounds).top);
 assert.equal(tacticalWorldPoint(NaN,0,bounds),null);
 assert.deepEqual(tacticalWorldBounds(null),{minX:-56,maxX:56,minZ:-56,maxZ:56});
});

test("expanded 3D footprint fits distant castles with a fixed geometry budget",async()=>{
 const {worldSceneBounds,worldSceneFrame}=await import("../world-map-viewport.js");
 const home={x:-50,z:350},targets=[{x:45,z:360},{x:0,z:0}];
 const b=worldSceneBounds(home,targets);
 for(const p of [home,...targets]){
  assert.ok(b.minX<p.x&&p.x<b.maxX&&b.minZ<p.z&&p.z<b.maxZ);
 }
 assert.deepEqual(worldSceneBounds({...home,z:351},targets),b);
 for(const aspect of [.6,1,2]){
  const f=worldSceneFrame(b,aspect);
  assert.ok(f.viewWidth>=Math.hypot(f.width,f.depth));
  assert.ok(f.viewHeight>=Math.hypot(f.width,f.depth)*.9);
  assert.ok(f.segmentsX<=96&&f.segmentsZ<=96);
  assert.ok(f.distanceScale>1);
 }
 const scene=await read("world-map-3d.js");
 assert.match(scene,/groundMesh\.geometry\.dispose\(\)/);
 assert.match(scene,/waterMesh\.geometry\.dispose\(\)/);
 assert.match(scene,/if\(footprintChanged\)\{loadedBounds=nextBounds;updateGround/);
});
