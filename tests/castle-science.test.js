import test from "node:test";
import assert from "node:assert/strict";
import {SCIENCE_CATALOG,scienceEnabled,scienceView,sciencePercent,scienceDuration,hospitalScienceCapacity,imperialScienceCap,imperialCombatBonuses} from "../castle-science.js";
test("science requires completed prerequisites and academy levels; effects bounded",()=>{
 assert.equal(scienceEnabled({ENVIRONMENT:"production",GAME_4X_SYSTEMS_ENABLED:"true"}),false);
 const empty=scienceView([],1);assert.ok(empty.every(x=>!x.available));
 const ready=scienceView([{research_key:"economy",level:1}],1);
 assert.equal(ready.find(x=>x.key==="scholarship").available,true);
 assert.equal(ready.find(x=>x.key==="field_logistics").available,false);
 assert.equal(Object.keys(SCIENCE_CATALOG).length,7);
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
