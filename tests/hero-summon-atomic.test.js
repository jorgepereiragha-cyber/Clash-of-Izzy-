import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {appendHeroSummonDraw,heroSummonResult} from "../worker.js";

test("repeated hero draws use committed ownership, preserve one copy and return exact fragments",()=>{
 const db=new DatabaseSync(":memory:");
 try{
  db.exec(`
   CREATE TABLE hero_inventory(kingdom_id INTEGER,hero_key TEXT,rarity TEXT,level INTEGER,experience INTEGER,stars INTEGER,skill_level INTEGER,fragments INTEGER,UNIQUE(kingdom_id,hero_key));
   CREATE TABLE heroes(kingdom_id INTEGER,hero_key TEXT,hero_name TEXT,level INTEGER,experience INTEGER,rarity TEXT,UNIQUE(kingdom_id,hero_key));
   CREATE TABLE hero_summon_history(id INTEGER PRIMARY KEY,kingdom_id INTEGER,hero_key TEXT,rarity TEXT,result_type TEXT);
   CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT);
   INSERT INTO kingdom_events VALUES(1,'__internal_action_guard','first'),(1,'__internal_action_guard','second');
  `);
  const adapter={prepare(sql){return {bind(...args){return {sql,args}}}}};
  const draw={heroKey:"kael_sunwarden",rarity:"white",name:"Kael",fragmentGain:10,tableRarity:"common"};
  // Both requests can prepare their statements before either commits.
  const first=[],second=[],denied=[];
  const i=appendHeroSummonDraw(adapter,first,{kingdomId:1,actionId:"first",...draw});
  const j=appendHeroSummonDraw(adapter,second,{kingdomId:1,actionId:"second",...draw});
  const k=appendHeroSummonDraw(adapter,second,{kingdomId:1,actionId:"second",...draw});
  const m=appendHeroSummonDraw(adapter,denied,{kingdomId:1,actionId:"no-debit",...draw});
  const run=stmts=>{db.exec("BEGIN");try{const results=stmts.map(({sql,args})=>sql.includes(" RETURNING ")?{results:db.prepare(sql).all(...args)}:{meta:db.prepare(sql).run(...args)});db.exec("COMMIT");return results;}catch(e){db.exec("ROLLBACK");throw e;}};
  const a=run(first),b=run(second),c=run(denied);
  assert.deepEqual([heroSummonResult(draw,a[i]),heroSummonResult(draw,b[j]),heroSummonResult(draw,b[k])].map(x=>[x.result_type,x.fragments]),[["new",0],["duplicate",10],["duplicate",10]]);
  assert.deepEqual(c[m].results,[]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM heroes").get().n,1);
  assert.equal(db.prepare("SELECT fragments FROM hero_inventory").get().fragments,20);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM hero_summon_history").get().n,3);
 }finally{db.close();}
});
