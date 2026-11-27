import test from "node:test";
import assert from "node:assert/strict";
import { simulateCastlePvp } from "../game-adapter.js";
const unit=(unit_type,quantity,tier=1)=>({unit_type,tier,quantity});
test("PvP requires two explicit authoritative formations",()=>{
 assert.throws(()=>simulateCastlePvp({attackerArmy:[unit("militia",20)]}));
 assert.throws(()=>simulateCastlePvp({attackerArmy:[],defenderArmy:[]}));
 assert.throws(()=>simulateCastlePvp({attackerArmy:[unit("militia",20)],defenderArmy:[unit("invalid",20)]}));
 assert.throws(()=>simulateCastlePvp({attackerArmy:[unit("militia",20)],defenderArmy:[unit("militia",200001)]}));
});
test("empty verified garrison has no synthetic defenders or casualties",()=>{
 const result=simulateCastlePvp({attackerArmy:[unit("militia",20)],defenderArmy:[]});
 assert.equal(result.winner,"attacker");assert.equal(result.rounds,0);
 assert.deepEqual(result.defender,[]);
 assert.equal(result.attacker[0].survivors,20);
});
test("real garrisons determine the outcome and per-tier casualties conserve quantities",()=>{
 const attackerArmy=[unit("militia",10),unit("militia",20,2),unit("militia",5)];
 const weak=simulateCastlePvp({attackerArmy,defenderArmy:[unit("militia",1)]});
 const strong=simulateCastlePvp({attackerArmy,defenderArmy:[unit("knight",10000,3)]});
 assert.equal(weak.winner,"attacker");assert.equal(strong.winner,"defender");
 for(const result of [weak,strong]){
  assert.ok(result.rounds<=30);
  for(const stack of [...result.attacker,...result.defender]){
   assert.equal(stack.survivors+stack.losses,stack.initialQuantity);
   assert.ok(stack.losses>=0&&stack.survivors>=0);
  }
  assert.equal(result.attacker.find(s=>s.tier===1).initialQuantity,15);
  assert.equal(result.attacker.find(s=>s.tier===2).initialQuantity,20);
 }
 assert.deepEqual(strong,simulateCastlePvp({attackerArmy:[...attackerArmy].reverse(),defenderArmy:[unit("knight",10000,3)]}));
});
