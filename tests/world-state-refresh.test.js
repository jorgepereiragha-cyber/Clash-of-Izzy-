import test from "node:test";
import assert from "node:assert/strict";
import {createWorldRefreshGate} from "../scripts/world-state-refresh.js";
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
test("old polling cannot revert a newer action snapshot",async()=>{
 const gate=createWorldRefreshGate(),old=deferred(),seen=[];
 const first=gate.run(()=>old.promise,x=>seen.push(x),{background:true});
 gate.invalidate();
 assert.equal(await gate.run(async()=>({marches:1}),x=>seen.push(x)),true);
 old.resolve({marches:0});
 assert.equal(await first,false);
 assert.deepEqual(seen,[{marches:1}]);
});
test("background updates are deduplicated while a request is pending",async()=>{
 const gate=createWorldRefreshGate(),d=deferred();let calls=0;
 const first=gate.run(()=>{calls++;return d.promise},()=>{},{background:true});
 assert.equal(await gate.run(()=>{calls++;return 2},()=>{},{background:true}),false);
 d.resolve(1);assert.equal(await first,true);assert.equal(calls,1);
 assert.equal(await gate.run(async()=>3,()=>{},{background:true}),true);
});
test("stale errors ignored but current network failures propagate",async()=>{
 const gate=createWorldRefreshGate(),d=deferred();
 const old=gate.run(()=>d.promise,()=>{});
 gate.invalidate();d.reject(new Error("old"));
 assert.equal(await old,false);
 await assert.rejects(gate.run(async()=>{throw new Error("network")},()=>{}),/network/);
 assert.equal(await gate.run(async()=>1,()=>{}),true);
});

test("a delayed throne poll cannot overwrite the post-assault status",async()=>{
 const gate=createWorldRefreshGate(),old=deferred(),seen=[];
 const poll=gate.run(()=>old.promise,x=>seen.push(x),{background:true});
 gate.invalidate();
 await gate.run(async()=>({realmId:1,phase:"contest",owner:"new"}),x=>seen.push(x));
 old.resolve({realmId:1,phase:"contest",owner:"old"});
 assert.equal(await poll,false);
 assert.deepEqual(seen,[{realmId:1,phase:"contest",owner:"new"}]);
});
test("changing realms invalidates an in-flight throne response",async()=>{
 const gate=createWorldRefreshGate(),old=deferred(),seen=[];
 const poll=gate.run(()=>old.promise,x=>seen.push(x),{background:true});
 gate.invalidate();
 old.resolve({realmId:1});
 assert.equal(await poll,false);
 assert.deepEqual(seen,[]);
});
