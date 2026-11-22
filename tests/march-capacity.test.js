import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  marchCapacity,marchCapacityForKingdom,countTroops,withinMarchCapacity,
  MARCH_RARITY_BONUS,MAX_MARCH_CAPACITY
} from "../march-capacity.js";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("limite de marcha aumenta com castelo/academia/pesquisa/herói sem exceder teto",()=>{
 const rookie=marchCapacity({castleLevel:1});
 assert.equal(rookie.maximum,2400);
 const castle=marchCapacity({castleLevel:10});
 assert.equal(castle.maximum,20400);
 assert.ok(castle.maximum>rookie.maximum);
 const acad=marchCapacity({castleLevel:10,academyLevel:10});
 assert.ok(acad.maximum>castle.maximum);
 const research=marchCapacity({castleLevel:10,academyLevel:10,militaryResearchLevel:10});
 assert.ok(research.maximum>acad.maximum);
 const white=marchCapacity({castleLevel:10,hero:{level:30,stars:3,rarity:"white"}});
 const blue=marchCapacity({castleLevel:10,hero:{level:30,stars:3,rarity:"blue"}});
 const purple=marchCapacity({castleLevel:10,hero:{level:30,stars:3,rarity:"purple"}});
 const gold=marchCapacity({castleLevel:10,hero:{level:30,stars:3,rarity:"gold"}});
 assert.ok(white.maximum<blue.maximum&&blue.maximum<purple.maximum&&purple.maximum<gold.maximum);
 assert.deepEqual(Object.keys(MARCH_RARITY_BONUS),["white","blue","purple","gold"]);
 assert.ok(marchCapacity({castleLevel:3000,academyLevel:3000,
   militaryResearchLevel:3000,hero:{level:900,stars:80,rarity:"gold"}}).maximum<=MAX_MARCH_CAPACITY);
});
test("não confunde capacidade total do quartel com tropas despachadas por marcha",()=>{
 assert.equal(withinMarchCapacity({militia:100,swordsman:200},2400),true);
 assert.equal(withinMarchCapacity({militia:2401},2400),false);
 assert.equal(withinMarchCapacity({militia:2400},2400),true);
 assert.equal(withinMarchCapacity({militia:0},2400),false);
 assert.equal(withinMarchCapacity({militia:5.5},2400),false);
 assert.equal(withinMarchCapacity({militia:Infinity},2400),false);
 assert.equal(countTroops({militia:300,archer:900}),1200);
 assert.equal(countTroops({militia:300,archer:-1}),-1);
});

test("servidor deriva os quatro fatores diretamente do reino autenticado",async()=>{
 const statements=[];
 const db={prepare(sql){statements.push(sql);return {
   bind(...args){return {first:async()=>{
     if(sql.includes("SELECT castle_level FROM kingdoms"))return {castle_level:15};
     if(sql.includes("kingdom_buildings"))return {level:8};
     if(sql.includes("FROM research"))return {level:11};
     if(sql.includes("hero_inventory hi"))return {rarity:"gold",level:50,stars:5,name:"Comandante"};
     return null;
   }};}
 };}};
 const capacity=await marchCapacityForKingdom(db,12);
 assert.ok(capacity.maximum>30000);
 assert.equal(capacity.heroName,"Comandante");
 assert.ok(statements.some(x=>x.includes("WHERE id=?")));
 assert.ok(statements.some(x=>x.includes("hero_inventory hi")));
 const none={prepare(){return {bind(){return {first:async()=>null};}}}};
 await assert.rejects(()=>marchCapacityForKingdom(none,12),/Reino não encontrado/);
});
test("Worker, rally, cerco e interface usam a mesma fonte autoritativa",async()=>{
 const [worker,rally,throne,ui,page,ignore]=await Promise.all([
   read("worker.js"),read("rally.js"),read("throne-war.js"),
   read("world-map.js"),read("world.html"),read(".assetsignore")
 ]);
 assert.match(worker,/marchCapacityForKingdom\(env\.DB,k\.id\)/);
 assert.match(worker,/withinMarchCapacity\(selected,capacity\.maximum\)/);
 assert.match(worker,/marchCapacity:marchLimit/);
 assert.match(rally,/validateMarchCapacity\(env,kingdomId,troops\)/);
 assert.match(rally,/marchCapacityForKingdom\(env\.DB,kingdomId\)/);
 assert.match(throne,/marchCapacityForKingdom\(env\.DB,kingdomId\)/);
 assert.match(throne,/THRONE_HOLD_MINUTES=150/);
 assert.match(page,/id="marchCapacity"/);
 assert.match(ui,/function updateMarchCapacityLabel/);
 assert.match(ui,/total>max/);
 assert.ok(ignore.split(/\r?\n/).includes("march-capacity.js"));
});
