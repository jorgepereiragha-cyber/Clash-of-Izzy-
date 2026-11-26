import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {HERO_TEMPLATES} from "../hero-catalog.js";
import {DRAGON_CATALOG} from "../dragon-catalog.js";
import {UNIT_STYLES} from "../scripts/kingdom-army-visual.js";
import {KingdomEntityArtController,normalizeQualityProfile} from "../scripts/kingdom-entity-art-boot.js";
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
   if(!["buildings","dragons","troops","heroes","resources","science"].includes(category))continue;
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

test("controller normalizes quality and keeps a single 48-entry decoded cache",async()=>{
 for(const value of ["medium","MEDIUM","Balanced","unknown"])assert.equal(normalizeQualityProfile(value),"balanced");
 for(const value of ["low","high"])assert.equal(normalizeQualityProfile(value),value);
 const controller=new KingdomEntityArtController({manifest,quality:"MEDIUM"});
 assert.equal(controller.quality,"balanced");
 controller.setQuality("high");assert.equal(controller.quality,"high");
 let calls=0;
 class FakeImage{set src(_){calls++;queueMicrotask(()=>this.onload());}}
 const urls=Array.from({length:65},(_,i)=>"/assets/art/cache-test-"+i+".webp");
 for(const url of urls)await controller.acquireImage(url,FakeImage);
 const cache=controller.cacheInfo();
 assert.equal(cache.size,48);assert.equal(cache.limit,48);
 assert.ok(!cache.keys.includes(urls[0]));assert.ok(cache.keys.includes(urls[64]));
 await controller.acquireImage(urls[64],FakeImage);assert.equal(calls,65);
});
test("controller uses official keys and real local atlas symbols, never synthetic hero IDs",()=>{
 const controller=new KingdomEntityArtController({manifest});
 for(const {key} of DRAGON_CATALOG)assert.equal(controller.getDragonPortrait(key).src,"/assets/art/eldoria/hud.svg#dragon-"+key);
 for(const key of Object.keys(UNIT_STYLES))assert.equal(controller.getTroopIcon(key).src,"/assets/art/eldoria/hud.svg#troop-"+key);
 const keys=Object.keys(art.heroes),portraits=keys.map(key=>controller.getHeroPortrait(key).src);
 assert.equal(new Set(portraits).size,70);
 assert.equal(controller.getHeroPortrait("hero_01"),null);
 assert.equal(controller.drawCanvas2DEntity(null,{category:"buildings",id:"castle"}),false);
 assert.equal(controller.drawCanvas2DEntity({drawImage(){throw Error("should not draw");}},{category:"buildings",id:"castle",x:0,y:0,w:20,h:20}),false);
});
test("science symbols and pure 2D integration stay tied to real UI",async()=>{
 assert.equal(Object.keys(art.science).length,7);
 const boot=await readFile(new URL("../scripts/kingdom-entity-art-boot.js",import.meta.url),"utf8");
 assert.doesNotMatch(boot,/from\s+["']three(?:\/|["'])/);
 const html=await readFile(new URL("../kingdom.html",import.meta.url),"utf8");
 assert.match(html,/__coiDrawCityEntityArt\(ctx/);
 assert.match(html,/coiTroopArtPreview/);assert.match(html,/coiHeroArtPreview/);
 assert.match(html,/data-entity-art-existing/);
});

test("canvas draw uses a previously decoded asset and never draws invalid dimensions",async()=>{
 const fakeManifest={entityArt:{buildings:{castle:{canvas2d:{src:"art/test-canvas.webp"}}}}};
 const controller=new KingdomEntityArtController({manifest:fakeManifest});
 class FakeImage{set src(_){queueMicrotask(()=>this.onload());}}
 const image=await controller.acquireImage("/assets/art/test-canvas.webp",FakeImage);
 const calls=[],ctx={drawImage(...args){calls.push(args);}};
 assert.equal(controller.drawCanvas2DEntity(ctx,{category:"buildings",id:"castle",x:1,y:2,w:30,h:40}),true);
 assert.deepEqual(calls,[[image,1,2,30,40]]);
 assert.equal(controller.drawCanvas2DEntity(ctx,{category:"buildings",id:"castle",x:1,y:2,w:0,h:40}),false);
 assert.equal(calls.length,1);
});

test("special buildings use canonical D1 keys and real local art",async()=>{
 const {SPECIAL_CITY_CATALOG}=await import("../city-special-buildings.js");
 const svg=await readFile(new URL("../assets/art/buildings/icons.svg",import.meta.url),"utf8");
 for(const key of Object.keys(SPECIAL_CITY_CATALOG)){
   assert.equal(art.buildings[key].webgl.fallback,"procedural");
   assert.equal(resolveEntity2DAsset(manifest,"buildings",key).src,"/assets/art/buildings/icons.svg#"+key);
   assert.ok(svg.includes('id="'+key+'"'));
 }
 const source=await readFile(new URL("../scripts/city-layout-editor.js",import.meta.url),"utf8");
 assert.match(source,/paintBuildingArt\(b\.building_type/);
 assert.doesNotMatch(source,/from\s+["']three(?:\/|["'])/);
});


test("city preloads the exact level and quality art of visible plots without duplicates",()=>{
 const controller=new KingdomEntityArtController({manifest:{entityArt:{buildings:{
   castle:{canvas2d:{src:"art/castle.webp"},tiers:{"20":{canvas2d:{src:"art/castle-20.webp",quality:{low:{src:"art/castle-20-low.webp"}}}}}},
   farm:{canvas2d:{src:"art/farm.webp"}},warehouse:{canvas2d:{src:"art/warehouse.webp"}}
 }}}});
 const buildings=[{building_type:"castle",level:20},...Array.from({length:8},()=>({building_type:"farm",level:1})),{building_type:"warehouse",level:1}];
 assert.deepEqual(controller.getCityPreloadAssets(buildings).map(a=>a.src),["/assets/art/castle-20.webp","/assets/art/farm.webp"]);
 controller.setQuality("low");
 assert.deepEqual(controller.getCityPreloadAssets(buildings).map(a=>a.src),["/assets/art/castle-20-low.webp","/assets/art/farm.webp"]);
 assert.deepEqual(controller.getCityPreloadAssets([{building_type:"castle",level:1}]).map(a=>a.src),["/assets/art/castle.webp"]);
 assert.deepEqual(controller.getCityPreloadAssets([{building_type:"unknown"},null]),[]);
});
