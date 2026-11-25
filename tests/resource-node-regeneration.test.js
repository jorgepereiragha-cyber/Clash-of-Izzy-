import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { handleRally } from "../rally.js";

test("node occupation and recall preserve accrued resources and return troops once", async () => {
 const db=new DatabaseSync(":memory:");
 try {
  db.exec(`
   CREATE TABLE players(id INTEGER PRIMARY KEY,player_id TEXT);
   CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,player_id INTEGER,castle_level INTEGER);
   CREATE TABLE kingdom_buildings(kingdom_id INTEGER,building_type TEXT,level INTEGER);
   CREATE TABLE research(kingdom_id INTEGER,research_key TEXT,level INTEGER);
   CREATE TABLE hero_inventory(kingdom_id INTEGER,hero_key TEXT,level INTEGER,stars INTEGER,rarity TEXT);
   CREATE TABLE heroes(kingdom_id INTEGER,hero_key TEXT,hero_name TEXT);
   CREATE TABLE army_units(kingdom_id INTEGER,unit_type TEXT,tier INTEGER,quantity INTEGER,UNIQUE(kingdom_id,unit_type,tier));
   CREATE TABLE resource_nodes(id TEXT PRIMARY KEY,occupied_by INTEGER,occupation_start INTEGER,garrison_json TEXT,reserved_by_rally TEXT,last_regen INTEGER,current_resources INTEGER,max_resources INTEGER,regen_rate INTEGER);
   CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT);
   INSERT INTO players VALUES(1,'player');
   INSERT INTO kingdoms VALUES(1,1,1);
   INSERT INTO army_units VALUES(1,'militia',1,20),(1,'archer',1,10);
   INSERT INTO resource_nodes VALUES('node_001',NULL,NULL,'{}',NULL,unixepoch()-3600,10,100,1);
  `);
  const adapter={prepare(sql){return {bind(...args){return {sql,args,
   async first(){return db.prepare(sql).get(...args)}}}}},async batch(statements){
   db.exec("BEGIN");try {
    const results=statements.map(s=>({meta:{changes:db.prepare(s.sql).run(...s.args).changes}}));
    db.exec("COMMIT");return results;
   }catch(e){db.exec("ROLLBACK");throw e;}
  }};
  const action=(path,body)=>handleRally({method:"POST"},{DB:adapter},"player",path,body);
  const node=()=>db.prepare("SELECT * FROM resource_nodes WHERE id='node_001'").get();
  const quantity=type=>db.prepare("SELECT quantity FROM army_units WHERE unit_type=?").get(type).quantity;
  const occupy=await action("occupy",{node_id:"node_001",troops:{militia:5,archer:3}});
  assert.equal(occupy.status,200);
  assert.equal(node().current_resources,11);
  assert.equal(quantity("militia"),15);
  assert.equal(quantity("archer"),7);
  db.exec("UPDATE resource_nodes SET last_regen=unixepoch()-3600");
  const recalls=await Promise.all([action("recall",{node_id:"node_001"}),action("recall",{node_id:"node_001"})]);
  assert.equal(recalls.filter(r=>r.status===200).length,1);
  assert.equal(node().current_resources,12);
  assert.equal(node().occupied_by,null);
  assert.equal(quantity("militia"),20);
  assert.equal(quantity("archer"),10);
  db.exec("UPDATE resource_nodes SET current_resources=99,last_regen=unixepoch()-7200");
  assert.equal((await action("occupy",{node_id:"node_001",troops:{militia:1}})).status,200);
  assert.equal(node().current_resources,100);
 } finally {db.close();}
});
