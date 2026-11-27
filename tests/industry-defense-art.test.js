import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DEFENSE_CATALOG} from "../city-defense-rules.js";
import {resolveEntity2DAsset} from "../scripts/kingdom-2d-art-atlas.js";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("industry and defense art is local, canonical and present",async()=>{
 const m=JSON.parse(await read("assets/3d/manifest.json")),svg=await read("assets/art/buildings/industry-defense.svg");
 for(const id of ["mill","bakery",...Object.keys(DEFENSE_CATALOG).map(k=>"defense_"+k)]){
  const a=resolveEntity2DAsset(m,"buildings",id);assert.equal(a.src,"/assets/art/buildings/industry-defense.svg#"+id);assert.ok(svg.includes('id="'+id+'"'));
 }
 assert.equal(resolveEntity2DAsset(m,"buildings","defense_unknown"),null);
 const ui=await read("scripts/kingdom-4x-systems.js");assert.ok(ui.includes("addArt(button,kind"));assert.ok(ui.includes("drawArt(defenseArt(d.defense_type)"));assert.ok(ui.includes('type:"industry_upgrade"'));assert.ok(ui.includes('type:"city_defense_place"'));
});
