import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {shouldForceWorld2D,createWorldFpsMonitor} from "../scripts/world-map-performance.js";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("low-memory devices use existing 2D fallback without WebGL; unknown memory is not misclassified",()=>{
  assert.equal(shouldForceWorld2D({deviceMemory:2,hardwareConcurrency:8}),true);
  assert.equal(shouldForceWorld2D({deviceMemory:3,hardwareConcurrency:4}),true);
  assert.equal(shouldForceWorld2D({deviceMemory:3,hardwareConcurrency:8}),false);
  assert.equal(shouldForceWorld2D({deviceMemory:4,hardwareConcurrency:2}),false);
  assert.equal(shouldForceWorld2D({hardwareConcurrency:2}),false);
  assert.equal(shouldForceWorld2D({deviceMemory:0,hardwareConcurrency:2}),false);
});

function feed(monitor,msPerFrame,totalFrames){
  const hits=[];
  for(let i=1;i<=totalFrames;i++){const next=monitor.sample(1000+i*msPerFrame);if(next!==null)hits.push(next);}
  return hits;
}
test("sustained <22 FPS for 3s downgrades once rather than reacting to one slow frame",()=>{
  const monitor=createWorldFpsMonitor();
  const hits=feed(monitor,50,70);
  assert.equal(hits.length,1);
  assert.ok(hits[0]>=19.5 && hits[0]<=20.5);
});
test("high FPS, short bursts and background gaps do not trigger false downgrades",()=>{
  assert.deepEqual(feed(createWorldFpsMonitor(),16.7,225),[]);
  assert.deepEqual(feed(createWorldFpsMonitor(),50,15),[]);
  const monitor=createWorldFpsMonitor();
  for(let i=0;i<40;i++)monitor.sample(1000+i*16.7);
  assert.equal(monitor.sample(10000),null,"background pause resets samples");
  assert.deepEqual(Array.from({length:20},(_,i)=>monitor.sample(10016.7+i*16.7)).filter(x=>x!==null),[]);
  monitor.reset();
  assert.deepEqual(feed(monitor,16.7,200),[]);
});
test("3D boot retains 2D preference and dynamically imports 3D only after page load and visibility",async()=>{
  const boot=await read("scripts/world-map-visual-boot.js");
  const html=await read("world.html");
  const scene=await read("world-map-3d.js");
  const sw=await read("sw.js");
  assert.match(boot,/choice === "2d"/);
  assert.match(boot,/shouldForceWorld2D/);
  assert.match(boot,/document\.readyState === "complete"/);
  assert.match(boot,/new IntersectionObserver/);
  assert.match(boot,/await import\("\/world-map-3d\.js"\)/);
  assert.match(boot,/coi:quality-downgraded/);
  assert.match(html,/force-2d-map #world3d/);
  assert.match(scene,/quality = "low"/);
  assert.match(scene,/renderer\.shadowMap\.enabled = false/);
  assert.match(scene,/fpsMonitor\.sample\(timestamp\)/);
  assert.match(scene,/worldSunLight\.castShadow = false/);
  assert.match(scene,/resize\(\)/);
  assert.match(sw,/world-map-performance\.js/);
  assert.match(sw,/clash-of-izzy-shell-v59/);
});
