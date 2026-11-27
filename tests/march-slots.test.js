import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
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


test("atomic dispatch refuses stale ownership, realm, throne, castle and gather resource without troop debit",async()=>{
 const worker=await read("worker.js");
 const action=worker.slice(worker.indexOf('}else if(type==="march"){'),worker.indexOf('}else if(type==="battle"){'));
 const debit=action.match(/const debit=env\.DB\.prepare\("([^"\n]+)"\)/)?.[1];
 assert.ok(debit,"extract exact worker troop debit SQL");
 const db=new DatabaseSync(":memory:");
 try{
  db.exec("CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,map_region INTEGER); CREATE TABLE world_territories(id INTEGER PRIMARY KEY,map_region INTEGER,territory_kind TEXT,territory_key TEXT,owner_kingdom_id INTEGER,resource_type TEXT); CREATE TABLE army_units(kingdom_id INTEGER,tier INTEGER,unit_type TEXT,quantity INTEGER); CREATE TABLE marches(kingdom_id INTEGER,status TEXT); INSERT INTO kingdoms VALUES(1,1); INSERT INTO army_units VALUES(1,1,'militia',100),(1,1,'archer',100); INSERT INTO world_territories VALUES(10,1,'resource','forest_10',NULL,'wood');");
  const units=JSON.stringify({militia:10,archer:20});
  const reset=()=>db.exec("UPDATE kingdoms SET map_region=1; DELETE FROM world_territories; INSERT INTO world_territories VALUES(10,1,'resource','forest_10',NULL,'wood'); UPDATE army_units SET quantity=100; DELETE FROM marches");
  const cases=[
   ["attack", "",true],["scout","",true],["gather","",true],
   ["attack","UPDATE world_territories SET owner_kingdom_id=1",false],
   ["attack","UPDATE world_territories SET owner_kingdom_id=2",false],
   ["scout","UPDATE world_territories SET owner_kingdom_id=2",false],
   ["gather","UPDATE world_territories SET owner_kingdom_id=2",false],
   ["gather","UPDATE world_territories SET owner_kingdom_id=1",true],
   ["scout","UPDATE world_territories SET owner_kingdom_id=1",true],
   ["attack","UPDATE world_territories SET territory_kind='castle'",false],
   ["gather","UPDATE world_territories SET territory_kind='throne'",false],
   ["attack","UPDATE world_territories SET territory_key='royal_throne_1'",false],
   ["gather","UPDATE world_territories SET resource_type=NULL",false],
   ["gather","UPDATE world_territories SET resource_type='gold'",false],
   ["scout","UPDATE world_territories SET resource_type=NULL",true],
   ["scout","UPDATE kingdoms SET map_region=2",false],
   ["gather","UPDATE world_territories SET map_region=2",false],
   ["attack","DELETE FROM world_territories",false],
   ["attack","INSERT INTO marches VALUES(1,'marching')",false],
   ["attack","UPDATE army_units SET quantity=5 WHERE unit_type='archer'",false]
  ];
  for(const [kind,mutation,allowed] of cases){
   reset();if(mutation)db.exec(mutation);
   const before=db.prepare("SELECT quantity FROM army_units ORDER BY unit_type").all().map(r=>r.quantity);
   const out=db.prepare(debit).run(units,1,units,units,1,2,1,1,1,10,kind,kind,kind);
   assert.equal(Number(out.changes),allowed?2:0,kind+" "+mutation);
   const after=db.prepare("SELECT quantity FROM army_units ORDER BY unit_type").all().map(r=>r.quantity);
   assert.deepEqual(after,allowed?[80,90]:before,kind+" "+mutation);
  }
 }finally{db.close()}
});
