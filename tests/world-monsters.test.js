import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
import {worldMonsterPreview} from "../world-monsters.js";
test("monster preview is persisted, isolated by region, idempotent and read-only",async()=>{
 const migration=await readFile(new URL("../migrations/0048_world_monsters.sql",import.meta.url),"utf8");
 const sql=new DatabaseSync(":memory:");
 try{
  sql.exec("CREATE TABLE players(id INTEGER PRIMARY KEY,player_id TEXT); CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,player_id INTEGER,map_region INTEGER); INSERT INTO players VALUES(1,'a'),(2,'b'),(3,'c'); INSERT INTO kingdoms VALUES(1,1,1),(2,2,2),(3,3,3)");
  sql.exec(migration);sql.exec(migration);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM world_monsters").get().n,18);
  const env={ENVIRONMENT:"beta",GAME_4X_SYSTEMS_ENABLED:"true",DB:{prepare(q){return{bind(...args){return{first:async()=>sql.prepare(q).get(...args),all:async()=>({results:sql.prepare(q).all(...args)})}}}}}};
  const regions=await Promise.all(["a","b","c"].map(p=>worldMonsterPreview(env,p)));
  assert.deepEqual(regions.map(x=>x.region),[1,2,3]);
  for(const result of regions){assert.equal(result.monsters.length,6);assert.equal(result.combatEnabled,false);assert.deepEqual(result.monsters.map(x=>x.level),[1,3,5,8,12,18]);assert.ok(result.monsters.every(m=>m.hp===m.max_hp));}
  assert.equal(new Set(regions.flatMap(x=>x.monsters.map(m=>m.id))).size,18);
  assert.equal(await worldMonsterPreview(env,"absent"),null);
  assert.deepEqual(await worldMonsterPreview({ENVIRONMENT:"production",GAME_4X_SYSTEMS_ENABLED:"true"},"a"),{enabled:false,combatEnabled:false,monsters:[]});
  assert.throws(()=>sql.exec("UPDATE world_monsters SET hp=max_hp+1"));
  assert.throws(()=>sql.exec("UPDATE world_monsters SET map_region=4"));
  const id=regions[0].monsters[0].id;
  sql.prepare("UPDATE world_monsters SET hp=0,respawn_at=2000000000 WHERE id=?").run(id);
  sql.exec(migration);
  assert.equal((await worldMonsterPreview(env,"a")).monsters[0].hp,0);
 }finally{sql.close()}
});
test("monster guide uses authenticated read-only endpoint and safe text rendering",async()=>{
 const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
 const [worker,ui,html,ignore]=await Promise.all([read("worker.js"),read("scripts/world-monster-preview.js"),read("world.html"),read(".assetsignore")]);
 assert.match(worker,/url\.pathname==="\/api\/game\/world-monsters"&&request\.method==="GET"/);
 assert.match(worker,/worldMonsterPreview\(env,playerId\)/);
 assert.match(ui,/Authorization:"Bearer "\+bearer/);
 assert.doesNotMatch(ui,/innerHTML|method:"POST"/);
 assert.match(html,/id="worldMonsterPreview" hidden/);
 assert.ok(ignore.split(/\r?\n/).includes("world-monsters.js"));
});
