import test from "node:test";
import assert from "node:assert/strict";
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
  for (const marker of ['clash-of-izzy-shell-v10', '"/world.html"', '"/world-map.js"', '"/events.html"', '"/events.js"', '"/styles/coi-theme.css"']) assert.ok(serviceWorker.includes(marker), "missing cached asset: " + marker);
  assert.ok(serviceWorker.includes('url.pathname.startsWith("/api/")'));
});


test("world map opens a territory selected from global search parameters", () => {
  assert.ok(script.includes('new URLSearchParams(location.search).get("search")'));
  assert.ok(script.includes("requestedTerritorySearch"));
  assert.ok(script.includes("requestedTerritoryApplied"));
});

test("mapa libera PvP somente contra reinos inimigos desprotegidos e confirma baixas permanentes", () => {
  assert.match(script, /function territoryIsProtected\(territory\)/);
  assert.match(script, /function territoryCanBeAttacked\(territory\)/);
  assert.match(script, /owner === "Território neutro"/);
  assert.match(script, /owner === "Outro reino"/);
  assert.match(script, /territory\.alliance_id/);
  assert.match(script, /territory\.protection_until/);
  assert.match(script, /territory\.shield_until/);
  assert.match(script, /Baixas são permanentes para ambos os lados/);
  assert.match(script, /if \(marchType === "attack" && territory\.owner_kingdom_id && !confirm\(/);
  assert.match(script, /Território de aliança/);
});
