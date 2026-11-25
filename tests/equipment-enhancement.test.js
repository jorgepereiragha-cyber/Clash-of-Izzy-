import test from "node:test";
import assert from "node:assert/strict";
import { ENHANCEMENT_COSTS,FRAGMENT_RECIPES,enhancementCost,enhancedStats,reinforcementSetBonus,enhancementLevel,pveFragmentReward } from "../equipment-enhancement.js";
test("reinforcement uses relative bonuses and never exceeds +10",()=>{
 const def={base:{attack:20,health:8},growth:{attack:2,health:1}};
 assert.deepEqual(enhancedStats(def,2,0),{attack:22,health:9});
 assert.deepEqual(enhancedStats(def,2,10),{attack:27.5,health:11.25});
 assert.equal(enhancementLevel(11),0);
 assert.equal(enhancementLevel(-1),0);
 assert.equal(enhancementCost(10),null);
 assert.equal(ENHANCEMENT_COSTS.reduce((a,b)=>a+b,0),1440);
 assert.equal(Object.keys(FRAGMENT_RECIPES).length,4);
});
test("five valid pieces unlock cumulative milestones",()=>{
 assert.equal(reinforcementSetBonus([10,10,10,10]).stage,0);
 assert.equal(reinforcementSetBonus([10,10,10,10,1]).stage,0);
 assert.equal(reinforcementSetBonus([10,10,10,10,8]).stage,8);
 assert.deepEqual(reinforcementSetBonus([10,10,10,10,10]),{attackPercent:10,defensePercent:11,healthPercent:8,stage:10});
});

test("PvE rarity thresholds are bounded and deterministic",()=>{
 for(const [level,rarity] of [[1,"comum"],[5,"comum"],[6,"raro"],[11,"raro"],[12,"epico"],[19,"epico"],[20,"lendario"],[30,"lendario"]]){
  assert.deepEqual(pveFragmentReward(level),{rarity,quantity:1});
 }
 for(const invalid of [null,0,31,1.5,undefined,"invalid"])assert.equal(pveFragmentReward(invalid),null);
});
