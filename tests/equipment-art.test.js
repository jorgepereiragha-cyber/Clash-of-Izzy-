import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("reviewed equipment regions are unique, local and bounded by the PNG",async()=>{
 const [client,worker,html,css,credits,png]=await Promise.all([read("equipment-system.js"),read("worker.js"),read("equipment-ui.html"),read("equipment-styles.css"),read("assets/art/equipment/CREDITS.md"),readFile(new URL("../assets/art/equipment/flare-variants.png",import.meta.url))]);
 assert.equal(png.readUInt32BE(16),895);assert.equal(png.readUInt32BE(20),515);
 const map=JSON.parse(client.match(/const equipmentArt=Object\.freeze\((\{[^\n]+\})\);/)[1]);
 assert.equal(Object.keys(map).length,12);assert.equal(new Set(Object.values(map).map(String)).size,12);
 for(const [id,[col,row]] of Object.entries(map)){assert.ok(worker.includes(id+':{name:'));assert.ok(Number.isInteger(col)&&Number.isInteger(row)&&col>=0&&row>=0&&col*64+63<=895&&row*64+64<=515);}
 assert.match(html,/id="equipment-art-preview"/);assert.match(client,/appendEquipmentArt\(card,stage\)/);assert.match(client,/appendEquipmentArt\(card,item\)/);assert.match(css,/\/assets\/art\/equipment\/flare-variants\.png/);assert.match(credits,/CC0/);
});
