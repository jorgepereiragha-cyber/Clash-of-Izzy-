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

test("march path shares home castle origin and caches its curve and vectors",async()=>{
 const scene=await read("world-map-3d.js");
 assert.match(scene,/function marchPath\(target,arrivalHeight/);assert.match(scene,/homeCastleGroup\?\.position/);
 assert.match(scene,/const curve = marchPath\(territory,\.12\)/);
 assert.match(scene,/if\(!march\.curve\)march\.curve=marchPath\(target\)/);
 assert.match(scene,/getPoint\(progress,march\.point\)/);assert.match(scene,/getTangent\(progress,march\.tangent\)/);
 assert.match(scene,/moving=!reduceMotion&&quality!=="low"&&progress>0&&progress<1/);
});
