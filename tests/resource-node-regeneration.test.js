import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { handleRally } from "../rally.js";

test("node occupation and recall preserve accrued resources and return troops once", async () => {
 const db=new DatabaseSync(":memory:");
 try {
  db.exec(`
   CREATE TABLE players(id INTEGER PRIMARY KEY,player_id TEXT);
   CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,player_id INTEGER,castle_level INTEGER,wood INTEGER DEFAULT 0,updated_at TEXT);
   CREATE TABLE kingdom_buildings(kingdom_id INTEGER,building_type TEXT,level INTEGER);
   CREATE TABLE research(kingdom_id INTEGER,research_key TEXT,level INTEGER);
   CREATE TABLE hero_inventory(kingdom_id INTEGER,hero_key TEXT,level INTEGER,stars INTEGER,rarity TEXT);
   CREATE TABLE heroes(kingdom_id INTEGER,hero_key TEXT,hero_name TEXT);
   CREATE TABLE army_units(kingdom_id INTEGER,unit_type TEXT,tier INTEGER,quantity INTEGER,UNIQUE(kingdom_id,unit_type,tier));
   CREATE TABLE resource_nodes(id TEXT PRIMARY KEY,occupied_by INTEGER,occupation_start INTEGER,garrison_json TEXT,reserved_by_rally TEXT,last_regen INTEGER,current_resources INTEGER,max_resources INTEGER,regen_rate INTEGER,node_type TEXT DEFAULT 'forest');
   CREATE TABLE resource_ledger(kingdom_id INTEGER,resource TEXT,amount INTEGER,reason TEXT);
   CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT);
   INSERT INTO players VALUES(1,'player');
   INSERT INTO kingdoms(id,player_id,castle_level) VALUES(1,1,1);
   INSERT INTO army_units VALUES(1,'militia',1,20),(1,'archer',1,10);
   INSERT INTO resource_nodes(id,occupied_by,occupation_start,garrison_json,reserved_by_rally,last_regen,current_resources,max_resources,regen_rate) VALUES('node_001',NULL,NULL,'{}',NULL,unixepoch()-3600,10,100,1);
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
  // A future timestamp must not move backwards on collection.
  db.exec("UPDATE resource_nodes SET last_regen=unixepoch()+3600");
  const future=node().last_regen;
  assert.equal((await action("collect",{node_id:"node_001"})).status,200);
  assert.equal(node().last_regen,future);
  assert.equal(node().current_resources,50);
  assert.equal(db.prepare("SELECT wood FROM kingdoms WHERE id=1").get().wood,50);
  assert.equal(db.prepare("SELECT SUM(amount) AS total FROM resource_ledger").get().total,50);
  // Reject corrupt or partially valid garrisons without clearing occupation or crediting troops.
  for(const malformed of ["{", "{}", JSON.stringify({militia:1,unknown:3})]){
   db.prepare("UPDATE resource_nodes SET garrison_json=?").run(malformed);
   const before=quantity("militia");
   assert.equal((await action("recall",{node_id:"node_001"})).status,409);
   assert.equal(node().occupied_by,1);
   assert.equal(node().garrison_json,malformed);
   assert.equal(quantity("militia"),before);
  }
  db.prepare("UPDATE resource_nodes SET garrison_json=?").run(JSON.stringify({militia:1}));
  assert.equal((await action("recall",{node_id:"node_001"})).status,200);
  assert.equal(quantity("militia"),20);
 } finally {db.close();}
});
