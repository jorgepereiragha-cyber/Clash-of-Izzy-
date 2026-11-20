import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("castle skin selection is additive and reuses player_skins as the ownership source", async () => {
  const migration=await read("migrations/0027_castle_skin_equipment.sql");
  const worker=await read("worker.js");
  assert.ok(migration.includes("ALTER TABLE kingdoms ADD COLUMN equipped_skin_id INTEGER"));
  assert.ok(migration.includes("CREATE INDEX IF NOT EXISTS idx_kingdoms_equipped_skin"));
  assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM (players|kingdoms|skins|player_skins)/i);
  assert.ok(worker.includes("FROM player_skins ps JOIN skins s ON s.id=ps.skin_id WHERE ps.player_id=?"));
  assert.ok(worker.includes("EXISTS(SELECT 1 FROM player_skins WHERE player_id=? AND skin_id=?)"));
  assert.ok(worker.includes("castle_skin_equip"));
  assert.ok(worker.includes("castle_skin_unequipped"));
  assert.ok(worker.includes("Você não possui esta skin."));
});

test("equipped castle skins are returned and passed to the shared world map", async () => {
  const worker=await read("worker.js");
  assert.ok(worker.includes("castleSkins:castleSkins.results||[]"));
  assert.ok(worker.includes("owner.equipped_skin_id AS castle_skin_id"));
  assert.ok(worker.includes("equipped_skin_id"));
});

test("the kingdom city, world map and arena expose only skins owned by the current player", async () => {
  const html=await read("kingdom.html");
  const city=await read("scripts/kingdom-3d.js");
  const map=await read("world-map-3d.js");
  const arena=await read("arena.html");
  assert.ok(html.includes('id="castleSkins"'));
  assert.ok(html.includes("castle_skin_equip"));
  assert.ok(html.includes("castleSkinId:Number(k.equipped_skin_id||0)"));
  assert.ok(city.includes("castleSkinPalettes"));
  assert.ok(city.includes("latestCastleSkinId"));
  assert.ok(map.includes("territory.castle_skin_id"));
  assert.ok(map.includes("castleSkinMaterials"));
  assert.ok(arena.includes("kingdomSession.castleSkins"));
  assert.ok(arena.includes("type:'castle_skin_equip'"));
});

test("PWA shell cache is bumped for the updated city and world renderers", async () => {
  const sw=await read("sw.js");
  assert.ok(sw.includes('clash-of-izzy-shell-v39'));
});


test("owner castle appearance is carried into the center castle on the shared map", async () => {
  const world = await read("world-map.js");
  const renderer = await read("world-map-3d.js");
  assert.ok(world.includes("castleSkinId: Number(state.kingdom?.equipped_skin_id || 0)"));
  assert.ok(renderer.includes("worldState.castleSkinId"));
  assert.ok(renderer.includes("territory.castle_skin_id"));
});
