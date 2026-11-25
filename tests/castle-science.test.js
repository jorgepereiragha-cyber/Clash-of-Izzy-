import test from "node:test";
import assert from "node:assert/strict";
import {SCIENCE_CATALOG,scienceEnabled,scienceView,sciencePercent,scienceDuration,hospitalScienceCapacity,imperialScienceCap,imperialCombatBonuses,scienceUpgradeCost,scienceResourceShortfall,resourceScienceMultipliers,structuralDefenseScience} from "../castle-science.js";
test("science requires completed prerequisites and academy levels; effects bounded",()=>{
 assert.equal(scienceEnabled({ENVIRONMENT:"production",GAME_4X_SYSTEMS_ENABLED:"true"}),false);
 const empty=scienceView([],1);assert.ok(empty.every(x=>!x.available));
 const ready=scienceView([{research_key:"economy",level:1}],1);
 assert.equal(ready.find(x=>x.key==="scholarship").available,true);
 assert.equal(ready.find(x=>x.key==="field_logistics").available,false);
 assert.equal(Object.keys(SCIENCE_CATALOG).length,11);
 assert.equal(sciencePercent("scholarship",999),15);
 assert.equal(scienceDuration(100,"conscription",10),85);
 assert.equal(sciencePercent("field_logistics",10),10);
 assert.equal(hospitalScienceCapacity(30,10),3600);
 assert.equal(hospitalScienceCapacity(0,10),0);
 assert.equal(sciencePercent("__proto__",10),0);
});

test("imperial science unlocks only after castle 30 and VIP 1, with tier limits",()=>{
 const rows=[{research_key:"military",level:10},{research_key:"defense",level:10},{research_key:"imperial_attack",level:30},{research_key:"imperial_defense",level:30},{research_key:"imperial_health",level:30}];
 assert.equal(imperialScienceCap({castle_level:29,prestige:7}),0);
 assert.deepEqual(imperialCombatBonuses(rows,{castle_level:30,prestige:0}),{attackPercent:0,defensePercent:0,healthPercent:0});
 for(const [vip,cap] of [0,5,10,15,20,24,27,30].entries()){
  const kingdom={castle_level:30,prestige:vip};
  assert.equal(imperialScienceCap(kingdom),cap);
  assert.deepEqual(imperialCombatBonuses(rows,kingdom),{attackPercent:cap/5,defensePercent:cap/5,healthPercent:cap/5});
 }
 const start=scienceView(rows.slice(0,2),10,{castle_level:30,prestige:1}).find(x=>x.key==="imperial_attack");
 assert.equal(start.available,true);assert.equal(start.unlockedMax,5);
 assert.equal(scienceView(rows.slice(0,2),10,{castle_level:30,prestige:0}).find(x=>x.key==="imperial_attack").available,false);
 assert.equal(scienceView([...rows.slice(0,2),{research_key:"imperial_attack",level:5}],20,{castle_level:30,prestige:1}).find(x=>x.key==="imperial_attack").available,false);
});
test("imperial attack actually affects existing battle simulation within the aggregate cap",async()=>{
 const {simulateBattle}=await import("../game-adapter.js");
 const input={army:[{unit_type:"militia",tier:1,quantity:100}],castleLevel:30,defenderLevel:10,criticalSeed:1,roll:1};
 const base=simulateBattle(input),up=simulateBattle({...input,imperialAttackBonusPercent:6});
 assert.ok(up.attackerPower>base.attackerPower);
 assert.deepEqual(simulateBattle({...input,imperialAttackBonusPercent:999}),up);
});


test("Academy explains each gate and previews next permitted bonus without changing prices",()=>{
 const get=(rows,academy,kingdom,key)=>scienceView(rows,academy,kingdom).find(x=>x.key===key);
 const prereq=[{research_key:"military",level:10}];
 assert.equal(get([],1,{},"scholarship").lockedReason,"prerequisite");
 assert.equal(get(prereq,0,{castle_level:30,prestige:1},"imperial_attack").lockedReason,"academy");
 const gated=get(prereq,30,{castle_level:30,prestige:0},"imperial_attack");
 assert.equal(gated.lockedReason,"vip");assert.equal(gated.nextBonusPercent,null);
 const ready=get(prereq,10,{castle_level:30,prestige:1},"imperial_attack");
 assert.equal(ready.lockedReason,null);assert.equal(ready.available,true);assert.equal(ready.nextBonusPercent,0.2);
 assert.deepEqual(ready.nextCost,{wood:900,stone:600,iron:180});
 const capped=get([...prereq,{research_key:"imperial_attack",level:5}],30,{castle_level:30,prestige:1},"imperial_attack");
 assert.equal(capped.lockedReason,"vip");assert.equal(capped.nextBonusPercent,null);assert.equal(capped.bonusPercent,1);
 const max=get([...prereq,{research_key:"imperial_attack",level:30}],30,{castle_level:30,prestige:7},"imperial_attack");
 assert.equal(max.lockedReason,"max_level");assert.equal(max.nextCost,null);
});


