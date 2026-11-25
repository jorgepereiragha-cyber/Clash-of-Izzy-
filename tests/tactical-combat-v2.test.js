import test from "node:test";
import assert from "node:assert/strict";
import {combatRulesVersion,simulateBattle,tacticalActiveUnits,tacticalMultiplier} from "../game-adapter.js";

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
