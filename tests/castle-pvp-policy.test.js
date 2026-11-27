import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { castlePvpEligibility,castlePvpAtomicGuard } from "../castle-pvp-policy.js";
function fixture(){
 const sql=new DatabaseSync(":memory:");
 sql.exec(`
 CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,map_region INTEGER);
 CREATE TABLE world_territories(id INTEGER PRIMARY KEY,territory_key TEXT,owner_kingdom_id INTEGER,territory_kind TEXT,map_region INTEGER,shield_until TEXT);
 CREATE TABLE alliance_members(kingdom_id INTEGER,alliance_id INTEGER);
 INSERT INTO kingdoms VALUES(1,1),(2,1),(3,2);
 INSERT INTO world_territories VALUES(11,'kingdom_castle_1',1,'castle',1,NULL),(22,'kingdom_castle_2',2,'castle',1,NULL),(33,'kingdom_castle_3',3,'castle',2,NULL),(44,'royal_throne_1',NULL,'resource',1,NULL),(55,'forged_castle',2,'castle',1,NULL);
 `);
 const env={ENVIRONMENT:"beta",CASTLE_PVP_ENABLED:"true",CASTLE_SHIELDS_ENABLED:"true",DB:{prepare(q){return {bind(...args){return {async first(){return sql.prepare(q).get(...args)||null}}}}}}};
 return {sql,env};
}
test("PvP eligibility rejects disabled or malformed requests before database access",async()=>{
 assert.equal((await castlePvpEligibility({ENVIRONMENT:"production",CASTLE_PVP_ENABLED:"true",CASTLE_SHIELDS_ENABLED:"true"},1,22)).code,"CASTLE_PVP_DISABLED");
 assert.equal((await castlePvpEligibility({ENVIRONMENT:"beta",CASTLE_PVP_ENABLED:"true",CASTLE_SHIELDS_ENABLED:"true"},1,"22")).status,400);
});
test("real castle ownership, realm, alliance and shield rules are server-authoritative",async()=>{
 const {sql,env}=fixture();
 const check=(target)=>castlePvpEligibility(env,1,target,Date.parse("2026-11-27T12:00:00Z"));
 try{
  assert.deepEqual(await check(22),{ok:true,attackerId:1,defenderId:2,territoryId:22,guardSnapshot:{attackerCastleId:11,region:1,attackerShield:null,defenderShield:null}});
  assert.equal((await check(11)).code,"SELF_ATTACK");
  assert.equal((await check(33)).code,"REALM_MISMATCH");
  for(const id of [44,55,99])assert.equal((await check(id)).code,"CASTLE_NOT_FOUND");
  sql.exec("INSERT INTO alliance_members VALUES(1,8),(2,8)");
  assert.equal((await check(22)).code,"ALLIED_CASTLE");
  sql.exec("DELETE FROM alliance_members; UPDATE world_territories SET shield_until='2026-11-28T00:00:00Z' WHERE id=22");
  assert.equal((await check(22)).code,"DEFENDER_SHIELDED");
  sql.exec("UPDATE world_territories SET shield_until='invalid' WHERE id=22");
  assert.equal((await check(22)).code,"DEFENDER_SHIELDED");
  sql.exec("UPDATE world_territories SET shield_until='2026-11-27 11:00:00' WHERE id=22; UPDATE world_territories SET shield_until='2026-11-28T00:00:00Z' WHERE id=11");
  assert.equal((await check(22)).code,"ATTACKER_SHIELDED");
  sql.exec("UPDATE world_territories SET shield_until=NULL WHERE id=11");
  assert.equal((await check(22)).ok,true);
  sql.exec("DELETE FROM world_territories WHERE id=11");
  assert.equal((await check(22)).code,"CASTLE_NOT_FOUND");
 }finally{sql.close()}
});


test("atomic PvP predicate rejects eligibility changes between preflight and troop debit",async()=>{
 const {sql,env}=fixture();
 try{
  sql.exec("CREATE TABLE army(kingdom_id INTEGER PRIMARY KEY,quantity INTEGER); INSERT INTO army VALUES(1,100)");
  const eligibility=await castlePvpEligibility(env,1,22);
  const guard=castlePvpAtomicGuard(env,eligibility);
  assert.notEqual(guard.sql,"0");
  const debit=()=>Number(sql.prepare("UPDATE army SET quantity=quantity-10 WHERE kingdom_id=1 AND "+guard.sql).run(...guard.args).changes);
  const qty=()=>sql.prepare("SELECT quantity FROM army").get().quantity;
  assert.equal(debit(),1);assert.equal(qty(),90);
  for(const mutation of [
   "INSERT INTO alliance_members VALUES(1,9),(2,9)",
   "UPDATE kingdoms SET map_region=2 WHERE id=1",
   "UPDATE kingdoms SET map_region=2 WHERE id=2",
   "UPDATE world_territories SET map_region=2 WHERE id=22",
   "UPDATE world_territories SET map_region=2 WHERE id=11",
   "UPDATE world_territories SET shield_until='2099-01-01T00:00:00Z' WHERE id=11",
   "UPDATE world_territories SET shield_until='invalid' WHERE id=22",
   "UPDATE world_territories SET shield_until='2000-01-01T00:00:00Z' WHERE id=22",
   "UPDATE world_territories SET owner_kingdom_id=3 WHERE id=22",
   "UPDATE world_territories SET territory_kind='resource' WHERE id=22",
   "UPDATE world_territories SET territory_key='forged' WHERE id=22",
   "DELETE FROM world_territories WHERE id=11",
   "DELETE FROM world_territories WHERE id=22"
  ]){
   sql.exec("SAVEPOINT stale");
   try{sql.exec(mutation);assert.equal(debit(),0,mutation);assert.equal(qty(),90,mutation)}
   finally{sql.exec("ROLLBACK TO stale; RELEASE stale")}
  }
  assert.equal(debit(),1);assert.equal(qty(),80);
  assert.equal(castlePvpAtomicGuard({...env,ENVIRONMENT:"production"},eligibility).sql,"0");
  assert.equal(castlePvpAtomicGuard(env,{ok:false}).sql,"0");
 }finally{sql.close()}
});
