import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("all canonical equipment has unique local art and rejects unknown keys",async()=>{
 const [worker,helper,client,ui]=await Promise.all(["worker.js","scripts/skin-art.js","equipment-system.js","equipment-ui.html"].map(read));
 const ids=[...worker.match(/const EQUIPMENT_CATALOG=\{([\s\S]*?)\n\};/)[1].matchAll(/^\s*(\w+):\{name:/gm)].map(m=>m[1]);assert.equal(ids.length,21);
 const symbols=new Map(),paths=new Set();for(const group of ["weapons-helms","armor-boots","accessories-boots"]){const svg=await read("assets/art/equipment/"+group+".svg");assert.match(svg,/Icons made by Lorc, CC BY 3.0/);for(const [,id,body] of svg.matchAll(/<symbol id="([^"]+)"[^>]*>(.*?)<\/symbol>/g)){assert.ok(!symbols.has(id));assert.ok(!paths.has(body));paths.add(body);symbols.set(id,group);}}
 assert.deepEqual([...symbols.keys()].sort(),ids.sort());
 function node(){return {attrs:{},style:{setProperty(){}},setAttribute(k,v){this.attrs[k]=v},append(...children){this.children=children}}}
 const window={};vm.runInNewContext(helper,{window,document:{createElementNS:node}});for(const id of ids){const art=window.COI_SKIN_ART.createEquipment({id,name:id,rarity:"raro"},false);assert.equal(art.children[0].attrs.href,"/assets/art/equipment/"+symbols.get(id)+".svg#"+id);}
 for(const id of ["__proto__","../x",null])assert.equal(window.COI_SKIN_ART.createEquipment({id}),null);
 assert.match(client,/createEquipment\(stage\)/);assert.match(client,/createEquipment\(item\)/);assert.match(ui,/id="selected-equipment-art"/);
});

test("eight inspected painted CC0 gear illustrations use unique valid local PNGs and a vector fallback",async()=>{
 const {createHash}=await import("node:crypto");const helper=await read("scripts/skin-art.js");const ids=JSON.parse(helper.match(/const paintedEquipmentIds=new Set\((\[[^\n]+\])\)/)[1]);assert.equal(ids.length,8);const hashes=new Set();const credits=await read("assets/art/equipment/CREDITS.md");
 const window={};const node=()=>({style:{setProperty(){}},setAttribute(){},append(){},addEventListener(){}});vm.runInNewContext(helper,{window,document:{createElement:node,createElementNS:node}});
 for(const id of ids){const data=await readFile(new URL("../assets/art/equipment/"+id+".png",import.meta.url));assert.equal(data.subarray(0,8).toString("hex"),"89504e470d0a1a0a");const size=id==="leather_armor"?60:64;assert.equal(data.readUInt32BE(16),size);assert.equal(data.readUInt32BE(20),size);const hash=createHash("sha256").update(data).digest("hex");assert.ok(!hashes.has(hash));hashes.add(hash);assert.ok(credits.includes(id));const img=window.COI_SKIN_ART.createEquipment({id,name:id});assert.equal(img.src,"/assets/art/equipment/"+id+".png");}
 assert.match(helper,/createEquipment\(item,false\)/);assert.match(credits,/CC0/);
});
