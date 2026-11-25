import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {activateCastleShield,castleShieldsEnabled,castleShieldState,shieldActive} from "../castle-shield.js";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",id2="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function fixture(){
 const sql=new DatabaseSync(":memory:");
 sql.exec(`
 CREATE TABLE world_territories(territory_key TEXT PRIMARY KEY,owner_kingdom_id INTEGER,territory_kind TEXT,shield_until TEXT);
 CREATE TABLE shop_inventory(kingdom_id INTEGER,item_id TEXT,quantity INTEGER,PRIMARY KEY(kingdom_id,item_id));
 CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT);
 INSERT INTO world_territories VALUES('kingdom_castle_1',1,'castle',NULL),('kingdom_castle_2',2,'castle',NULL),('royal_throne_1',NULL,'resource',NULL);
 INSERT INTO shop_inventory VALUES(1,'shield_8h',2),(1,'shield_3d',1);
 `);
 let fail=false;
 const DB={prepare(q){return {bind(...args){return {async first(){return sql.prepare(q).get(...args)||null},execute(){if(fail&&q.startsWith("INSERT INTO kingdom_events"))throw Error("rollback");return {meta:{changes:Number(sql.prepare(q).run(...args).changes)}}}}}}},async batch(stmts){sql.exec("BEGIN");try{const out=stmts.map(s=>s.execute());sql.exec("COMMIT");return out}catch(e){sql.exec("ROLLBACK");throw e}}};
 const env={DB,ENVIRONMENT:"beta",CASTLE_PVP_ENABLED:"true",CASTLE_SHIELDS_ENABLED:"true"};
 return {sql,env,fail:()=>{fail=true}};
}
test("castle shields fail closed unless both features are enabled in beta",async()=>{
 assert.equal(castleShieldsEnabled({ENVIRONMENT:"production",CASTLE_PVP_ENABLED:"true",CASTLE_SHIELDS_ENABLED:"true"}),false);
 assert.equal((await activateCastleShield({ENVIRONMENT:"beta"},1,{})).status,409);
 assert.equal(shieldActive("invalid"),true);
 assert.equal(shieldActive(null),false);
 assert.equal(shieldActive("2026-01-01 00:00:00",Date.parse("2026-01-01T00:00:00Z")),false);
});
test("concurrent shield activation debits exactly once and never changes another castle or throne",async()=>{
 const {sql,env}=fixture();
 try{
  const results=await Promise.all([activateCastleShield(env,1,{itemId:"shield_8h",requestId:id}),activateCastleShield(env,1,{itemId:"shield_8h",requestId:id2})]);
  assert.deepEqual(results.map(r=>r.status||200).sort(),[200,409]);
  assert.equal(sql.prepare("SELECT quantity FROM shop_inventory WHERE item_id='shield_8h'").get().quantity,1);
  const view=await castleShieldState(env,1);
  assert.equal(view.active,true);
  assert.ok(Math.abs(Date.parse(view.until)-Date.now()-28800000)<5000);
  assert.equal((await castleShieldState(env,2)).until,null);
  assert.equal(sql.prepare("SELECT shield_until FROM world_territories WHERE territory_kind='resource'").get().shield_until,null);
  assert.equal((await activateCastleShield(env,1,{itemId:"shield_3d",requestId:id2})).status,409);
  const used=JSON.parse(sql.prepare("SELECT payload_json FROM kingdom_events").get().payload_json).requestId;
  sql.exec("UPDATE world_territories SET shield_until='2000-01-01' WHERE owner_kingdom_id=1");
  assert.equal((await activateCastleShield(env,1,{itemId:"shield_8h",requestId:used.toUpperCase()})).status,409);
  assert.equal((await activateCastleShield(env,1,{itemId:"shield_3d",requestId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"})).ok,true);
  assert.ok(Math.abs(Date.parse((await castleShieldState(env,1)).until)-Date.now()-259200000)<5000);
 }finally{sql.close()}
});
test("failed event recording rolls inventory and shield back",async()=>{
 const {sql,env,fail}=fixture();
 try{fail();await assert.rejects(()=>activateCastleShield(env,1,{itemId:"shield_8h",requestId:id}),/rollback/);
 assert.equal(sql.prepare("SELECT quantity FROM shop_inventory WHERE item_id='shield_8h'").get().quantity,2);
 assert.equal((await castleShieldState(env,1)).until,null);
 }finally{sql.close()}
});