test("Academy prices are canonical and resource shortfalls never authorize invalid balances",()=>{
 for(const [key,def] of Object.entries(SCIENCE_CATALOG)){
  for(let level=0;level<def.maxLevel;level++){
   assert.deepEqual(scienceUpgradeCost(key,level),Object.fromEntries(Object.entries(def.cost).map(([resource,base])=>[resource,base*(level+1)])));
  }
  assert.equal(scienceUpgradeCost(key,def.maxLevel),null);
 }
 for(const invalid of [-1,1.5,Infinity,NaN,"1",null])assert.equal(scienceUpgradeCost("scholarship",invalid),null);
 assert.equal(scienceUpgradeCost("__proto__",0),null);
 const cost=scienceUpgradeCost("scholarship",0);
 assert.deepEqual(scienceResourceShortfall(cost,{wood:319.2,stone:220,iron:4}),{wood:1,stone:0,iron:11});
 assert.equal(scienceResourceShortfall(cost,{wood:320,stone:220}),null);
 assert.equal(scienceResourceShortfall(cost,{wood:Infinity,stone:220,iron:15}),null);
 const rows=[{research_key:"economy",level:1}];
 const missing=scienceView(rows,1,{wood:319,stone:220,iron:15}).find(r=>r.key==="scholarship");
 assert.equal(missing.available,true);
 assert.equal(missing.resourcesReady,false);
 assert.deepEqual(missing.resourceShortfall,{wood:1,stone:0,iron:0});
 assert.equal(missing.academyLevel,1);
 assert.equal(missing.prerequisiteLevel,1);
 const ready=scienceView(rows,1,{wood:320,stone:220,iron:15}).find(r=>r.key==="scholarship");
 assert.equal(ready.resourcesReady,true);
 assert.equal(scienceView(rows,1,{}).find(r=>r.key==="scholarship").resourcesReady,null);
});
test("Worker debit and UI share the price and readiness contract",async()=>{
 const {readFile}=await import("node:fs/promises");
 const [worker,page]=await Promise.all(["../worker.js","../kingdom.html"].map(p=>readFile(new URL(p,import.meta.url),"utf8")));
 assert.match(worker,/cost=science\?scienceUpgradeCost\(key,level\)/);
 assert.match(page,/row\.resourcesReady!==true/);
 assert.match(page,/row\.resourceShortfall/);
 assert.match(page,/row\.academyLevel/);
});

test("specializations require academy and completed economy or defense research",()=>{
 const rows=[{research_key:"economy",level:3},{research_key:"defense",level:3}];
 const get=(academy,key)=>scienceView(rows,academy).find(x=>x.key===key);
 assert.equal(get(2,"forestry").lockedReason,"academy");
 assert.equal(get(3,"forestry").available,true);
 assert.equal(get(3,"masonry").available,true);
 assert.equal(get(5,"metallurgy").lockedReason,"prerequisite");
 assert.equal(get(5,"fortification").available,true);
});
test("specialized production is additive, isolated by resource, and capped",()=>{
 assert.deepEqual(resourceScienceMultipliers(),{food:1,wood:1,stone:1,iron:1,gold:1});
 const rows=[{research_key:"economy",level:99},{research_key:"forestry",level:99},{research_key:"masonry",level:5},{research_key:"metallurgy",level:2}];
 assert.deepEqual(resourceScienceMultipliers(rows),{food:1.3,wood:1.4,stone:1.35,iron:1.32,gold:1.3});
 assert.equal(structuralDefenseScience(1000,99),1100);
 assert.equal(structuralDefenseScience(1000,0),1000);
 assert.equal(structuralDefenseScience(1000,-1),1000);
});
test("production and structural defense consume completed research, not request percentages",async()=>{
 const {readFile}=await import("node:fs/promises");
 const worker=await readFile(new URL("../worker.js",import.meta.url),"utf8");
 assert.match(worker,/resourceScienceMultipliers\(resourceResearch\?\.results\|\|\[\]\)/);
 assert.match(worker,/resourceMultipliers\[key\]\*elapsed/);
 assert.match(worker,/prestigeBonus\*resourceMultipliers\.food/);
 assert.match(worker,/if\(scienceEnabled\(env\)\)defense=structuralDefenseScience\(defense,kingdom.fortification_level\)/);
});
