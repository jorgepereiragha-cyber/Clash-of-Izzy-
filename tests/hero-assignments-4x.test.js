import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {calculateChainProduction} from "../intermediate-production.js";
import {HERO_4X_SLOTS,millHeroMultiplier,towerHeroMultiplier,assign4xHero,unassign4xHero,assigned4xHeroLevel} from "../hero-assignments-4x.js";

test("moinho usa bônus exclusivo e não produz trigo adicional",()=>{
  assert.equal(millHeroMultiplier(null),1);
  assert.equal(towerHeroMultiplier(null),1);
  assert.equal(millHeroMultiplier(20),1.15);
  assert.equal(towerHeroMultiplier(20),1.2);
  assert.ok(millHeroMultiplier(100)<=1.15);
  assert.ok(towerHeroMultiplier(100)<=1.2);
  const base=calculateChainProduction({elapsedSeconds:3600,farmLevel:3,millLevel:1,bakeryLevel:2,foodFreeSpace:100});
  const buff=calculateChainProduction({elapsedSeconds:3600,farmLevel:3,millLevel:1,bakeryLevel:2,foodFreeSpace:100,millMultiplier:millHeroMultiplier(20)});
  assert.equal(base.harvestedWheat,buff.harvestedWheat);
  assert.equal(base.processedWheat,12);
  assert.equal(buff.processedWheat,13);
  assert.equal(buff.food,13);
  assert.equal(calculateChainProduction({elapsedSeconds:3600,multiplier:0,millMultiplier:2,foodFreeSpace:100}).food,0);
});
test("alocação aceita apenas classes e postos permitidos, sem usar níveis do cliente",async()=>{
  const statements=[];
  const db={DB:{prepare(sql){
    return {bind(...params){
      statements.push({sql,params});
      return {run:async()=>({meta:{changes:1}}),first:async()=>({level:20})};
    }};
  }}};
  assert.deepEqual(Object.keys(HERO_4X_SLOTS),["industry:mill","defense:tower"]);
  assert.equal((await assign4xHero(db,2,"hero_x","industry:mill","infantaria")).status,400);
  assert.equal(statements.length,0);
  const good=await assign4xHero(db,2,"hero_x","industry:mill","suporte");
  assert.equal(good.ok,true);
  assert.match(statements.at(-1).sql,/NOT EXISTS\(SELECT 1 FROM heroes occupied/);
  assert.match(statements.at(-1).sql,/EXISTS\(SELECT 1 FROM hero_inventory/);
  assert.match(statements.at(-1).sql,/building_type='farm'/);
  assert.ok(statements.at(-1).params.every(x=>x!=="evil"));
  const defense=await assign4xHero(db,2,"hero_x","defense:tower","arqueiro");
  assert.equal(defense.ok,true);
  assert.match(statements.at(-1).sql,/FROM city_defenses/);
  assert.equal(await assigned4xHeroLevel(db,2,"industry:mill"),20);
  assert.equal((await unassign4xHero(db,2,"hero_x")).ok,true);
  assert.match(statements.at(-1).sql,/assigned_to IN/);
});
test("alocação concorrente bloqueada retorna 409, sem débito financeiro",async()=>{
  const db={DB:{prepare(sql){
    assert.doesNotMatch(sql,/UPDATE kingdoms SET.*gold|UPDATE players SET.*gems/i);
    return {bind(){return {run:async()=>({meta:{changes:0}})};}};
  }}};
  const result=await assign4xHero(db,1,"hero_x","defense:tower","infantaria");
  assert.deepEqual([result.ok,result.status],[false,409]);
});
test("UI e Worker usam /game/action e heróis do banco real sem migração 0037 paralela",async()=>{
  const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
  const [worker,html,ui]=await Promise.all([
    read("worker.js"),read("kingdom.html"),read("scripts/kingdom-4x-systems.js")
  ]);
  assert.match(worker,/type==="assign_hero_to_building"/);
  assert.match(worker,/type==="assign_hero_to_defense"/);
  assert.match(worker,/towerHeroMultiplier/);
  assert.match(html,/coiHeroCandidate/);
  assert.match(ui,/type:"assign_hero_to_defense"/);
  assert.match(ui,/type:"assign_hero_to_building"/);
});
