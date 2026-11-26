import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("city fallback illustrations cover all sixteen buildings with local SVG symbols",async()=>{
const svg=await readFile(new URL("../assets/art/buildings/icons.svg",import.meta.url),"utf8");
const html=await readFile(new URL("../kingdom.html",import.meta.url),"utf8");
const types=["castle","barracks","farm","quarry","lumber_mill","iron_mine","market","academy","wall","hospital","watchtower","stable","archery_range","siege_workshop","embassy","warehouse"];
for(const type of types)assert.ok(svg.includes('id="'+type+'"'),type);
assert.match(html,/cityBuildingArt\(b\.building_type,emoji\)/);
assert.ok(html.includes("/assets/art/buildings/icons.svg#"));
assert.ok(!svg.includes("http://")||svg.includes("http://www.w3.org/2000/svg"));
});
