import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("PWA manifest exposes only real routes and resolvable app icons", async () => {
  const manifest = JSON.parse(await read("manifest.json"));
  assert.equal(manifest.name, "Clash of Izzy");
  assert.equal(manifest.start_url, "/index.html");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "any");
  assert.deepEqual(
    (manifest.shortcuts || []).map(item => item.url),
    ["/kingdom.html", "/world.html", "/events.html"]
  );
  for (const icon of manifest.icons || []) {
    assert.ok(["192x192", "512x512"].includes(icon.sizes));
    assert.equal(icon.type, "image/svg+xml");
    await access(new URL("../" + icon.src.replace(/^\//, ""), import.meta.url));
  }
});

test("all primary game screens expose the same PWA manifest", async () => {
  for (const path of [
    "index.html", "kingdom.html", "world.html", "arena.html",
    "events.html", "alliance.html", "equipment-ui.html", "admin.html"
  ]) {
    const html = await read(path);
    assert.ok(html.includes('rel="manifest" href="/manifest.json"'), path + " missing manifest");
    assert.ok(html.includes('name="theme-color"'), path + " missing theme color");
    assert.ok(html.includes('/navigation.js'), path + " missing shared navigation and registration");
  }
});

test("PWA service worker keeps private APIs network-only and supplies offline navigation", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /clash-of-izzy-shell-v14/);
  assert.match(sw, /url\.origin!==self\.location\.origin\|\|url\.pathname\.startsWith\("\/api\/"\)\)return/);
  assert.match(sw, /request\.mode==="navigate"/);
  assert.match(sw, /caches\.match\("\/offline\.html"\)/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /self\.clients\.claim\(\)/);
  assert.match(sw, /\/navigation\.js/);
  assert.match(sw, /\/manifest\.json/);
  await access(new URL("../offline.html", import.meta.url));
});

test("shared navigation offers user-triggered install and does not request push permission automatically", async () => {
  const nav = await read("navigation.js");
  assert.match(nav, /beforeinstallprompt/);
  assert.match(nav, /promptEvent\.prompt\(\)/);
  assert.match(nav, /appinstalled/);
  assert.match(nav, /serviceWorker\.register\("\/sw\.js"/);
  assert.match(nav, /window\.addEventListener\("offline"/);
  assert.match(nav, /ações do reino exigem conexão/);
  assert.doesNotMatch(nav, /Notification\.requestPermission/);
  assert.doesNotMatch(nav, /pushManager\.subscribe/);
});

test("PWA shell precache references files that exist in the repository", async () => {
  const sw = await read("sw.js");
  const match = sw.match(/const CORE_ASSETS=\[(.*?)\];/s);
  assert.ok(match, "CORE_ASSETS missing");
  const assets = [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
  assert.ok(assets.length >= 20);
  for (const asset of assets) {
    if (asset === "/") continue;
    await access(new URL("../" + asset.replace(/^\//, ""), import.meta.url));
  }
});

test("local seed targets the authoritative D1 schema and never creates fake purchases", async () => {
  const seed = await read("scripts/seed-local.sql");
  for (const table of [
    "players", "kingdoms", "kingdom_buildings", "army_units", "heroes",
    "player_nicknames", "alliances", "alliance_members", "world_territories",
    "marches", "battle_reports", "research", "inventory_items", "kingdom_events"
  ]) assert.ok(seed.includes("INTO " + table), "seed table missing: " + table);

  for (const invalidOrDuplicate of [
    "INTO armies", "INTO buildings", "INTO battles", "INTO transactions",
    "INTO world_boss_event", "INTO boss_attacks", "INTO player_boss_energy",
    "INTO gem_packages", "INTO purchase_history", "INTO peace_shields"
  ]) assert.equal(seed.includes(invalidOrDuplicate), false, "duplicate schema detected: " + invalidOrDuplicate);

  assert.match(seed, /coi-local-seed-/);
  assert.match(seed, /TESTE/);
  assert.doesNotMatch(seed, /DELETE\s+FROM/i);
  assert.doesNotMatch(seed, /UPDATE\s+players\s+SET\s+gems/i);
  assert.doesNotMatch(seed, /status\s*,\s*created_at[^;]*approved/i);
});
