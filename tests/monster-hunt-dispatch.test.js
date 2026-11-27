import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
import {planMonsterDispatch,monsterDispatchStatements} from "../monster-hunt-dispatch.js";
const env={ENVIRONMENT:"beta",GAME_4X_SYSTEMS_ENABLED:"true"};
const fixture={env,kingdom:{id:1,map_region:1,castle_level:1},monster:{id:1,map_region:1,level:1,generation:1,hp:240,max_hp:240,respawn_at:0},units:{militia:5,archer:3},capacity:2400,now:1000,id:"hunt-000000000001"};
test("hunt dispatch validates server realm, unit names, quantities and capacity",()=>{
 const p=planMonsterDispatch(fixture);
 assert.equal(p.ok,true);assert.equal(p.energyAfter,110);assert.equal(p.slots,1);assert.equal(p.arrivesAt,1120);
 for(const units of [{militia:0},{militia:2.5},{unknown:1},{militia:2401},{}])assert.equal(planMonsterDispatch({...fixture,units}).ok,false);
 assert.equal(planMonsterDispatch({...fixture,env:{ENVIRONMENT:"production"}}).ok,false);
 assert.equal(planMonsterDispatch({...fixture,monster:{...fixture.monster,map_region:2}}).ok,false);
});
test("real SQLite batch debits troops and energy once, rejects stale state and rolls back on error",async()=>{
 const migrations=await Promise.all(["0048_world_monsters.sql","0049_monster_hunt_progress.sql","0050_monster_hunt_marches.sql"].map(n=>readFile(new URL("../migrations/"+n,import.meta.url),"utf8")));
 for(const mode of ["valid","stale-monster","foreign-realm","occupied-slot","missing-troop","stale-energy","duplicate-id","rollback"]){
  const sql=new DatabaseSync(":memory:");
  try{
   sql.exec("PRAGMA foreign_keys=ON; CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,map_region INTEGER); INSERT INTO kingdoms VALUES(1,1); CREATE TABLE army_units(kingdom_id INTEGER,tier INTEGER,unit_type TEXT,quantity INTEGER CHECK(quantity>=0),PRIMARY KEY(kingdom_id,tier,unit_type)); INSERT INTO army_units VALUES(1,1,'militia',10),(1,1,'archer',8); CREATE TABLE marches(kingdom_id INTEGER,status TEXT)");
   for(const migration of migrations)sql.exec(migration);
   const db={prepare(query){return{bind(...args){return{run:()=>sql.prepare(query).run(...args)}}}}};
   const p=planMonsterDispatch(fixture),batch=()=>{sql.exec("BEGIN");try{const result=monsterDispatchStatements(db,p).map(s=>Number(s.run().changes));sql.exec("COMMIT");return result;}catch(e){sql.exec("ROLLBACK");throw e;}};
   if(mode==="stale-monster")sql.exec("UPDATE world_monsters SET generation=2 WHERE id=1");
   if(mode==="foreign-realm")sql.exec("UPDATE kingdoms SET map_region=2");
   if(mode==="occupied-slot")sql.exec("INSERT INTO marches VALUES(1,'marching')");
   if(mode==="missing-troop")sql.exec("UPDATE army_units SET quantity=2 WHERE unit_type='archer'");
   if(mode==="stale-energy")sql.exec("INSERT INTO monster_hunt_progress(kingdom_id,energy,updated_at,revision) VALUES(1,100,1000,1)");
   if(mode==="duplicate-id")sql.exec("INSERT INTO monster_hunt_marches(id,kingdom_id,monster_id,monster_generation,units_json,energy_cost,started_at,arrives_at,status) VALUES('hunt-000000000001',1,1,1,'{}',10,900,999,'completed')");
   if(mode==="rollback")sql.exec("CREATE TRIGGER fail_energy BEFORE INSERT ON monster_hunt_progress BEGIN SELECT RAISE(ABORT,'forced failure'); END");
   const before=sql.prepare("SELECT quantity FROM army_units ORDER BY unit_type").all().map(r=>r.quantity);
   if(["duplicate-id","rollback"].includes(mode))assert.throws(batch);
   else if(mode==="valid"){assert.deepEqual(batch(),[1,2,1]);assert.deepEqual(batch(),[0,0,0]);}
   else assert.deepEqual(batch(),[0,0,0],mode);
   const after=sql.prepare("SELECT quantity FROM army_units ORDER BY unit_type").all().map(r=>r.quantity);
   assert.deepEqual(after,mode==="valid"?[5,5]:before,mode);
   assert.equal(sql.prepare("SELECT COUNT(*) n FROM monster_hunt_marches WHERE status='marching'").get().n,mode==="valid"?1:0,mode);
   const progress=sql.prepare("SELECT energy,revision FROM monster_hunt_progress WHERE kingdom_id=1").get();
   assert.equal(progress?.energy,mode==="valid"?110:mode==="stale-energy"?100:undefined,mode);
  }finally{sql.close();}
 }
});
