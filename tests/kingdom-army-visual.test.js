import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { UNIT_STYLES, planArmyFigures } from "../scripts/kingdom-army-visual.js";
test("all 11 trainable types can appear and invalid rows never create figures", async()=>{
 const worker=await readFile(new URL("../worker.js",import.meta.url),"utf8");
 const catalog=worker.slice(worker.indexOf("const UNITS = {"),worker.indexOf("// Recebedor Pix"));
 for(const type of Object.keys(UNIT_STYLES)) assert.match(catalog,new RegExp("\\b"+type+":"));
 assert.equal(Object.keys(UNIT_STYLES).length,11);
 const rows=Object.keys(UNIT_STYLES).map(unit_type=>({unit_type,quantity:1}));
 assert.deepEqual(new Set(planArmyFigures(rows,"high").map(x=>x.type)),new Set(Object.keys(UNIT_STYLES)));
 assert.deepEqual(planArmyFigures([null,{unit_type:"constructor",quantity:10},{unit_type:"archer",quantity:Infinity},{unit_type:"mage",quantity:-1},{unit_type:"ram",quantity:0}]),[]);
});
test("formation is deterministic, representative and capped independently of army size",()=>{
 const rows=Object.keys(UNIT_STYLES).map(unit_type=>({unit_type,quantity:10000000}));
 for(const [tier,limit] of [["low",4],["balanced",8],["high",12]]){
  const a=planArmyFigures(rows,tier);
  assert.equal(a.length,limit);
  assert.deepEqual(a,planArmyFigures([...rows].reverse(),tier));
  assert.equal(new Set(a.slice(0,Math.min(limit,11)).map(x=>x.type)).size,Math.min(limit,11));
  assert.ok(a.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.z)));
 }
 assert.equal(planArmyFigures([{unit_type:"archer",quantity:1}]).length,1);
});
test("procedural resources are disposed without disposing shared GLB templates",async()=>{
 const renderer=await readFile(new URL("../scripts/kingdom-3d.js",import.meta.url),"utf8");
 assert.match(renderer,/if \(instance.procedural\) disposeDetachedObject3D\(instance.root\)/);
 assert.match(renderer,/instance.mixer\?\.uncacheRoot/);
 assert.match(renderer,/createProceduralUnit\(THREE, entry.type/);
});


test("troop animation phases are stable, distinct and disabled for reduced motion",async()=>{
  const {troopAnimationPhase}=await import("../scripts/kingdom-army-visual.js");
  const phases=Array.from({length:12},(_,i)=>troopAnimationPhase(i,2));
  assert.equal(new Set(phases).size,12);
  assert.ok(phases.every(x=>x>=0&&x<2));
  assert.deepEqual(phases,Array.from({length:12},(_,i)=>troopAnimationPhase(i,2)));
  assert.equal(troopAnimationPhase(4,2,true),0);
  assert.equal(troopAnimationPhase(4,0),0);
  assert.equal(troopAnimationPhase(-1,2),0);
});
