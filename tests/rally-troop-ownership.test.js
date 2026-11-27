import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { detachedTroops, handleRally, processDueRallies } from "../rally.js";

function fixture(occupied = null) {
 const sql = new DatabaseSync(":memory:");
 sql.exec(`
 CREATE TABLE players(id INTEGER PRIMARY KEY,player_id TEXT);
 CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,player_id INTEGER);
 CREATE TABLE army_units(kingdom_id INTEGER,unit_type TEXT,tier INTEGER,quantity INTEGER,PRIMARY KEY(kingdom_id,unit_type,tier));
 CREATE TABLE resource_nodes(id TEXT PRIMARY KEY,occupied_by INTEGER,occupation_start INTEGER,garrison_json TEXT,reserved_by_rally TEXT,last_regen INTEGER,current_resources INTEGER,max_resources INTEGER,regen_rate INTEGER);
 CREATE TABLE rallies(id TEXT PRIMARY KEY,leader_kingdom_id INTEGER,target_id TEXT,status TEXT,departure_time INTEGER,arrival_time INTEGER);
 CREATE TABLE rally_reinforcements(id INTEGER PRIMARY KEY,rally_id TEXT,kingdom_id INTEGER,troop_data TEXT);
 INSERT INTO players VALUES(1,'leader'),(2,'ally');
 INSERT INTO kingdoms VALUES(10,1),(20,2);
 INSERT INTO army_units VALUES(10,'militia',1,3),(20,'militia',1,4);
 INSERT INTO rallies VALUES('r1',10,'node_001','marching',0,0);
 INSERT INTO rally_reinforcements VALUES(1,'r1',10,'{"militia":7,"archer":2}'),(2,'r1',20,'{"militia":11}');
 INSERT INTO resource_nodes VALUES('node_001',NULL,NULL,'{}','r1',unixepoch()-3600,10,100,1);
 `);
 if(occupied!==null)sql.prepare("UPDATE resource_nodes SET occupied_by=?").run(occupied);
 let failPrefix=null;
 const db={
  prepare(query){return {bind(...args){return {
   async first(){return sql.prepare(query).get(...args)||null},
   async all(){return {results:sql.prepare(query).all(...args)}},
   async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},
   execute(){if(failPrefix&&query.startsWith(failPrefix))throw Error("Injected failure");return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}
  }}}},
  async batch(statements){sql.exec("BEGIN");try{const r=statements.map(s=>s.execute());sql.exec("COMMIT");return r}catch(e){sql.exec("ROLLBACK");throw e}}
 };
 return {sql,env:{DB:db},fail:(prefix="UPDATE rallies SET status='completed'")=>{failPrefix=prefix},recover:()=>{failPrefix=null}};
}
const recall = env => handleRally(new Request("https://test.example/recall",{method:"POST"}),env,"leader","recall",{node_id:"node_001"});
function army(sql){return sql.prepare("SELECT kingdom_id,unit_type,quantity FROM army_units ORDER BY kingdom_id,unit_type").all().map(r=>[r.kingdom_id,r.unit_type,r.quantity])}

test("rally settlement preserves ownership, capacity and exactly-once recall", async()=>{
 const {sql,env}=fixture();
 try{
  assert.equal(await detachedTroops(env,10),9);
  assert.equal(await detachedTroops(env,20),11);
  await processDueRallies(env);
  await processDueRallies(env);
  assert.equal(sql.prepare("SELECT status FROM rallies").get().status,"completed");
  assert.equal(await detachedTroops(env,10),9);
  assert.equal(await detachedTroops(env,20),11);
  assert.equal(sql.prepare("SELECT current_resources FROM resource_nodes").get().current_resources,11);
  sql.exec("UPDATE resource_nodes SET last_regen=unixepoch()-3600");
  const result=await recall(env);
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.returned,9);
  assert.equal(body.returned_allies,11);
  assert.equal(sql.prepare("SELECT current_resources FROM resource_nodes").get().current_resources,12);
  assert.equal((await recall(env)).status,404);
  assert.deepEqual(army(sql),[[10,"archer",2],[10,"militia",10],[20,"militia",15]]);
  assert.equal(await detachedTroops(env,10),0);
  assert.equal(await detachedTroops(env,20),0);
 }finally{sql.close()}
});

test("failed settlement rolls back node and rally then retries safely",async()=>{
 const {sql,env,fail,recover}=fixture();
 try{
  fail();
  await processDueRallies(env);
  assert.equal(sql.prepare("SELECT occupied_by FROM resource_nodes").get().occupied_by,null);
  assert.equal(sql.prepare("SELECT status FROM rallies").get().status,"marching");
  recover();
  await processDueRallies(env);
  assert.equal(sql.prepare("SELECT status FROM rallies").get().status,"completed");
 }finally{sql.close()}
});

