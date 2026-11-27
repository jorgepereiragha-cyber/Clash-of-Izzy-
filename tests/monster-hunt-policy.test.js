import test from "node:test";
import assert from "node:assert/strict";
import {HUNT_LEVELS,HUNT_RULES,huntEnergyAt,nextHuntLevel,evaluateMonsterHunt} from "../monster-hunt-policy.js";
const monster={id:1,map_region:1,level:1,hp:240,max_hp:240,respawn_at:0,generation:1};
const request={monster,kingdomRegion:1,now:1000};
test("hunt progression follows six actual spawn levels, not imaginary missing levels",()=>{
 assert.deepEqual([0,...HUNT_LEVELS].map(nextHuntLevel),[1,3,5,8,12,18,18]);
 assert.equal(nextHuntLevel(2),null);
 for(let i=1;i<HUNT_LEVELS.length;i++){
  const prev=HUNT_RULES[HUNT_LEVELS[i-1]],cur=HUNT_RULES[HUNT_LEVELS[i]];
  assert.ok(cur.energy>prev.energy&&cur.respawnSeconds>prev.respawnSeconds&&cur.rewardFood>prev.rewardFood);
 }
 assert.equal(evaluateMonsterHunt({...request,monster:{...monster,level:3}}).code,"HUNT_LEVEL_LOCKED");
 assert.equal(evaluateMonsterHunt({...request,clearedLevel:1,monster:{...monster,level:3}}).ok,true);
});
test("energy accrues on server time, preserves fractional recovery and stops at cap",()=>{
 assert.deepEqual(huntEnergyAt(null,1000),{energy:120,updatedAt:1000});
 assert.deepEqual(huntEnergyAt({energy:50,updated_at:100},850),{energy:52,updatedAt:700});
 assert.deepEqual(huntEnergyAt({energy:119,updated_at:100},1000),{energy:120,updatedAt:1000});
 assert.deepEqual(huntEnergyAt({energy:120,updated_at:100},1000),{energy:120,updatedAt:1000});
 for(const row of [{energy:-1,updated_at:100},{energy:121,updated_at:100},{energy:1.5,updated_at:100},{energy:1,updated_at:1001},{energy:"120",updated_at:100}])assert.equal(huntEnergyAt(row,1000),null);
});
test("hunt preflight rejects dead, stale, cross-realm and unaffordable monsters",()=>{
 assert.deepEqual(evaluateMonsterHunt(request),{ok:true,monsterId:1,generation:1,level:1,energyCost:10,energyAfter:110,energyUpdatedAt:1000,respawnSeconds:120});
 for(const patch of [{hp:0},{hp:241},{respawn_at:1001}])assert.equal(evaluateMonsterHunt({...request,monster:{...monster,...patch}}).code,"MONSTER_UNAVAILABLE");
 assert.equal(evaluateMonsterHunt({...request,monster:{...monster,map_region:2}}).code,"REALM_MISMATCH");
 assert.equal(evaluateMonsterHunt({...request,monster:{...monster,generation:0}}).code,"INVALID_MONSTER");
 assert.equal(evaluateMonsterHunt({...request,monster:{...monster,level:2}}).code,"INVALID_LEVEL");
 assert.equal(evaluateMonsterHunt({...request,energyRow:{energy:9,updated_at:1000}}).code,"INSUFFICIENT_ENERGY");
 assert.equal(evaluateMonsterHunt({...request,energyRow:{energy:9,updated_at:700}}).energyAfter,0);
});
