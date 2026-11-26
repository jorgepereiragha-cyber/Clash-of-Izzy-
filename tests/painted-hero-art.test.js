import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url));
test("painted portraits are local, unique, attributed and retain vector fallback",async()=>{
 const [client,ui,credits,css]=await Promise.all(["equipment-system.js","equipment-ui.html","assets/art/heroes/flare/CREDITS.md","styles/skin-art.css"].map(async p=>(await read(p)).toString()));
 const keys=["soldado_basico","capitao_espada","mestre_arco","arqueiro_comum","joana_darc"];
 const distinct=new Set();
 for(const key of keys){const data=await read("assets/art/heroes/flare/"+key+".png");assert.equal(data.subarray(1,4).toString(),"PNG");assert.equal(data.readUInt32BE(16),320);assert.equal(data.readUInt32BE(20),320);assert.ok(!distinct.has(data.toString("base64")));distinct.add(data.toString("base64"));assert.ok(client.includes('"'+key+'"'));}
 assert.match(client,/paintedHeroPortrait\(hero,portrait\)/);
 assert.match(client,/img\.addEventListener\("error",\(\)=>img\.remove\(\)/);
 assert.match(css,/\.coi-painted-portrait\.is-loaded>svg\{visibility:hidden\}/);
 assert.match(ui,/CC BY-SA 3\.0/);assert.match(credits,/Justin Nichol/);
});
