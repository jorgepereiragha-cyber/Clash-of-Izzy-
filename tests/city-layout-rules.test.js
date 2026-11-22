import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CITY_FOOTPRINTS, cityLayoutConfig, validateCityPlacement, moveCityBuilding } from "../city-layout-rules.js";

const existing = [
  {building_type:"castle",position_x:-10.5,position_z:-7},
  {building_type:"farm",position_x:-3.5,position_z:-7},
  {building_type:"barracks",position_x:3.5,position_z:-7}
];

test("grid 50x50 accepts legacy half-tile positions without rewriting existing rows", () => {
  assert.deepEqual([cityLayoutConfig().min,cityLayoutConfig().max],[-25,25]);
  assert.equal(Object.keys(CITY_FOOTPRINTS).length,16);
  assert.equal(validateCityPlacement(existing,"farm",0,12),true);
  assert.equal(validateCityPlacement(existing,"farm",-25,-25),true);
  assert.equal(validateCityPlacement(existing,"castle",20,20),true);
  assert.equal(validateCityPlacement(existing,"castle",21,20),false);
  assert.equal(validateCityPlacement(existing,"castle",-26,0),false);
  assert.equal(validateCityPlacement(existing,"farm",1.5,2),false);
  assert.equal(validateCityPlacement(existing,"invalid",0,0),false);
  assert.equal(validateCityPlacement(existing,"farm",-9,-6),false);
  assert.equal(validateCityPlacement(existing,"farm",3,-7),false);
});

test("atomic SQL checks ownership, old position, bounds and server-side collision", async () => {
  let sql="", binds=[], changes=1;
  const env={DB:{prepare(query){sql=query;return {bind(...args){binds=args;return {async run(){return {meta:{changes}};}};}};}}};
  const good=await moveCityBuilding(env,51,{building:"farm",gridX:6,gridZ:7,fromX:-3.5,fromZ:-7});
  assert.equal(good.ok,true);
  assert.match(sql,/UPDATE kingdom_buildings SET position_x=\?,position_z=\?/);
  assert.match(sql,/WHERE kingdom_id=\? AND building_type=\? AND position_x=\? AND position_z=\?/);
  assert.match(sql,/NOT EXISTS \(SELECT 1 FROM kingdom_buildings other/);
  assert.match(sql,/CASE other.building_type/);
  assert.match(sql,/NOT EXISTS\(SELECT 1 FROM city_structures addition/);
  assert.deepEqual(binds.slice(0,8),[6,7,51,"farm",-3.5,-7,51,"farm"]);
  changes=0;
  assert.equal((await moveCityBuilding(env,51,{building:"farm",gridX:6,gridZ:7,fromX:-3.5,fromZ:-7})).status,409);
  assert.equal((await moveCityBuilding(env,51,{building:"castle",gridX:24,gridZ:0,fromX:0,fromZ:0})).status,400);
  assert.equal((await moveCityBuilding(env,51,{building:"castle",gridX:"1",gridZ:2,fromX:0,fromZ:0})).status,400);
  assert.equal((await moveCityBuilding(env,51,{building:"farm",gridX:1,gridZ:2,fromX:0})).status,400);
});

test("Worker uses existing schema and state includes authoritative grid contract", async () => {
  const worker=await readFile(new URL("../worker.js",import.meta.url),"utf8");
  assert.match(worker,/moveCityBuilding\(env,k\.id,body\)/);
  assert.match(worker,/cityLayout:cityLayoutConfig\(\)/);
  const sql=await readFile(new URL("../migrations\/0002_world.sql",import.meta.url),"utf8");
  assert.match(sql,/position_x REAL NOT NULL/);
  assert.match(sql,/position_z REAL NOT NULL/);
});
