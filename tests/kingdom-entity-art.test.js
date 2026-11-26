import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {HERO_TEMPLATES} from "../hero-catalog.js";
import {DRAGON_CATALOG} from "../dragon-catalog.js";
import {UNIT_STYLES} from "../scripts/kingdom-army-visual.js";
import {resolveEntity2DAsset,resolveQualityFolder,loadCachedImage,loadEntityManifest} from "../scripts/kingdom-2d-art-atlas.js";
const manifest=JSON.parse(await readFile(new URL("../assets/3d/manifest.json",import.meta.url),"utf8"));
const art=manifest.entityArt;
test("canonical 2D art index references real symbols and approved enabled GLB entries",async()=>{
 assert.equal(manifest.version,2);
 assert.deepEqual(Object.keys(art.dragons).sort(),DRAGON_CATALOG.map(x=>x.key).sort());
 assert.deepEqual(Object.keys(art.troops).sort(),Object.keys(UNIT_STYLES).sort());
 assert.deepEqual(Object.keys(art.heroes).sort(),[...Object.keys(HERO_TEMPLATES),"odin_awakened","thor_ragnarok","freya_vanir","loki_chaos","valhalla_king"].sort());
 assert.equal(Object.keys(art.heroes).length,70);
 const available=[...manifest.models,...manifest.units].filter(x=>x.enabled===true);
 for(const [category,entries] of Object.entries(art)){
   if(!["buildings","dragons","troops","heroes","resources"].includes(category))continue;
   for(const [key,entry] of Object.entries(entries)){
     for(const id of entry.webgl?.modelIds||[])assert.ok(available.some(a=>a.id===id&&manifest.files[a.src]),id);
     if(!entry.canvas2d)continue;
     const asset=resolveEntity2DAsset(manifest,category,key);
     assert.equal(asset.kind,"symbol");
     const [path,symbol]=asset.src.split("#");
     const svg=await readFile(new URL(".."+path,import.meta.url),"utf8");
     assert.ok(svg.includes('id="'+symbol+'"'),asset.src);
   }
 }
});
test("unknown IDs, unsafe URLs and nonexistent tiers never invent files",()=>{
 assert.equal(resolveQualityFolder("medium"),"balanced");
 assert.equal(resolveEntity2DAsset(manifest,"heroes","__proto__"),null);
 assert.equal(resolveEntity2DAsset(manifest,"buildings","missing"),null);
 assert.equal(resolveEntity2DAsset(manifest,"buildings","castle",{tier:99}).src,"/assets/art/buildings/icons.svg#castle");
 assert.equal(resolveEntity2DAsset({entityArt:{heroes:{a:{canvas2d:{atlas:"../x.svg",symbol:"a"}}}}},"heroes","a"),null);
});
test("2D resolver does not import Three.js",async()=>{
 const source=await readFile(new URL("../scripts/kingdom-2d-art-atlas.js",import.meta.url),"utf8");
 assert.doesNotMatch(source,/\bimport\s/);
});
test("failed asset request is retriable and concurrent manifest fetch is shared",async()=>{
 let count=0;
 await assert.rejects(loadEntityManifest(async()=>({ok:false})));
 const fetcher=async()=>{count++;return {ok:true,json:async()=>manifest};};
 await Promise.all([loadEntityManifest(fetcher),loadEntityManifest(fetcher)]);
 assert.equal(count,1);
 let calls=0;
 class FakeImage{set src(_){calls++;queueMicrotask(()=>calls===1?this.onerror():this.onload());}}
 await assert.rejects(loadCachedImage("/assets/art/test.webp",FakeImage));
 await loadCachedImage("/assets/art/test.webp",FakeImage);
 assert.equal(calls,2);
});
