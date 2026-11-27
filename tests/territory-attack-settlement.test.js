import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {guardTerritoryAttackSettlement} from "../territory-attack-settlement.js";
test("stale PvE targets defer settlement without consuming the march",()=>{
 for(const mutation of ["", "UPDATE world_territories SET owner_kingdom_id=2", "UPDATE world_territories SET level=5", "UPDATE world_territories SET territory_kind='castle'", "UPDATE world_territories SET territory_kind='throne'", "UPDATE world_territories SET map_region=2", "UPDATE kingdoms SET map_region=2", "DELETE FROM world_territories"]){
  const sql=new DatabaseSync(":memory:");
  try{
   sql.exec(`CREATE TABLE marches(id INTEGER,kingdom_id INTEGER,status TEXT,arrives_at TEXT,resolved_at TEXT,resolution_token TEXT);
   CREATE TABLE kingdoms(id INTEGER,map_region INTEGER);
   CREATE TABLE world_territories(id INTEGER,owner_kingdom_id INTEGER,territory_key TEXT,level INTEGER,territory_kind TEXT,map_region INTEGER);
   INSERT INTO marches VALUES(10,1,'marching','2026-01-01',NULL,NULL);
   INSERT INTO kingdoms VALUES(1,1);
   INSERT INTO world_territories VALUES(9,NULL,'forest_9',4,'resource',1);`);
   const db={prepare(q){return {bind(...args){return {run:()=>sql.prepare(q).run(...args)}}}}};
   const target={id:9,territory_key:"forest_9",level:4,territory_kind:"resource",map_region:1};
   if(mutation)sql.exec(mutation);
   const update=guardTerritoryAttackSettlement(db,{resolvedAt:"2026-02-01",resolutionToken:"resolution",marchId:10,kingdomId:1,now:"2026-02-01",target});
   assert.equal(Number(update.run().changes),mutation?0:1,mutation);
   assert.equal(sql.prepare("SELECT status FROM marches").get().status,mutation?"marching":"completed");
   assert.equal(Number(update.run().changes),0,"duplicate resolution must not settle again");
  }finally{sql.close()}
 }
});
