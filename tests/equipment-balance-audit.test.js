import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {enhancedStats} from "../equipment-enhancement.js";
test("legendary primary attributes and all equipment levels are bounded and monotonic",async()=>{
 const w=await readFile(new URL("../worker.js",import.meta.url),"utf8");
 // The catalogue is a trusted static literal in the checked-out code, not user input.
 const data=new Function(w.slice(w.indexOf("const EQUIPMENT_CATALOG="),w.indexOf("const EQUIPMENT_PROGRESSION="))+";return EQUIPMENT_CATALOG;")();
 assert.equal(Object.keys(data).length,21);
 const max=k=>enhancedStats(data[k],data[k].maxLevel,10);
 assert.ok(max("coroa_izzy").defense>=max("runic_helm").defense);
 assert.ok(max("aegis_asgard").defense>=max("warden_plate").defense);
 assert.ok(max("asgardian_greaves").march>=max("storm_boots").march);
 assert.ok(max("valkyrie_charm").attack>=max("moon_charm").attack);
 for(const d of Object.values(data)){
  let previous=enhancedStats(d,1,0);
  for(let level=1;level<=d.maxLevel;level++){
   const now=enhancedStats(d,level,0);
   for(const key of Object.keys(now))assert.ok(Number.isFinite(now[key])&&now[key]>=previous[key]);
   assert.ok(Object.entries(enhancedStats(d,level,10)).every(([key,v])=>v>=now[key]));
   previous=now;
  }
 }
});
