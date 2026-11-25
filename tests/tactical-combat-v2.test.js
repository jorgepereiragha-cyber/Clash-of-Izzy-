import test from "node:test";
import assert from "node:assert/strict";
import {combatRulesVersion,simulateBattle,tacticalActiveUnits,tacticalMultiplier,specializedScienceAttackPercent,SPECIALIZED_SCIENCE_KEYS} from "../game-adapter.js";

test("tactical combat requires a beta-only explicit server flag",()=>{
 assert.equal(combatRulesVersion({ENVIRONMENT:"beta"}),1);
 assert.equal(combatRulesVersion({ENVIRONMENT:"production",COMBAT_TACTICS_ENABLED:"true"}),1);
 assert.equal(combatRulesVersion({ENVIRONMENT:"beta",COMBAT_TACTICS_ENABLED:"true"}),2);
});
test("troop counters are bounded and siege is neutral without a wall",()=>{
 assert.equal(tacticalMultiplier("spearman","archer"),1.15);
 assert.equal(tacticalMultiplier("archer","knight"),1.15);
 assert.equal(tacticalMultiplier("cavalry","militia"),1.15);
 assert.equal(tacticalMultiplier("archer","militia"),1);
 assert.equal(tacticalMultiplier("ram","knight"),1);
});
test("large formations scale beyond forty active units",()=>{
 assert.equal(tacticalActiveUnits(40),40);
 assert.ok(tacticalActiveUnits(400)>40);
 assert.ok(tacticalActiveUnits(200000)>tacticalActiveUnits(400));
 assert.ok(tacticalActiveUnits(200000)<=200000);
 assert.equal(tacticalActiveUnits(200001),0);
});
test("tactical simulation is deterministic and cannot gain power from splitting or reordering stacks",()=>{
 const a={unit_type:"militia",tier:1,quantity:600},b={unit_type:"archer",tier:1,quantity:300};
 const options={rulesVersion:2,castleLevel:10,defenderLevel:10,criticalSeed:17,criticalChancePercent:10};
 const result=simulateBattle({...options,army:[a,b]});
 const split=simulateBattle({...options,army:[b,{...a,quantity:400},{...a,quantity:200}]});
 assert.deepEqual(result,split);
 assert.equal(result.rulesVersion,2);
 assert.ok(result.survivors<=900);
 assert.equal(Object.values(result.losses).reduce((x,y)=>x+y,0)+result.survivors,900);
 assert.ok(Object.values(result.defenderLosses).every(x=>Number.isSafeInteger(x)&&x>=0));
});
test("legacy mode keeps its original output and tactical validation rejects invalid inputs",()=>{
 const army=[{unit_type:"militia",tier:1,quantity:60}];
 assert.deepEqual(simulateBattle({army}),simulateBattle({army,rulesVersion:1}));
 assert.throws(()=>simulateBattle({army:[{...army[0],quantity:200001}],rulesVersion:2}));
 assert.throws(()=>simulateBattle({army:[{...army[0],unit_type:"unknown"}],rulesVersion:2}));
});


test("experimental sciences affect only the matching troop class and reject invalid levels",()=>{
 const cases={infantry:["militia","swordsman","spearman"],ranged:["archer","crossbowman","mage"],cavalry:["cavalry","knight"],siege:["catapult","ram","trebuchet"]};
 for(const [family,units] of Object.entries(cases)){
  const key=SPECIALIZED_SCIENCE_KEYS[family],levels={[key]:10};
  for(const unit of units)assert.equal(specializedScienceAttackPercent(levels,unit),3);
  for(const [other,others] of Object.entries(cases))if(other!==family)for(const unit of others)assert.equal(specializedScienceAttackPercent(levels,unit),0);
 }
 for(const invalid of [-1,11,1.5,Infinity,NaN,"10",null])assert.equal(specializedScienceAttackPercent({science_infantry:invalid},"militia"),0);
 assert.equal(specializedScienceAttackPercent(Object.create({science_infantry:10}),"militia"),0);
 assert.equal(specializedScienceAttackPercent({science_infantry:10},"__proto__"),0);
});
test("experimental science preserves legacy results, class isolation, total cap and stack determinism",()=>{
 const a={unit_type:"militia",tier:1,quantity:1000},b={unit_type:"archer",tier:1,quantity:1000};
 const options={army:[a,b],castleLevel:10,defenderLevel:10,criticalSeed:17,roll:1};
 const levels={science_infantry:10};
 assert.deepEqual(simulateBattle({...options,experimentalScienceLevels:levels}),simulateBattle(options));
 const tactical={...options,rulesVersion:2};
 assert.ok(simulateBattle({...tactical,experimentalScienceLevels:levels}).attackerPower>simulateBattle(tactical).attackerPower);
 assert.deepEqual(simulateBattle({...tactical,army:[b],experimentalScienceLevels:levels}),simulateBattle({...tactical,army:[b]}));
 const capped={...tactical,equipmentAttackBonusPercent:30};
 assert.deepEqual(simulateBattle({...capped,experimentalScienceLevels:levels}),simulateBattle(capped));
 assert.deepEqual(simulateBattle({...tactical,experimentalScienceLevels:levels}),simulateBattle({...tactical,army:[b,{...a,quantity:300},{...a,quantity:700}],experimentalScienceLevels:levels}));
});
test("specialization matrix compares every family at levels zero, five and ten",()=>{
 const classes={science_infantry:"spearman",science_archers:"archer",science_cavalry:"knight",science_siege:"catapult"};
 for(const [key,unit] of Object.entries(classes)){
  for(const tier of [1,5,10])for(const quantity of [200,1000,5000]){
   const base={army:[{unit_type:unit,tier,quantity}],rulesVersion:2,castleLevel:30,defenderLevel:30,criticalSeed:17,roll:1};
   const results=[0,5,10].map(level=>simulateBattle({...base,experimentalScienceLevels:{[key]:level}}));
   assert.ok(results[0].attackerPower<=results[1].attackerPower&&results[1].attackerPower<=results[2].attackerPower);
   assert.ok(results[2].attackerPower<=Math.ceil(results[0].attackerPower*1.03)+1);
   for(const outcome of results)assert.equal(outcome.survivors+Object.values(outcome.losses).reduce((x,y)=>x+y,0),quantity);
  }
 }
});
