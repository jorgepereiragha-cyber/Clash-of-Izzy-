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


test("mixed formation science sensitivity with paired seeds and near-cap equipment",t=>{
 const units=["spearman","archer","knight","catapult"];
 const keys=Object.values(SPECIALIZED_SCIENCE_KEYS);
 const formations=[[150,150,150,150],[420,60,60,60],[60,420,60,60],[60,60,420,60],[60,60,60,420]];
 const profiles=[...keys.map(key=>({name:key,levels:{[key]:10}})),{name:"all",levels:Object.fromEntries(keys.map(key=>[key,10]))}];
 const stats=new Map();
 let simulations=0;
 for(const [index,quantities] of formations.entries()){
  const army=units.map((unit_type,i)=>({unit_type,tier:1,quantity:quantities[i]}));
  const total=quantities.reduce((a,b)=>a+b,0);
  for(const defenderLevel of [5,15,30])for(const criticalSeed of [1,17,113,2026])for(const equipmentAttackBonusPercent of [0,28]){
   const opts={army,rulesVersion:2,castleLevel:30,defenderLevel,criticalSeed,criticalChancePercent:10,equipmentAttackBonusPercent,roll:1};
   const base=simulateBattle(opts);simulations++;
   for(const profile of profiles){
    const outcome=simulateBattle({...opts,experimentalScienceLevels:profile.levels});simulations++;
    assert.equal(outcome.defenderPower,base.defenderPower);
    assert.ok(outcome.attackerPower>=base.attackerPower);
    const cap=equipmentAttackBonusPercent===28?1.30/1.28:1.03;
    assert.ok(outcome.attackerPower<=Math.ceil(base.attackerPower*cap)+1);
    assert.equal(outcome.survivors+Object.values(outcome.losses).reduce((a,b)=>a+b,0),total);
    assert.ok(Object.values(outcome.losses).every(n=>Number.isSafeInteger(n)&&n>=0));
    const key=index+":"+profile.name+":"+equipmentAttackBonusPercent;
    const row=stats.get(key)||{formation:index,profile:profile.name,equipmentAttackBonusPercent,cases:0,baseWins:0,wins:0,baseSurvivors:0,survivors:0};
    row.cases++;row.baseWins+=Number(base.won);row.wins+=Number(outcome.won);
    row.baseSurvivors+=base.survivors;row.survivors+=outcome.survivors;stats.set(key,row);
   }
  }
 }
 assert.equal(simulations,720);
 assert.equal(stats.size,50);
 // Report matched cases, not a prediction of player win rate.
 t.diagnostic("science-sensitivity: "+JSON.stringify({simulations,rows:[...stats.values()]}));
});


test("experimental defense and health are class-isolated and preserve existing caps",()=>{
 const army=[{unit_type:"militia",tier:1,quantity:100}];
 const levels={science_infantry:10};
 const options={army,rulesVersion:2,castleLevel:10,defenderLevel:15,criticalSeed:17,roll:1};
 const base=simulateBattle(options);
 const defense=simulateBattle({...options,experimentalDefenseScienceLevels:levels});
 const health=simulateBattle({...options,experimentalHealthScienceLevels:levels});
 assert.equal(defense.attackerPower,base.attackerPower);
 assert.equal(health.attackerPower,base.attackerPower);
 const hit=x=>x.log.find(r=>r.side==="defender")?.damage;
 assert.ok(hit(base)>0);
 assert.ok(hit(defense)<hit(base));
 for(const value of [defense,health])assert.equal(value.survivors+Object.values(value.losses).reduce((a,b)=>a+b,0),100);
 const combined={experimentalDefenseScienceLevels:levels,experimentalHealthScienceLevels:levels};
 assert.deepEqual(simulateBattle({...options,army:[{unit_type:"archer",tier:1,quantity:100}],...combined}),simulateBattle({...options,army:[{unit_type:"archer",tier:1,quantity:100}]}));
 assert.deepEqual(simulateBattle({...options,rulesVersion:1,...combined}),simulateBattle({...options,rulesVersion:1}));
 const capped={...options,defenseBonusPercent:30,equipmentHealthBonusPercent:30};
 assert.deepEqual(simulateBattle({...capped,...combined}),simulateBattle(capped));
 const invalid={science_infantry:11};
 assert.deepEqual(simulateBattle({...options,experimentalDefenseScienceLevels:invalid,experimentalHealthScienceLevels:invalid}),base);
});
test("small and contested armies reveal wins and losses across independent science attributes",t=>{
 const units=["spearman","archer","knight","catapult"];
 const keys=Object.values(SPECIALIZED_SCIENCE_KEYS);
 const all=Object.fromEntries(keys.map(k=>[k,10]));
 const profiles=[
  ["control",{}],
  ["attack",{experimentalScienceLevels:all}],
  ["defense",{experimentalDefenseScienceLevels:all}],
  ["health",{experimentalHealthScienceLevels:all}],
  ["combined",{experimentalScienceLevels:all,experimentalDefenseScienceLevels:all,experimentalHealthScienceLevels:all}]
 ];
 const formations=[[1,1,1,1],[7,1,1,1],[1,7,1,1],[1,1,7,1],[1,1,1,7]];
 const stats=Object.fromEntries(profiles.map(([name])=>[name,{cases:0,wins:0,survivors:0,changedWins:0,changedLosses:0}]));
 let simulations=0;
 for(const mix of formations)for(const scale of [1,2,4,8,16,32,64])for(const defenderLevel of [15,30])for(const criticalSeed of [1,17,113,2026]){
  const army=units.map((unit_type,i)=>({unit_type,tier:1,quantity:mix[i]*scale}));
  const quantity=army.reduce((n,row)=>n+row.quantity,0);
  const opts={army,rulesVersion:2,castleLevel:20,defenderLevel,criticalSeed,criticalChancePercent:10,roll:1};
  let base;
  for(const [name,profile] of profiles){
   const result=simulateBattle({...opts,...profile});simulations++;
   if(name==="control")base=result;
   const row=stats[name];row.cases++;row.wins+=Number(result.won);row.survivors+=result.survivors;
   row.changedWins+=Number(!base.won&&result.won);row.changedLosses+=Number(base.won&&!result.won);
   assert.equal(result.survivors+Object.values(result.losses).reduce((a,b)=>a+b,0),quantity);
   assert.equal(result.defenderPower,base.defenderPower);
   assert.ok(result.attackerPower>=base.attackerPower&&result.attackerPower<=Math.ceil(base.attackerPower*1.03)+1);
   if(name==="defense"||name==="health")assert.equal(result.attackerPower,base.attackerPower);
  }
 }
 assert.equal(simulations,1400);
 assert.ok(stats.control.wins>0&&stats.control.wins<stats.control.cases,"control must contain both victories and defeats");
 t.diagnostic("science-contested: "+JSON.stringify({simulations,stats}));
});
