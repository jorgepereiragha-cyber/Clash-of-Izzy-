import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
 MAX_MARCH_SIZE,calculateMarchCapacity,heroLeadershipBonus,
 troopTotal,assertWithinMarchCapacity,loadMarchCapacity
} from "../march-capacity.js";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const heroes=[
 {hero_key:"white_hero",hero_name:"Darian",rarity:"white",level:1,stars:1},
 {hero_key:"gold_hero",hero_name:"Guardião",rarity:"gold",level:25,stars:5}
];
test("capacidade de marcha depende de castelo, quartel, academia, pesquisa e liderança",()=>{
 const base=calculateMarchCapacity();
 assert.equal(base.capacity,355);
 assert.deepEqual(base.components,{base:150,castle:100,barracks:80,academy:25,military:0,hero:0});
 assert.equal(base.heroKey,null);
 const selected=calculateMarchCapacity({
   castleLevel:12,barracksLevel:8,academyLevel:7,militaryLevel:5,heroes
 });
 assert.equal(selected.components.castle,1200);
 assert.equal(selected.components.barracks,640);
 assert.equal(selected.components.academy,175);
 assert.equal(selected.components.military,550);
 assert.equal(selected.components.hero,heroLeadershipBonus(heroes[1]));
 assert.equal(selected.heroKey,"gold_hero");
 assert.equal(selected.heroName,"Guardião");
 assert.ok(selected.capacity>base.capacity);
 assert.equal(MAX_MARCH_SIZE,16000);
});
test("herói designado escolhe o bônus exato sem somar vários heróis ao mesmo tempo",()=>{
 const factors={castleLevel:12,barracksLevel:8,academyLevel:7,militaryLevel:5,heroes};
 const gold=calculateMarchCapacity({...factors,heroKey:"gold_hero"});
 const common=calculateMarchCapacity({...factors,heroKey:"white_hero"});
 assert.equal(common.heroKey,"white_hero");
 assert.equal(gold.components.hero,heroLeadershipBonus(heroes[1]));
 assert.ok(gold.capacity>common.capacity);
 assert.ok(common.capacity<gold.capacity);
 assert.throws(()=>calculateMarchCapacity({...factors,heroKey:"foreign_hero"}),/não pertence/);
 assert.throws(()=>calculateMarchCapacity({...factors,heroKey:{name:"gold_hero"}}),/inválido/);
});
test("capacidade não cresce sem limite e dados inválidos não criam poderes extras",()=>{
 const max=calculateMarchCapacity({castleLevel:999,barracksLevel:999,academyLevel:999,
   militaryLevel:999,heroes:[{hero_key:"hero",rarity:"gold",level:999,stars:999}]});
 assert.ok(max.capacity<=MAX_MARCH_SIZE);
 assert.equal(max.levels.castle,30);
 assert.equal(max.levels.military,30);
 assert.equal(heroLeadershipBonus({rarity:"wrong",level:-5,stars:-2}),108);
 assert.equal(heroLeadershipBonus(null),0);
});
test("servidor rejeita marcha vazia, fraude de quantidade e excesso do limite",()=>{
 assert.equal(troopTotal({militia:100,knight:55}),155);
 assert.equal(assertWithinMarchCapacity({militia:100,knight:55},155),155);
 assert.throws(()=>assertWithinMarchCapacity({militia:100,knight:55},154),/Capacidade/);
 assert.throws(()=>assertWithinMarchCapacity({},100),/pelo menos/);
 assert.throws(()=>troopTotal({militia:-1}),/inválida/);
 assert.throws(()=>troopTotal({militia:1.5}),/inválida/);
 assert.throws(()=>troopTotal([]),/inválida/);
 assert.throws(()=>troopTotal({militia:Number.MAX_SAFE_INTEGER,swordsman:1}),/Tropas demais/);
});
test("consulta os atributos do D1 e rejeita herói estrangeiro",async()=>{
 const statements=[];
 const fake={DB:{prepare(sql){
   statements.push(sql);
   return {bind(...args){
     return {
       first:async()=>({castleLevel:8,barracksLevel:4,academyLevel:5,militaryLevel:2}),
       all:async()=>({results:heroes})
     };
   }};
 }}};
 const model=await loadMarchCapacity(fake,7,"gold_hero");
 assert.equal(model.heroKey,"gold_hero");
 assert.equal(model.levels.castle,8);
 assert.ok(model.capacity>200);
 assert.ok(statements.some(x=>x.includes("FROM kingdoms k WHERE k.id=?")));
 assert.ok(statements.some(x=>x.includes("WHERE hi.kingdom_id=?")));
 await assert.rejects(loadMarchCapacity(fake,7,"unknown"),/não pertence/);
 await assert.rejects(loadMarchCapacity(fake,-1),/inválido/);
});
test("Worker aplica limite antes de debitar e registra herói da expedição",async()=>{
 const [worker,ui,html,migration]=await Promise.all([
   read("worker.js"),read("world-map.js"),read("world.html"),
   read("migrations/0036_march_commanders.sql")
 ]);
 const march=worker.slice(worker.indexOf('}else if(type==="march"){'),worker.indexOf('}else if(type==="battle"){'));
 assert.match(march,/loadMarchCapacity\(env,k\.id,body\.heroKey\?\?null\)/);
 assert.match(march,/assertWithinMarchCapacity\(selected,marchLimit\.capacity\)/);
 assert.ok(march.indexOf("assertWithinMarchCapacity")<march.indexOf("UPDATE army_units SET quantity=quantity-CAST"));
 assert.match(march,/commander_hero_key,march_capacity_at_dispatch/);
 assert.match(march,/marchLimit\.heroKey,marchLimit\.capacity/);
 assert.match(worker,/m\.commander_hero_key/);
 assert.match(worker,/marchCapacity,marchHeroOptions/);
 assert.match(ui,/heroKey:selectedMarchHeroKey\|\|null/);
 assert.match(ui,/selectedMarchCapacity\(\)/);
 assert.match(html,/id="marchCapacityInfo"/);
 assert.match(html,/id="marchHero"/);
 assert.match(migration,/ADD COLUMN commander_hero_key TEXT/);
 assert.match(migration,/ADD COLUMN march_capacity_at_dispatch INTEGER/);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM marches/i);
});
