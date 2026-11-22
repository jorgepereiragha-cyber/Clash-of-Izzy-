import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {marchSlots} from "../march-slots.js";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("até cinco filas de marcha evoluem pelo castelo e tecnologia, sem cobrança",()=>{
 assert.deepEqual(marchSlots(),{max:1,active:0,available:1});
 assert.equal(marchSlots({castleLevel:4}).max,1);
 assert.equal(marchSlots({castleLevel:5}).max,2);
 assert.equal(marchSlots({castleLevel:15}).max,3);
 assert.equal(marchSlots({castleLevel:15,militaryLevel:5}).max,4);
 assert.deepEqual(marchSlots({castleLevel:30,militaryLevel:30,active:5}),
   {max:5,active:5,available:0});
 assert.equal(marchSlots({castleLevel:30,militaryLevel:30,active:8}).available,0);
 assert.equal(marchSlots({castleLevel:9999,militaryLevel:9999}).max,5);
 assert.equal(marchSlots({castleLevel:NaN,militaryLevel:-1}).max,1);
});

test("server-side move uses no extra state batch statement or new migration",async()=>{
 const worker=await read("worker.js");
 const s=worker.slice(worker.indexOf("async function gameState(env,playerId)"),
    worker.indexOf("\nasync function gameAction"));
 const batch=s.slice(s.indexOf("const stateResults=await env.DB.batch(["),
    s.indexOf("]);",s.indexOf("const stateResults=await env.DB.batch([")));
 assert.equal(batch.split("env.DB.prepare(").length-1,15);
 assert.match(batch,/AS active_marches FROM kingdoms WHERE id=\?/);
 assert.match(s,/marchSlots:marchQueues/);
 const action=worker.slice(worker.indexOf('}else if(type==="march"){'),
    worker.indexOf('}else if(type==="battle"){'));
 assert.match(action,/const slots=marchSlots/);
 assert.match(action,/status='marching'\)<\?/);
 assert.match(action,/slots\.max/);
 assert.ok(action.indexOf("status='marching')<?")<action.indexOf("INSERT INTO marches("));
 assert.match(action,/withinMarchCapacity\(selected,capacity\.maximum\)/);
 assert.doesNotMatch(action,/INSERT INTO marches[^\n]*commander_hero_key/);
});

test("map offers four editable quick formations and disables occupied queues",async()=>{
 const [ui,html,ignore]=await Promise.all([
  read("world-map.js"),read("world.html"),read(".assetsignore")
 ]);
 for(const key of ["presetGather","presetBalanced","presetFill","presetClear"]){
  assert.ok(ui.includes('"' + key + '"'));
  assert.ok(html.includes('id="' + key + '"'));
 }
 assert.match(ui,/function applyMarchPreset\(mode\)/);
 assert.match(ui,/Math\.min\(10000,Math\.floor\(Number\(x\.quantity\)\)\)/);
 assert.match(ui,/marchSlots\?\.available/);
 assert.match(ui,/Todas as filas de marcha estão ocupadas/);
 assert.ok(ignore.split(/\r?\n/).includes("march-slots.js"));
});
