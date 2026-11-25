import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { handleRally } from "../rally.js";

function fixture(){
 const sql=new DatabaseSync(":memory:");
 sql.exec(`
 CREATE TABLE players(id INTEGER PRIMARY KEY,player_id TEXT);
 CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,player_id INTEGER,kingdom_name TEXT,castle_level INTEGER);
 CREATE TABLE kingdom_buildings(kingdom_id INTEGER,building_type TEXT,level INTEGER);
 CREATE TABLE research(kingdom_id INTEGER,research_key TEXT,level INTEGER);
 CREATE TABLE hero_inventory(kingdom_id INTEGER,hero_key TEXT,level INTEGER,stars INTEGER,rarity TEXT);
 CREATE TABLE heroes(kingdom_id INTEGER,hero_key TEXT,hero_name TEXT);
 CREATE TABLE alliance_members(kingdom_id INTEGER,alliance_id INTEGER);
 CREATE TABLE army_units(kingdom_id INTEGER,unit_type TEXT,tier INTEGER,quantity INTEGER,PRIMARY KEY(kingdom_id,unit_type,tier));
 CREATE TABLE rallies(id TEXT PRIMARY KEY,leader_kingdom_id INTEGER,alliance_id INTEGER,target_id TEXT,status TEXT,total_power INTEGER,departure_time INTEGER,arrival_time INTEGER,rally_duration INTEGER,created_at INTEGER);
 CREATE TABLE rally_reinforcements(id INTEGER PRIMARY KEY,rally_id TEXT,kingdom_id INTEGER,troop_data TEXT,power INTEGER,UNIQUE(rally_id,kingdom_id));
 CREATE TABLE resource_nodes(id TEXT PRIMARY KEY,node_type TEXT,level INTEGER);
 INSERT INTO players VALUES(1,'leader'),(2,'ally'),(3,'other');
 INSERT INTO kingdoms VALUES(10,1,'Leader',10),(20,2,'Ally',1),(30,3,'Other',1);
 INSERT INTO kingdom_buildings VALUES(10,'embassy',1);
 INSERT INTO alliance_members VALUES(10,1),(20,1),(30,1);
 INSERT INTO army_units VALUES(20,'militia',1,20),(30,'militia',1,20);
 INSERT INTO rallies VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',10,1,'node_001','gathering',39980,unixepoch()+300,unixepoch()+600,300,unixepoch());
 INSERT INTO rally_reinforcements(rally_id,kingdom_id,troop_data,power) VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',10,'{"militia":19990}',39980);
 INSERT INTO resource_nodes VALUES('node_001','mine',1);
 `);
 const db={prepare(q){return {bind(...args){return {async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},execute(){return {meta:{changes:Number(sql.prepare(q).run(...args).changes)}}}}}}},async batch(stmts){sql.exec("BEGIN");try{const res=stmts.map(s=>s.execute());sql.exec("COMMIT");return res}catch(e){sql.exec("ROLLBACK");throw e}}};
 const action=(player,route,body)=>handleRally({method:route==="active"?"GET":"POST"},{DB:db},player,route,body);
 const join=(player,n)=>action(player,"join",{rally_id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",troops:{militia:n}});
 return {sql,action,join};
}
test("concurrent rally joins cannot exceed the embassy capacity or debit rejected troops",async()=>{
 const {sql,action,join}=fixture();
 try{
  const before=await (await action("ally","active")).json();
  assert.equal(before.rallies[0].total_troops,19990);
  assert.equal(before.rallies[0].troop_capacity,20000);
  const results=await Promise.all([join("ally",10),join("other",10)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const after=await (await action("ally","active")).json();
  assert.equal(after.rallies[0].total_troops,20000);
  assert.equal(sql.prepare("SELECT SUM(quantity) AS n FROM army_units").get().n,30);
  sql.exec("UPDATE kingdom_buildings SET level=2 WHERE kingdom_id=10");
  const rejected=results[0].status===409?"ally":"other";
  assert.equal((await join(rejected,10)).status,200);
  assert.equal((await join(rejected,1)).status,409);
  const expanded=await (await action("ally","active")).json();
  assert.equal(expanded.rallies[0].troop_capacity,30000);
  assert.equal(expanded.rallies[0].total_troops,20010);
  sql.exec("UPDATE kingdom_buildings SET level=30 WHERE kingdom_id=10");
  assert.equal((await (await action("ally","active")).json()).rallies[0].troop_capacity,200000);
 }finally{sql.close()}
});
