import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("low-memory phones force the existing 2D map before module boot", async () => {
  const html = await read("world.html");
  const boot = await read("scripts/world-map-visual-boot.js");
  assert.match(html,/navigator\.deviceMemory \|\| 4/);
  assert.match(html,/navigator\.hardwareConcurrency \|\| 4/);
  assert.match(html,/mem <= 2 \|\| \(mem <= 3 && cores <= 4\)/);
  assert.ok(html.indexOf("force-2d-map") < html.indexOf('src="/scripts/world-map-visual-boot.js"'));
  assert.match(boot,/classList\.contains\("force-2d-map"\)/);
  assert.match(boot,/choice === "2d"/);
  assert.match(boot,/useFallback\(/);
  assert.match(boot,/map-3d-fallback/);
});

test("world map 3D is imported only by one lazy boot after load and visibility", async () => {
  const html = await read("world.html");
  const boot = await read("scripts/world-map-visual-boot.js");
  assert.equal((html.match(/world-map-visual-boot\.js/g)||[]).length,1);
  assert.doesNotMatch(html,/import\(['"]\/world-map-3d\.js['"]\)/);
  assert.equal((boot.match(/await import\("\/world-map-3d\.js"\)/g)||[]).length,1);
  assert.match(boot,/window\.addEventListener\("load", deferWorld3D/);
  assert.match(boot,/new IntersectionObserver\(/);
  assert.match(boot,/observer\.disconnect\(\)/);
  assert.match(boot,/loaded \|\| loading/);
  assert.match(boot,/canvas\.dataset\.loaded = "true"/);
});

test("FPS downgrade changes actual renderer cost, not just an indicator", async () => {
  const html = await read("world.html");
  const scene = await read("world-map-3d.js");
  assert.match(scene,/let quality = mapProfile\(8192\)\.tier/);
  assert.match(scene,/function checkAndDowngradeQuality\(timestamp\)/);
  assert.ok(scene.includes("timestamp - lastFpsCheck < 3000 || fpsSamples.length < 20"));
  assert.match(scene,/avg >= 22/);
  assert.match(scene,/fpsSamples\.length > 60/);
  assert.match(scene,/delta >= 8 && delta <= 1000/);
  assert.match(scene,/quality = "low"/);
  assert.match(scene,/renderer\.shadowMap\.enabled = false/);
  assert.match(scene,/worldSunLight\.castShadow = false/);
  assert.match(scene,/resize\(\); \/\/ Reapplies the low-end pixel budget/);
  assert.match(scene,/new CustomEvent\("coi:quality-downgraded"/);
  assert.match(html,/addEventListener\('coi:quality-downgraded'/);
  assert.match(html,/Qualidade reduzida para melhor desempenho/);
});

test("existing GPU safety guards remain intact", async () => {
  const scene = await read("world-map-3d.js");
  const boot = await read("scripts/world-map-visual-boot.js");
  for (const marker of ["navigator.deviceMemory","navigator.hardwareConcurrency","saveData",
    "webglcontextlost","map-3d-fallback","sceneInViewport","stopMarchAnimation",
    "IntersectionObserver"]) assert.ok(scene.includes(marker),marker);
  assert.match(scene,/const maxPixelCount = quality === "high" \? 3200000/);
  assert.match(boot,/WebGLRenderingContext/);
});

test("storage-denied WebViews retain graphics fallback without throwing during module boot", async () => {
  const boot=await read("scripts/world-map-visual-boot.js");
  const scene=await read("world-map-3d.js");
  assert.match(boot,/let choice = "auto"/);
  assert.match(boot,/try \{ choice = readGraphicsChoice\(window\.localStorage\); \} catch/);
  assert.match(scene,/let preference = "auto"/);
  assert.match(scene,/try \{ preference = readGraphicsChoice\(window\.localStorage\); \} catch/);
});


test("map and city share hardware tier policy, including real texture limit",async()=>{
 const scene=await read("world-map-3d.js");
 assert.match(scene,/import \{ selectKingdomQualityProfile \} from "\.\/scripts\/kingdom-quality\.js"/);
 assert.match(scene,/const mapProfile = maxTextureSize => selectKingdomQualityProfile/);
 assert.match(scene,/quality = mapProfile\(renderer\.capabilities\.maxTextureSize\)\.tier/);
 const {selectKingdomQualityProfile}=await import("../scripts/kingdom-quality.js");
 assert.equal(selectKingdomQualityProfile({deviceMemory:8,hardwareConcurrency:8,maxTextureSize:2048,preferredTier:"high"}).tier,"balanced");
 assert.equal(selectKingdomQualityProfile({deviceMemory:8,hardwareConcurrency:8,maxTextureSize:1024,preferredTier:"high"}).tier,"low");
 assert.equal(selectKingdomQualityProfile({deviceMemory:12,hardwareConcurrency:12,maxTextureSize:16384,saveData:true,preferredTier:"high"}).tier,"low");
});
test("march animation never rewrites static territory label positions each frame",async()=>{
 const scene=await read("world-map-3d.js");
 const tick=scene.slice(scene.indexOf("const tick = timestamp =>"),scene.indexOf("function setWorldState"));
 assert.match(tick,/updateMarchPositions\(now\)/);
 assert.doesNotMatch(tick,/projectTerritories\(\)/);
 assert.match(scene,/function draw\(\)[\s\S]*?projectTerritories\(\)/);
});


test("world visual keys ignore resource balances but detect ownership, geometry, skins and marches",async()=>{
 const {worldVisualKeys}=await import("../scripts/world-map-visual-state.js");
 const s={kingdomId:1,castleSkinId:2,throneShielded:true,territories:[{id:7,x:2,z:3,terrain:"forest",resource_type:"wood",owner_kingdom_id:1}],marches:[]};
 const a=worldVisualKeys(s);assert.deepEqual(a,worldVisualKeys({...s,territories:[{...s.territories[0],resource_amount:400,power:999}]}));
 const changed=patch=>worldVisualKeys({...s,territories:[{...s.territories[0],...patch}]});
 assert.notEqual(a.features,changed({owner_kingdom_id:9}).features);assert.equal(a.routes,changed({owner_kingdom_id:9}).routes);
 assert.notEqual(a.routes,changed({x:4}).routes);assert.notEqual(a.features,changed({castle_skin_id:5}).features);
 assert.notEqual(a.home,worldVisualKeys({...s,castleSkinId:4}).home);
 assert.notEqual(a.features,worldVisualKeys({...s,throneShielded:false}).features);
 assert.notEqual(a.marches,worldVisualKeys({...s,marches:[{id:1,status:"marching",march_type:"attack",target_territory_id:7,started_at:"2026-01-01T00:00:00Z",arrives_at:"2026-01-01T01:00:00Z"}]}).marches);
});
test("renderer skips unchanged mesh layers and reuses territory lookup during frames",async()=>{
 const scene=await read("world-map-3d.js");
 for(const [key,fn] of [["features","rebuildTerritories"],["routes","rebuildRoads"],["marches","rebuildMarches"]])assert.ok(scene.includes("if(keys."+key+"!==previous?."+key+"){"+fn+"();"));
 assert.ok(scene.includes("territoryLookup.get(march.targetId)"));
 assert.ok(scene.includes("diagnostics: () => ({ rebuilds: {...visualRebuilds} })"));
});

test("world castle silhouettes follow the same 1/10/20/30 tier thresholds as city",async()=>{
 const {worldCastleTier,worldVisualKeys}=await import("../scripts/world-map-visual-state.js");
 assert.deepEqual([NaN,1,9,10,19,20,29,30,80].map(worldCastleTier),[1,1,1,2,2,3,3,4,4]);
 const s={castleLevel:1,territories:[{id:1,territory_kind:"castle",castle_level:9}]};const a=worldVisualKeys(s);
 assert.notEqual(a.home,worldVisualKeys({...s,castleLevel:10}).home);
 assert.notEqual(a.features,worldVisualKeys({...s,territories:[{...s.territories[0],castle_level:10}]}).features);
 assert.equal(a.routes,worldVisualKeys({...s,territories:[{...s.territories[0],castle_level:10}]}).routes);
 const scene=await read("world-map-3d.js");assert.match(scene,/territory\.castle_level \?\? territory\.level/);
 assert.match(scene,/const tier=worldCastleTier\(level\)/);
});
