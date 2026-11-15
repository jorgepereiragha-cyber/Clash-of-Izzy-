import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../world.html", import.meta.url), "utf8");
const script = await readFile(new URL("../world-map.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("kingdom navigation opens the actual world map, not the combat arena", () => {
  assert.match(kingdom, /goMap.*location\.href="\/world\.html"/);
  assert.match(kingdom, /Mapa do Mundo.*\/world\.html/);
  assert.doesNotMatch(kingdom, /goMap.*location\.href="\/arena\.html"/);
});

test("world map page loads authenticated territory and march interface", () => {
  assert.match(html, /id="worldMap"/);
  assert.match(html, /id="territoryDetails"/);
  assert.match(html, /id="troops"/);
  assert.match(html, /id="marches"/);
  assert.match(html, /src="\/world-map\.js"/);
});

test("territory actions submit intent and troop quantities to the server API", () => {
  assert.match(script, /request\("\/game\/state"\)/);
  assert.match(script, /request\("\/game\/action"/);
  assert.match(script, /type: "march"/);
  assert.match(script, /targetId: territory\.id/);
  assert.match(script, /marchType, units/);
  assert.match(script, /tier\) === 1/);
  assert.match(script, /const defaultValue = 0/);
  assert.match(script, /availableTypes\.has\(unitType\)/);
});

test("world map renders untrusted territory labels with DOM text, not HTML injection", () => {
  assert.match(script, /textContent/);
  assert.match(script, /createElement/);
  assert.doesNotMatch(script, /innerHTML/);
});

test("PWA shell includes the world map and increments its cache version", () => {
  assert.match(serviceWorker, /clash-of-izzy-shell-v2/);
  assert.match(serviceWorker, /"\/world\.html"/);
  assert.match(serviceWorker, /"\/world-map\.js"/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
});
