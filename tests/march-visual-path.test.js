import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {marchVisualProgress,marchVisualPoint,planMarchFormation,readMarchComposition,planMarchRepresentatives} from "../scripts/march-visual-path.js";
test("march uses server timing and clamps at endpoints",()=>{
 assert.equal(marchVisualProgress(50,100,200),0);
 assert.equal(marchVisualProgress(150,100,200),.5);
 assert.equal(marchVisualProgress(250,100,200),1);
 assert.equal(marchVisualProgress(150,NaN,200),0);
 assert.equal(marchVisualProgress(150,200,100),0);
});
test("march follows rendered home rather than throne",()=>{
 const home={x:13,z:-11},target={x:-5,z:7};
 assert.deepEqual(marchVisualPoint(home,target,0),{...home,heading:-Math.PI/4});
 assert.deepEqual(marchVisualPoint(home,target,.5),{x:4,z:-2,heading:-Math.PI/4});
 assert.deepEqual(marchVisualPoint(home,target,1),{...target,heading:-Math.PI/4});
});
test("soldiers are attached, and road and march share visual path",async()=>{
 const src=await readFile(new URL("../world-map-3d.js",import.meta.url),"utf8");
 assert.match(src,/parent\.add\(soldier\)/);
 assert.match(src,/const origin=visualHome\(\)/);
 assert.match(src,/marchVisualPoint\(origin/);
 assert.match(src,/!reduceMotion && quality!=="low"/);
});

test("march formations identify orders and keep the existing GPU representative budget",()=>{
 for(const tier of ["low","balanced","high"]){
  const attack=planMarchFormation("attack",tier),gather=planMarchFormation("gather",tier),scout=planMarchFormation("scout",tier);
  assert.equal(attack.color,"red");assert.equal(gather.color,"green");assert.equal(scout.color,"gold");
  for(const f of [attack,gather,scout,planMarchFormation("unknown",tier)]){
   assert.ok(f.positions.length>0&&f.positions.length<=(tier==="low"?2:3));
   assert.equal(new Set(f.positions.map(p=>p.join(","))).size,f.positions.length);
   assert.ok(f.positions.every(p=>p.length===2&&p.every(Number.isFinite)));
  }
  assert.ok(gather.positions.every(p=>p[0]===0));
 }
 assert.notDeepEqual(planMarchFormation("attack").positions,planMarchFormation("gather").positions);
});
test("castle faction pennant stays independent of equipped cosmetic skin",async()=>{
 const src=await readFile(new URL("../world-map-3d.js",import.meta.url),"utf8");
 assert.match(src,/color==="enemy"\?shared\.enemy:shared\.banner,\.82,5\.27\+rise,0/);
 assert.match(src,/planMarchFormation\(march\.march_type, quality\)/);
});

test("march composition accepts only canonical positive server unit counts",()=>{
 assert.deepEqual(readMarchComposition('{"archer":12,"knight":3,"mage":0,"ram":-1,"__proto__":5,"unknown":10}'),[{type:"archer",count:12},{type:"knight",count:3}]);
 for(const bad of [null,"bad","[]",{"archer":"10"},{"archer":1.2},{"archer":Infinity}])assert.deepEqual(readMarchComposition(bad),[]);
 assert.deepEqual(planMarchRepresentatives('{"ram":1,"archer":10,"knight":2}',3),["archer","knight","ram"]);
 assert.deepEqual(planMarchRepresentatives('{"mage":1}',3),["mage"]);
 assert.equal(planMarchRepresentatives('{"militia":999999}',100).length,3);
});
test("march state invalidates only when canonical composition changes",async()=>{
 const {worldVisualKeys}=await import("../scripts/world-map-visual-state.js");
 const a={territories:[],marches:[{id:1,status:"marching",arrives_at:"2026-11-26T02:00:00Z",units_json:'{"archer":2,"mage":1}'}]};
 const change=units_json=>worldVisualKeys({...a,marches:[{...a.marches[0],units_json}]});
 assert.equal(worldVisualKeys(a).marches,change('{"mage":1,"archer":2}').marches);
 assert.notEqual(worldVisualKeys(a).marches,change('{"mage":1,"archer":3}').marches);
});
