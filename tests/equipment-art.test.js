import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("equipment art only uses unique bounded cells for existing canonical equipment keys",async()=>{
 const [client,worker,ui,css,credit]=await Promise.all([read("equipment-system.js"),read("worker.js"),read("equipment-ui.html"),read("equipment-styles.css"),read("assets/art/equipment/CREDITS.md")]);
 const atlas=await readFile(new URL("../assets/art/equipment/flare-variations.png",import.meta.url));
 assert.equal(atlas.toString("hex",0,8),"89504e470d0a1a0a");
 const width=atlas.readUInt32BE(16),height=atlas.readUInt32BE(20);
 assert.equal(width,895);assert.equal(height,515);
 const cells=JSON.parse(client.match(/const equipmentArtCells=Object.freeze\(([^\n]+)\);/)[1]);
 const catalog=worker.split("const EQUIPMENT_CATALOG={")[1].split("\n};")[0];
 assert.equal(Object.keys(cells).length,11);
 assert.equal(new Set(Object.values(cells).map(JSON.stringify)).size,11);
 for(const [id,[x,y]] of Object.entries(cells)){
  assert.ok(catalog.includes(id+":{"),id);
  assert.ok(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x+60<=width&&y+60<=height,id);
 }
 assert.match(client,/Object.hasOwn\(equipmentArtCells,item.id\)/);
 assert.match(client,/equipmentArt\(stage\)/);assert.match(client,/artRoot.replaceChildren/);
 assert.match(ui,/id="coi-equipped-art"/);assert.match(css,/background-size:895px 515px/);assert.match(credit,/CC0 1.0/);
});
