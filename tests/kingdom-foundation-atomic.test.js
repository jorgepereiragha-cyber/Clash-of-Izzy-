import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureKingdom } from "../worker.js";

function fixture() {
 const sql=new DatabaseSync(":memory:");
 sql.exec(`
 CREATE TABLE players(id INTEGER PRIMARY KEY,player_id TEXT UNIQUE,name TEXT,gems INTEGER);
 CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,player_id INTEGER UNIQUE,kingdom_name TEXT,food INTEGER,wood INTEGER,stone INTEGER,iron INTEGER,gold INTEGER,last_production_at TEXT,map_region INTEGER,map_slot INTEGER,map_x REAL,map_z REAL,castle_level INTEGER DEFAULT 1,wall_hp INTEGER DEFAULT 10000,food_capacity INTEGER,wood_capacity INTEGER,stone_capacity INTEGER,iron_capacity INTEGER,gold_capacity INTEGER,wall_max_hp INTEGER,defense_power INTEGER,prestige INTEGER DEFAULT 0,power INTEGER DEFAULT 0,UNIQUE(map_region,map_slot));
 CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT);
 CREATE TABLE kingdom_buildings(kingdom_id INTEGER,building_type TEXT,level INTEGER,position_x REAL,position_z REAL,UNIQUE(kingdom_id,building_type));
 CREATE TABLE army_units(kingdom_id INTEGER,unit_type TEXT,tier INTEGER,quantity INTEGER,UNIQUE(kingdom_id,unit_type,tier));
 CREATE TABLE heroes(kingdom_id INTEGER,hero_key TEXT,hero_name TEXT,rarity TEXT,level INTEGER DEFAULT 1);
 CREATE TABLE dragons(kingdom_id INTEGER UNIQUE,dragon_key TEXT,dragon_name TEXT,level INTEGER DEFAULT 1);
 CREATE TABLE kingdom_dragons(kingdom_id INTEGER,dragon_key TEXT,source TEXT);
 CREATE TABLE kingdom_mailbox(kingdom_id INTEGER,source_key TEXT,title TEXT,body TEXT,reward_key TEXT);
 CREATE TABLE kingdom_pets(kingdom_id INTEGER,pet_id TEXT,level INTEGER,experience INTEGER,is_active INTEGER);
 CREATE TABLE pet_catalog(id TEXT PRIMARY KEY,active INTEGER);
 INSERT INTO pet_catalog VALUES('pet_raven',1);
 CREATE TABLE realm_openings(realm_id INTEGER PRIMARY KEY,unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO realm_openings(realm_id) VALUES(1);
 CREATE TABLE world_territories(id INTEGER PRIMARY KEY,territory_key TEXT UNIQUE,name TEXT,terrain TEXT,x REAL,z REAL,owner_kingdom_id INTEGER,level INTEGER,resource_type TEXT,resource_rate INTEGER,territory_kind TEXT,map_region INTEGER,shield_until TEXT);
 CREATE TABLE realm_thrones(realm_id INTEGER PRIMARY KEY,territory_id INTEGER,shield_until TEXT);
 CREATE TABLE research(kingdom_id INTEGER,research_key TEXT,level INTEGER);
 `);
 let fail=false;
 const DB={
  prepare(query){return {bind(...args){return {
   async first(){return sql.prepare(query).get(...args)||null},
   async all(){return {results:sql.prepare(query).all(...args)}},
   async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},
   execute(){
    if(fail&&query.startsWith("INSERT INTO kingdom_mailbox"))throw Error("Injected foundation failure");
    if(query.startsWith("SELECT "))return {results:sql.prepare(query).all(...args)};
    return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}
   }
  }}}},
  async batch(statements){sql.exec("BEGIN");try{const results=statements.map(s=>s.execute());sql.exec("COMMIT");return results}catch(e){sql.exec("ROLLBACK");throw e}}
 };
 return {sql,env:{DB},fail:()=>{fail=true},recover:()=>{fail=false}};
}
const count=(sql,table)=>Number(sql.prepare("SELECT COUNT(*) AS n FROM "+table).get().n);

test("foundation interruption rolls back player, kingdom and starter assets",async()=>{
 const {sql,env,fail,recover}=fixture();
 try{
  fail();
  await assert.rejects(()=>ensureKingdom(env,"test_player"),/Injected foundation failure/);
  for(const table of ["players","kingdoms","kingdom_buildings","army_units","heroes","dragons","kingdom_mailbox","kingdom_events"])assert.equal(count(sql,table),0,table);
  recover();
  const id=await ensureKingdom(env,"test_player");
  assert.equal(count(sql,"kingdoms"),1);
  assert.equal(count(sql,"kingdom_buildings"),16);
  assert.equal(count(sql,"kingdom_mailbox"),1);
  assert.equal(count(sql,"kingdom_events"),0);
  assert.equal(sql.prepare("SELECT quantity FROM army_units WHERE kingdom_id=? AND unit_type='militia'").get(id).quantity,30);
 }finally{sql.close()}
});

test("repeated and concurrent foundation never restores spent balances or starter units",async()=>{
 const {sql,env}=fixture();
 try{
  const [a,b]=await Promise.all([ensureKingdom(env,"same"),ensureKingdom(env,"same")]);
  assert.equal(a,b);
  sql.exec("UPDATE players SET gems=0; UPDATE kingdoms SET wood=12; UPDATE army_units SET quantity=0; DELETE FROM kingdom_mailbox;");
  assert.equal(await ensureKingdom(env,"same"),a);
  assert.equal(sql.prepare("SELECT gems FROM players").get().gems,0);
  assert.equal(sql.prepare("SELECT wood FROM kingdoms").get().wood,12);
  assert.equal(sql.prepare("SELECT SUM(quantity) AS n FROM army_units").get().n,0);
  assert.equal(count(sql,"kingdom_mailbox"),0);
  assert.equal(count(sql,"kingdom_buildings"),16);
  const other=await ensureKingdom(env,"other");
  assert.notEqual(other,a);
  assert.equal(count(sql,"kingdoms"),2);
  assert.equal(sql.prepare("SELECT COUNT(DISTINCT map_slot) AS n FROM kingdoms").get().n,2);
 }finally{sql.close()}
});
