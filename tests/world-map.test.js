import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../world.html", import.meta.url), "utf8");
const script = await readFile(new URL("../world-map.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("kingdom navigation opens the actual world map, not the combat arena", () => {
  assert.match(kingdom, /goMap.*location\\.href="\\/world\\.html"/);
  assert.doesNotMatch(kingdom, /goMap.*location\\.href="\\/arena\\.html"/);
});

test("world map page loads authenticated territory and march interface", () => {
  for (const marker of ['id="worldMap"', 'id="territoryDetails"', 'id="troops"', 'id="marches"', 'src="/world-map.js"']) assert.ok(html.includes(marker), "missing world map marker: " + marker);
});

test("territory actions submit intent and troop quantities to the server API", () => {
  for (const marker of ['request("/game/state")', 'request("/game/action"', 'type: "march"', 'targetId: territory.id', 'marchType, units', 'const defaultValue = 0', 'availableTypes.has(unitType)']) assert.ok(script.includes(marker), "missing march contract: " + marker);
  assert.match(script, /tier\\) === 1/);
});

test("world map renders untrusted territory labels with DOM text, not HTML injection", () => {
  assert.match(script, /textContent/);
  assert.match(script, /createElement/);
  assert.doesNotMatch(script, /innerHTML/);
});

test("PWA shell includes the world map and increments its cache version", () => {
  for (const marker of ['clash-of-izzy-shell-v2', '"/world.html"', '"/world-map.js"', '"/styles/coi-theme.css"']) assert.ok(serviceWorker.includes(marker), "missing cached asset: " + marker);
  assert.match(serviceWorker, /url\\.pathname\\.startsWith\\("\\/api\\/"\\)/);
});
