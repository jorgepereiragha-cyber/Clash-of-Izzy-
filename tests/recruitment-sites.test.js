import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CITY_FOOTPRINTS } from "../city-layout-rules.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("altar and nest are visible in the city and link only to existing authenticated flows", async () => {
  const [city, equipment, styles] = await Promise.all([
    read("kingdom.html"), read("equipment-ui.html"), read("styles/city-layout.css")
  ]);
  assert.match(city, /<nav id="coiRecruitmentSites"[^>]*aria-label="Locais de recrutamento da cidade"/);
  assert.match(city, /id="coiSummonAltar"[^>]*href="\/equipment-ui\.html#hero-summon-title"/);
  assert.match(city, /id="coiDragonNest"[^>]*href="#coiDragonPanel"/);
  assert.match(equipment, /id="hero-summon-title">Convocar Heróis/);
  assert.match(city, /id="coiDragonPanel"/);
  assert.match(city, /id="dragonCollection"/);
  assert.match(styles, /\.coi-recruitment-site:focus-visible/);
  assert.match(styles, /@media\(max-width:650px\)/);
});

test("recruitment landmarks do not bypass the D1 building allowlist, economy or Master", async () => {
  const [city, worldSql, worker] = await Promise.all([
    read("kingdom.html"), read("migrations/0002_world.sql"), read("worker.js")
  ]);
  assert.equal(Object.keys(CITY_FOOTPRINTS).length, 16);
  assert.match(worldSql, /building_type TEXT NOT NULL CHECK \(building_type IN \('castle'/);
  assert.doesNotMatch(worldSql, /'summon_altar'|'dragon_nest'/);
  assert.match(city, /id="coiSummonAltar"/);
  assert.match(city, /id="coiDragonNest"/);
  assert.match(worker, /type==="dragon_unlock"/);
  assert.match(worker, /type==="hero_summon"/);
  assert.doesNotMatch(city, /type:"dragon_hatch"|type:"dragon_feed"|type:"hero_summon"/);
});
