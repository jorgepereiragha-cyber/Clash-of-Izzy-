import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectKingdomQualityProfile } from "../scripts/kingdom-quality.js";
import {
  GRAPHICS_STORAGE_KEY, GRAPHICS_OPTIONS, normalizeGraphicsChoice,
  readGraphicsChoice, persistGraphicsChoice, graphicsChoiceLabel
} from "../scripts/kingdom-visual-preferences.js";

test("graphics preferences are bounded and never persist unknown values", () => {
  assert.equal(GRAPHICS_STORAGE_KEY, "coi_graphics_preference");
  assert.deepEqual([...GRAPHICS_OPTIONS], ["auto", "low", "balanced", "high", "2d"]);
  const map = new Map();
  const store = {getItem: key => map.get(key) ?? null, setItem: (key,value) => map.set(key,value)};
  assert.equal(readGraphicsChoice(store), "auto");
  assert.equal(persistGraphicsChoice(store,"2d"), true);
  assert.equal(readGraphicsChoice(store), "2d");
  assert.equal(persistGraphicsChoice(store,"../../../admin"), false);
  assert.equal(readGraphicsChoice(store), "2d");
  assert.equal(normalizeGraphicsChoice(undefined), "auto");
  assert.equal(graphicsChoiceLabel("balanced"), "Equilibrado");
  assert.equal(readGraphicsChoice({getItem(){throw Error("blocked")}}), "auto");
  assert.equal(persistGraphicsChoice({setItem(){throw Error("blocked")}}, "high"), false);
});

test("manual quality respects GPU, Data Saver and reduced motion safety gates", () => {
  const strong = {deviceMemory:12,hardwareConcurrency:12,viewportWidth:390,maxTextureSize:16384};
  const low = selectKingdomQualityProfile({...strong,preferredTier:"low"});
  const balanced = selectKingdomQualityProfile({...strong,preferredTier:"balanced"});
  const high = selectKingdomQualityProfile({...strong,preferredTier:"high"});
  assert.equal(low.tier,"low");
  assert.equal(low.shadows,false);
  assert.equal(balanced.tier,"balanced");
  assert.equal(high.tier,"high");
  assert.equal(high.shadows,true);
  assert.ok(low.maxPixelCount < balanced.maxPixelCount);
  assert.ok(balanced.maxPixelCount < high.maxPixelCount);
  assert.equal(selectKingdomQualityProfile({...strong,preferredTier:"high",saveData:true}).tier,"low");
  assert.equal(selectKingdomQualityProfile({deviceMemory:2,hardwareConcurrency:2,maxTextureSize:2048,preferredTier:"high"}).tier,"low");
  assert.equal(selectKingdomQualityProfile({...strong,preferredTier:"high",prefersReducedMotion:true}).prefersReducedMotion,true);
  assert.equal(selectKingdomQualityProfile({...strong,preferredTier:"invalid"}).tier,"high");
});

test("2D boot bypasses Three.js and graphics controls remain local-only", async () => {
  const boot = await readFile(new URL("../scripts/kingdom-visual-boot.js",import.meta.url),"utf8");
  const html = await readFile(new URL("../kingdom.html",import.meta.url),"utf8");
  const sw = await readFile(new URL("../sw.js",import.meta.url),"utf8");
  assert.match(boot, /if \(saved === "2d"\)/);
  assert.match(boot, /await import\("\.\/kingdom-3d\.js"\)/);
  assert.match(boot, /window\.location\.reload\(\)/);
  assert.match(boot, /persistGraphicsChoice/);
  assert.match(html, /id="coiGraphicsPreset"/);
  assert.match(html, /id="coiGraphicsApply"/);
  assert.match(html, /id="coiGraphicsStatus"/);
  assert.match(html, /scripts\/kingdom-visual-boot\.js/);
  for (const path of ["/scripts/kingdom-visual-boot.js","/scripts/kingdom-visual-preferences.js"])
    assert.ok(sw.includes('"' + path + '"'), path + " not cached in PWA");
});

test("world map honors 2D preference and avoids loading Three.js in compatibility mode", async () => {
  const world = await readFile(new URL("../world-map-visual-boot.js",import.meta.url),"utf8");
  const source = await readFile(new URL("../world-map-3d.js",import.meta.url),"utf8");
  const html = await readFile(new URL("../world.html",import.meta.url),"utf8");
  assert.match(world, /choice === "2d"/);
  assert.match(world, /await import\("\/world-map-3d\.js"\)/);
  assert.match(world, /map-3d-fallback/);
  assert.match(source, /readGraphicsChoice\(window\.localStorage\)/);
  assert.match(html, /id="worldGraphicsStatus"/);
  assert.match(html, /kingdom\.html#coiGraphicsPreset/);
});
