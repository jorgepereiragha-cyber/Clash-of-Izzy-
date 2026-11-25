import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { syncHeroSystems } from "../worker.js";

function fixture(){
 const sql=new DatabaseSync(":memory:");
 sql.exec(`
 CREATE TABLE heroes(kingdom_id INTEGER,hero_key TEXT,hero_name TEXT,level INTEGER,experience INTEGER,rarity TEXT,UNIQUE(kingdom_id,hero_key));
 CREATE TABLE hero_inventory(kingdom_id INTEGER,hero_key TEXT,rarity TEXT,level INTEGER,experience INTEGER,UNIQUE(kingdom_id,hero_key));
 CREATE TABLE valhalla_hero_catalog(hero_key TEXT PRIMARY KEY,hero_name TEXT,rarity TEXT);
 INSERT INTO heroes VALUES(1,'kael_sunwarden','Legacy name',3,140,'rare'),(1,'legacy','Legacy',7,30,'epic'),(2,'kael_sunwarden','Other kingdom',9,250,'rare');
 INSERT INTO hero_inventory VALUES(1,'kael_sunwarden','blue',4,10);
 `);
 const env={DB:{
  prepare(query){return {bind(...args){return {execute(){return sql.prepare(query).run(...args)}}}}},
  async batch(statements){sql.exec("BEGIN");try{const results=statements.map(s=>s.execute());sql.exec("COMMIT");return results}catch(e){sql.exec("ROLLBACK");throw e}}
 }};
 return {sql,env};
}
test("level-up XP remainder is authoritative, never restored from old equipment binding",async()=>{
 const {sql,env}=fixture();
 try{
  await syncHeroSystems(env,1);
  await syncHeroSystems(env,1);
  const inventory=sql.prepare("SELECT level,experience FROM hero_inventory WHERE kingdom_id=1 AND hero_key='kael_sunwarden'").get();
  const mirror=sql.prepare("SELECT level,experience,hero_name FROM heroes WHERE kingdom_id=1 AND hero_key='kael_sunwarden'").get();
  assert.deepEqual([inventory.level,inventory.experience],[4,10]);
  assert.deepEqual([mirror.level,mirror.experience,mirror.hero_name],[4,10,"Legacy name"]);
  assert.equal(sql.prepare("SELECT experience FROM heroes WHERE kingdom_id=2").get().experience,250);
  const imported=sql.prepare("SELECT level,experience,rarity FROM hero_inventory WHERE hero_key='legacy'").get();
  assert.deepEqual([imported.level,imported.experience,imported.rarity],[7,30,"purple"]);
 }finally{sql.close()}
});
test("inventory-only seasonal heroes retain catalog name and legacy rarity",async()=>{
 const {sql,env}=fixture();
 try{
  sql.exec("INSERT INTO valhalla_hero_catalog VALUES('seasonal','Seasonal hero','mythic'); INSERT INTO hero_inventory VALUES(1,'seasonal','gold',8,17)");
  await syncHeroSystems(env,1);
  const h=sql.prepare("SELECT hero_name,rarity,level,experience FROM heroes WHERE hero_key='seasonal'").get();
  assert.deepEqual([h.hero_name,h.rarity,h.level,h.experience],["Seasonal hero","mythic",8,17]);
 }finally{sql.close()}
});
