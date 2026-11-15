import test from "node:test";
import assert from "node:assert/strict";
import { clampMapViewport, mapViewportTransform, nextMapZoom } from "../world-map-viewport.js";
import { readFile } from "node:fs/promises";

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

test("world map presents an isometric 3D strategy view instead of a free-roaming arena hero", async () => {
  const scene = await readFile(new URL("../world-map-3d.js", import.meta.url), "utf8");
  for (const marker of ['id="world3d"', 'Mapa estratégico 3D', 'world-map-3d.js']) assert.ok(html.includes(marker), "missing 3D map presentation: " + marker);
  for (const marker of ['OrthographicCamera', 'createCastle', 'createTerritoryFeature', 'createMarchFormation', 'updateMarchPositions', 'projectTerritories']) assert.ok(scene.includes(marker), "missing strategic scene feature: " + marker);
  assert.ok(scene.includes('march.status === "marching"'));
  assert.ok(script.includes('window.__coiWorldMap3D.update(visualState)'));
});

test("territory actions submit intent and troop quantities to the server API", () => {
  for (const marker of ['request("/game/state")', 'request("/game/action"', 'type: "march"', 'targetId: territory.id', 'marchType, units', 'const defaultValue = 0', 'availableTypes.has(unitType)']) assert.ok(script.includes(marker), "missing march contract: " + marker);
  assert.ok(script.includes('Number(unit.tier) === 1'));
});

test("world map renders untrusted territory labels with DOM text, not HTML injection", () => {
  assert.ok(script.includes("textContent"));
  assert.ok(script.includes("createElement"));
  assert.ok(!script.includes("innerHTML"));
});

test("PWA shell includes the world map and increments its cache version", () => {
  for (const marker of ['clash-of-izzy-shell-v12', '"/world.html"', '"/world-map.js"', '"/world-map-3d.js"', '"/events.html"', '"/events.js"', '"/styles/coi-theme.css"']) assert.ok(serviceWorker.includes(marker), "missing cached asset: " + marker);
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
