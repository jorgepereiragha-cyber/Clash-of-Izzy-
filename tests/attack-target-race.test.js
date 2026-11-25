import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
const worker=readFileSync(new URL("../worker.js",import.meta.url),"utf8");
const match=worker.match(/statements\[0\]=env\.DB\.prepare\((".*?")\)\.bind\(resolvedAt,resolutionToken,m\.id,kingdomId,now,kingdomId,target\.id,target\.territory_key,target\.level\)/);
assert.ok(match,"transactional attack snapshot guard missing");
const query=JSON.parse(match[1]);
test("attack settlement rejects captured, moved, protected or changed targets",()=>{
 const db=new DatabaseSync(":memory:");
 try{
  db.exec(`
   CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,map_region INTEGER);
   CREATE TABLE world_territories(id INTEGER PRIMARY KEY,map_region INTEGER,owner_kingdom_id INTEGER,territory_kind TEXT,territory_key TEXT,level INTEGER);
   CREATE TABLE marches(id INTEGER PRIMARY KEY,kingdom_id INTEGER,status TEXT,arrives_at TEXT,resolved_at TEXT,resolution_token TEXT);
   INSERT INTO kingdoms VALUES(1,1);
   INSERT INTO world_territories VALUES(8,1,NULL,'resource','forest_east',5);
   INSERT INTO marches VALUES(9,1,'marching','2026-01-01',NULL,NULL);
  `);
  const resolve=()=>Number(db.prepare(query).run("2026-01-03","token",9,1,"2026-01-03",1,8,"forest_east",5).changes);
  const reset=()=>db.exec("UPDATE world_territories SET owner_kingdom_id=NULL,map_region=1,territory_kind='resource',territory_key='forest_east',level=5");
  for(const mutation of ["owner_kingdom_id=2","map_region=2","territory_kind='castle'","territory_key='royal_throne_1'","level=6"]){
   reset();db.exec("UPDATE world_territories SET "+mutation);
   assert.equal(resolve(),0,mutation);
   assert.equal(db.prepare("SELECT status FROM marches").get().status,"marching");
   assert.equal(db.prepare("SELECT resolution_token FROM marches").get().resolution_token,null);
  }
  reset();assert.equal(resolve(),1);assert.equal(resolve(),0);
  assert.equal(db.prepare("SELECT resolution_token FROM marches").get().resolution_token,"token");
 }finally{db.close()}
});
test("stale resolution uses existing token guards and occupied targets return their full army",()=>{
 assert.match(worker,/EXISTS\(SELECT 1 FROM marches WHERE id=\? AND kingdom_id=\? AND status='completed' AND resolution_token=\?\)/);
 assert.match(worker,/for\(const u of army\)survivors\[u\.unit_type\]=u\.quantity/);
});
