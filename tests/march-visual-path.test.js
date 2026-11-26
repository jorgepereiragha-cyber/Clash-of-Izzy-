import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {marchVisualProgress,marchVisualPoint} from "../scripts/march-visual-path.js";
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
