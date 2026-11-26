import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("all catalog cosmetic IDs use one unique local SVG symbol, including original pantheon relics",async()=>{
 const [worker,helper,sets]=await Promise.all([read("worker.js"),read("scripts/skin-art.js"),read("skin-sets.js")]);
 const standard=[...worker.match(/const COSMETIC_SKINS=\{([\s\S]*?)\n\};/)[1].matchAll(/^\s*([creln]\d+):\{/gm)].map(m=>m[1]);
 const season=[...worker.match(/const SEASONAL_COSMETICS=\[([\s\S]*?)\n\];/)[1].matchAll(/id:"(s\d+)"/g)].map(m=>m[1]);
 const fused=[...worker.match(/const SKIN_FUSIONS=\[([\s\S]*?)\n\];/)[1].matchAll(/id:"(f_[a-z]+)"/g)].map(m=>m[1]);
 const relics=[...sets.matchAll(/\{ id: "([^"]+)", name: "[^"]+", slot:/g)].map(m=>m[1]);
 assert.equal(standard.length,26);assert.equal(season.length,6);assert.equal(fused.length,6);assert.equal(relics.length,20);
 const expected=[...standard,...season,...fused,...relics,...Array.from({length:6},(_,i)=>"castle-"+(i+1))];
 const symbols=new Map();
 for(const group of ["common","rare-epic","legendary-fusion","norse","seasonal","pantheon-relics","castle-previews"]){
  const svg=await read("assets/art/skins/"+group+".svg");
  if(!["pantheon-relics","castle-previews"].includes(group))assert.match(svg,/Icons made by Lorc, CC BY 3.0/);
  for(const [,id] of svg.matchAll(/<symbol id="([^"]+)"/g)){assert.ok(!symbols.has(id),id);symbols.set(id,group);}
 }
 assert.deepEqual([...symbols.keys()].sort(),expected.sort());
 function node(){return {attrs:{},style:{setProperty(){}},setAttribute(k,v){this.attrs[k]=v},append(...children){this.children=children}}}
 const window={};
 vm.runInNewContext(helper,{window,document:{createElementNS:node}});
 for(const id of expected){const art=window.COI_SKIN_ART.create(id,id);assert.equal(art.children[0].attrs.href,"/assets/art/skins/"+symbols.get(id)+".svg#"+id);}
 for(const id of ["castle-7","__proto__","https://example.com","../x",null])assert.equal(window.COI_SKIN_ART.create(id,id),null);
});
test("existing purchase, equip and fusion paths remain connected to illustrated cards",async()=>{
 const [arena,equip,kingdom,client]=await Promise.all([read("arena.html"),read("equipment-ui.html"),read("kingdom.html"),read("equipment-system.js")]);
 for(const page of [arena,equip,kingdom])assert.match(page,/src="\/scripts\/skin-art\.js"/);
 assert.match(arena,/type:'cosmetic_buy',skin:id/);
 assert.match(arena,/type:'seasonal_buy',skin:skin\.id/);
 assert.match(arena,/type:'skin_fuse',inputs:recipe\.inputs/);
 assert.match(arena,/COI_SKIN_ART\?\.create\(item\.id,item\.name\)/);
 assert.match(client,/COI_SKIN_ART\?\.create\(id,skin\.name\)/);
 assert.match(kingdom,/COI_SKIN_ART\?\.create\("castle-"\+Number\(skin\.id\),skin\.name\)/);
});