test("failed capture with known reservation returns reinforcements once",async()=>{
 const {sql,env}=fixture(99);
 try{
  await processDueRallies(env);
  await processDueRallies(env);
  assert.equal(sql.prepare("SELECT status FROM rallies").get().status,"cancelled");
  assert.equal(sql.prepare("SELECT reserved_by_rally FROM resource_nodes").get().reserved_by_rally,null);
  assert.deepEqual(army(sql),[[10,"archer",2],[10,"militia",10],[20,"militia",15]]);
 }finally{sql.close()}
});

test("legacy mixed garrison is not incorrectly transferred to the leader",async()=>{
 const {sql,env}=fixture(10);
 try{
  sql.exec("UPDATE resource_nodes SET reserved_by_rally=NULL,garrison_json='{\"militia\":18}'");
  assert.equal((await recall(env)).status,409);
  assert.deepEqual(army(sql),[[10,"militia",3],[20,"militia",4]]);
  await processDueRallies(env);
  assert.equal(sql.prepare("SELECT status FROM rallies").get().status,"marching");
 }finally{sql.close()}
});

 test("rally regeneration caps resources and never rewinds a future clock",async()=>{
 const {sql,env}=fixture();
 try{
  sql.exec("UPDATE resource_nodes SET current_resources=99,last_regen=unixepoch()-7200");
  await processDueRallies(env);
  assert.equal(sql.prepare("SELECT current_resources FROM resource_nodes").get().current_resources,100);
  sql.exec("UPDATE resource_nodes SET current_resources=40,last_regen=unixepoch()+7200");
  const before=sql.prepare("SELECT last_regen FROM resource_nodes").get().last_regen;
  assert.equal((await recall(env)).status,200);
  const after=sql.prepare("SELECT current_resources,last_regen FROM resource_nodes").get();
  assert.equal(after.current_resources,40);
  assert.equal(after.last_regen,before);
 }finally{sql.close()}
});

function enableHarvestFixture(sql,env){
 sql.exec("ALTER TABLE kingdoms ADD COLUMN food INTEGER NOT NULL DEFAULT 0; ALTER TABLE kingdoms ADD COLUMN updated_at TEXT; ALTER TABLE resource_nodes ADD COLUMN node_type TEXT DEFAULT 'farm'; CREATE TABLE resource_ledger(kingdom_id INTEGER,resource TEXT,amount INTEGER,reason TEXT);");
 env.ENVIRONMENT="beta";env.BETA_GATHERING_5M_ENABLED="true";
}
const collectReturn=env=>handleRally(new Request("https://test.example/collect-return",{method:"POST"}),env,"leader","collect-return",{node_id:"node_001"});
test("atomic harvest and return restores every ally once and rolls back on ledger failure",async()=>{
 const {sql,env,fail,recover}=fixture();
 try{
  enableHarvestFixture(sql,env);
  await processDueRallies(env);
  sql.exec("UPDATE resource_nodes SET current_resources=80,last_regen=unixepoch()");
  const snapshot=sql.prepare("SELECT * FROM resource_nodes").get();
  fail("INSERT INTO resource_ledger");
  assert.equal((await collectReturn(env)).status,500);
  assert.deepEqual(sql.prepare("SELECT * FROM resource_nodes").get(),snapshot);
  assert.equal(sql.prepare("SELECT food FROM kingdoms WHERE id=10").get().food,0);
  assert.deepEqual(army(sql),[[10,"militia",3],[20,"militia",4]]);
  recover();
  const attempts=await Promise.all([collectReturn(env),collectReturn(env)]);
  assert.equal(attempts.filter(r=>r.status===200).length,1);
  const receipt=await attempts.find(r=>r.status===200).json();
  assert.equal(receipt.collected,5000000);
  assert.equal(receipt.returned,9);
  assert.equal(receipt.returned_allies,11);
  assert.equal(sql.prepare("SELECT food FROM kingdoms WHERE id=10").get().food,5000000);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM resource_ledger").get().n,1);
  assert.equal(sql.prepare("SELECT occupied_by FROM resource_nodes").get().occupied_by,null);
  assert.deepEqual(army(sql),[[10,"archer",2],[10,"militia",10],[20,"militia",15]]);
 }finally{sql.close()}
});
test("collection and return remains disabled outside beta even with flag enabled",async()=>{
 const {sql,env}=fixture();
 try{
  enableHarvestFixture(sql,env);
  env.ENVIRONMENT="production";
  await processDueRallies(env);
  sql.exec("UPDATE resource_nodes SET current_resources=100,last_regen=unixepoch()");
  assert.equal((await collectReturn(env)).status,404);
  assert.equal(sql.prepare("SELECT food FROM kingdoms WHERE id=10").get().food,0);
  assert.equal(sql.prepare("SELECT occupied_by FROM resource_nodes").get().occupied_by,10);
 }finally{sql.close()}
});
