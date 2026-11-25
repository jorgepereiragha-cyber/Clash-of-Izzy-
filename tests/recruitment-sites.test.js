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
  assert.match(city, /state\?\.dragon\?\.level/);
  assert.match(city, /dragon\.bond/);
  assert.match(city, /upgrade\.dataset\.dragonUpgrade\s*=\s*["\x27]true["\x27]/);
  assert.match(city, /runKingdomPanelAction\(\{type:"dragon_upgrade",dragonKey:dragon\.key,expectedLevel:level\}/);
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
  assert.match(worker, /type==="dragon_upgrade"/);
  assert.match(worker, /bond\s*=\s*MIN\(\s*100\s*,\s*bond\s*\+\s*2\s*\)/);
  assert.match(city, /costs=\{food:250\*level,wood:150\*level,stone:100\*level,iron:25\*level\}/);
  assert.match(worker, /type==="hero_summon"/);
  assert.doesNotMatch(city, /type:"dragon_hatch"|type:"dragon_feed"|type:"hero_summon"/);
});

test("special structures are additive and collide atomically across all three placement paths",async()=>{
 const {SPECIAL_CITY_CATALOG,positionSpecialCityBuilding}=await import("../city-special-buildings.js");
 assert.deepEqual(Object.keys(SPECIAL_CITY_CATALOG),["dragon_nest","summon_altar"]);
 let sql="",changes=1;
 const env={DB:{prepare(s){sql=s;return {bind(){return {async run(){return {meta:{changes}}}}}}}}};
 const body={building:"dragon_nest",gridX:22,gridZ:22,fromX:null,fromZ:null};
 assert.equal((await positionSpecialCityBuilding(env,1,body)).ok,true);
 for(const table of ["kingdom_buildings","city_defenses","city_special_buildings"])assert.ok(sql.includes(table));
 assert.equal((await positionSpecialCityBuilding(env,1,{...body,gridX:23})).status,400);
 assert.equal((await positionSpecialCityBuilding(env,1,{...body,building:"__proto__"})).status,400);
 changes=0;assert.equal((await positionSpecialCityBuilding(env,1,body)).status,409);
 const [layout,defense,migration]=await Promise.all([read("city-layout-rules.js"),read("city-defense-rules.js"),read("migrations/0047_special_city_buildings.sql")]);
 assert.match(layout,/ATOMIC_MOVE_SQL\+defenseGuard\+specialGuard/);
 assert.match(defense,/SPECIAL_CITY_CLEAR/);
 assert.match(migration,/PRIMARY KEY\(kingdom_id,building_type\)/);
});
