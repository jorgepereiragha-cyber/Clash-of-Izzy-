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
 const contest=worldVisualKeys({...s,throneShielded:false,thronePhase:"contest"});
 const claimed=worldVisualKeys({...s,throneShielded:false,thronePhase:"contest",throneClaimed:true});
 assert.notEqual(contest.features,claimed.features);
 assert.equal(contest.routes,claimed.routes);
 assert.equal(contest.marches,claimed.marches);
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

test("world terrain blends and river ribbons are deterministic, bounded, above ground and below route surfaces",async()=>{
 const {worldTerrainHeight,worldTerrainBlend,worldRiverZ,worldRiverDistance,worldRiverRibbon}=await import("../scripts/world-map-terrain.js");
 assert.equal(worldRiverZ(-50),-22);assert.equal(worldRiverZ(12),-5);
 assert.equal(worldRiverDistance(12,-5),0);assert.equal(worldRiverDistance(53,-5),Infinity);
 for(const [x,z] of [[0,0],[-50,-22],[56,46],[12,-5]]){
  const blend=worldTerrainBlend(x,z);assert.ok(Object.values(blend).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
 }
 const ribbon=worldRiverRibbon({segments:48,halfWidth:.82,offset:-.045});
 assert.deepEqual(ribbon,worldRiverRibbon({segments:48,halfWidth:.82,offset:-.045}));
 assert.equal(ribbon.positions.length,49*2*3);assert.equal(ribbon.indices.length,48*6);
 for(let i=0;i<ribbon.positions.length;i+=3){const [x,y,z]=ribbon.positions.slice(i,i+3);assert.ok(y>worldTerrainHeight(x,z)-.25&&y<worldTerrainHeight(x,z)+.1);}
 assert.ok(ribbon.indices.every(i=>Number.isInteger(i)&&i>=0&&i<98));
 const source=await read("world-map-3d.js");assert.match(source,/worldRiverRibbon\(/);assert.match(source,/worldRiverDistance\(x,z\)<3/);assert.match(source,/shared\.terrainGround/);
 assert.doesNotMatch(source,/TubeGeometry\(river,/);
});

test("GPU failure disables projection and restores tactical markers and accessible status",async()=>{
 const [scene,map,boot]=await Promise.all([read("world-map-3d.js"),read("world-map.js"),read("scripts/world-map-visual-boot.js")]);
 const fallback=scene.slice(scene.indexOf("function activateMapFallback()"),scene.indexOf("function init()"));
 assert.match(fallback,/delete window\.__coiWorldMap3D/);
 assert.match(fallback,/__coiWorldGraphicsQuality = "2d"/);
 assert.match(fallback,/try \{ dispose\(\); \} finally/);
 assert.ok(fallback.indexOf("delete window.__coiWorldMap3D")<fallback.indexOf('new CustomEvent("coi:world-map-2d-fallback")'));
 assert.match(scene,/function projectTerritories\(\) \{\s*if \(disposed \|\| contextLost/);
 assert.match(scene,/function draw\(\) \{\s*if \(disposed \|\| contextLost/);
 assert.match(scene,/function resize\(\) \{\s*if \(disposed \|\| contextLost/);
 assert.match(map,/addEventListener\("coi:world-map-2d-fallback", \(\) => \{\s*if \(state\?\.kingdom\) renderMap\(\)/);
 assert.match(boot,/addEventListener\("coi:world-map-2d-fallback", \(\) => \{\s*useFallback\("Mapa em 2D/);
});

test("collection nodes distinguish own occupancy, foreign occupancy, rally reservation and free status",async()=>{
 const source=await read("rally-ui.js");
 const start=source.indexOf("function nodeAvailability(node){");
 const end=source.indexOf("function nodeLabel(node){",start);
 assert.ok(start>=0&&end>start);
 const {runInNewContext}=await import("node:vm");
 const availability=runInNewContext(source.slice(start,end)+"\nnodeAvailability");
 assert.equal(availability({is_mine:true,occupied_by:1}),"Sua ocupação");
 assert.equal(availability({occupied_by:2}),"Ocupado por outro reino");
 assert.equal(availability({reserved_by_rally:"rally-1"}),"Reservado para rally");
 assert.equal(availability({}),"Livre para ocupação");
 assert.match(source,/pin\.dataset\.nodeId===String\(selectedNodeId\)/);
 assert.match(source,/pin\.setAttribute\("aria-pressed",String\(selected\)\)/);
 assert.match(source,/button\.style\.borderStyle="dashed"/);
 assert.match(source,/button\.setAttribute\("aria-label",button\.title\)/);
});

test("resource filters preserve distinct collection states and use shared isometric projection",async()=>{
 const [ui,html,css]=await Promise.all([read("rally-ui.js"),read("world.html"),read("styles/rally.css")]);
 const {runInNewContext}=await import("node:vm");
 const start=ui.indexOf("function nodeMatchesMapFilter("),end=ui.indexOf("for(const event",start);
 assert.ok(start>=0&&end>start);
 const amountStart=ui.indexOf("function collectableNodeAmount("),amountEnd=ui.indexOf("function nodeReadyLabel(",amountStart);
 const filter=runInNewContext(ui.slice(amountStart,amountEnd)+ui.slice(start,end)+"\nnodeMatchesMapFilter");
 assert.equal(filter({node_type:"farm"},"free"),true);
 assert.equal(filter({node_type:"farm",reserved_by_rally:"r"},"free"),false);
 assert.equal(filter({node_type:"farm",occupied_by:2},"free"),false);
 assert.equal(filter({is_mine:true},"mine-owned"),true);
 assert.equal(filter({is_mine:false},"mine-owned"),false);
 assert.equal(filter({node_type:"farm"},"forest"),false);
 assert.equal(filter({node_type:"forest"},"forest"),true);
 assert.equal(filter({node_type:"forest"},"all"),true);
 assert.equal(filter({collection_amount:5000000},"ready"),true);
 assert.equal(filter({is_mine:true,occupied_by:1,collection_amount:5000000},"ready"),true);
 assert.equal(filter({occupied_by:2,collection_amount:5000000},"ready"),false);
 assert.equal(filter({reserved_by_rally:"r",collection_amount:5000000},"ready"),false);
 assert.equal(filter({collection_amount:0},"ready"),false);
 assert.match(html,/value="ready">Prontos para coleta/);
 assert.match(ui,/if\(selectedNodeId&&!filteredNodes\(\)\.some\(node=>node\.id===selectedNodeId\)\)selectNode\(null\)/);
 const a=ui.indexOf("function projectResourceNodes()"),b=ui.indexOf("function nodeMatchesMapFilter(",a);
 const button={dataset:{mapX:"10",mapZ:"-20"},style:{}};
 let fallback=false;
 const map={querySelectorAll:()=>[button]},host={classList:{contains:()=>fallback}};
 const window={__coiWorldMap3D:{projectPoint:(x,z)=>({left:x*2,top:z+100})}};
 const project=runInNewContext(ui.slice(a,b)+"\nprojectResourceNodes",{$:id=>id==="mapContent"?map:host,window});
 project();assert.equal(button.style.left,"20px");assert.equal(button.style.top,"80px");
 fallback=true;project();assert.equal(button.style.left,"59%");assert.equal(button.style.top,"68%");
 assert.match(ui,/coi:world-map-projection-changed/);
 assert.match(html,/id="resourceMapFilter"/);
 assert.match(css,/\.resource-node-pin\.foreign/);
});


test("map collection markers and resource HUD reuse the canonical local art",async()=>{
 const {worldResourceArt}=await import("../scripts/kingdom-2d-art-atlas.js");
 const atlas=await read("assets/art/eldoria/hud.svg");
 const node=()=>({attrs:{},children:[],classList:{add(){}},setAttribute(k,v){this.attrs[k]=v;},append(v){this.children.push(v);}});
 const doc={createElementNS:()=>node()};
 for(const key of ["food","wood","stone","iron","gold","gems"]){
  const icon=worldResourceArt(key,doc);
  assert.ok(atlas.includes('id="resource-'+key+'"'));
  assert.equal(icon.children[0].attrs.href,"/assets/art/eldoria/hud.svg#resource-"+key);
  assert.equal(icon.attrs["aria-hidden"],"true");
 }
 for(const key of ["__proto__","unknown","../wood",null])assert.equal(worldResourceArt(key,doc),null);
 const [map,rally,css]=await Promise.all([read("world-map.js"),read("rally-ui.js"),read("styles/rally.css")]);
 assert.match(map,/worldResourceArt\(key,document\)/);
 assert.match(map,/worldResourceArt\(territory\.resource_type,document\)/);
 assert.match(rally,/mine:"iron",forest:"wood",farm:"food",quarry:"stone"/);
 assert.match(rally,/button\.append\(nodeResourceArt\(node\)\)/);
 assert.match(rally,/resource-node-level/);
 assert.match(css,/min-height:36px;touch-action:manipulation/);
});

test("resource locator prioritizes available productive nodes before nearer blocked or empty nodes",async()=>{
 const ui=await read("rally-ui.js");
 const {runInNewContext}=await import("node:vm");
 const start=ui.indexOf("function rankResourceNode(");
 const end=ui.indexOf('$("resourceMapLocate")?.addEventListener',start);
 assert.ok(start>=0&&end>start);
 const amountStart=ui.indexOf("function collectableNodeAmount("),amountEnd=ui.indexOf("function selectNode(",amountStart);
 let home={x:0,z:0};
 const compare=runInNewContext(ui.slice(amountStart,amountEnd)+ui.slice(start,end)+"\ncompareResourceNodes",{tacticalHome:()=>home});
 const nodes=[
  {id:"foreign",map_x:0,map_y:0,occupied_by:2,current_resources:100},
  {id:"reserved",map_x:1,map_y:0,reserved_by_rally:"r",current_resources:100},
  {id:"empty",map_x:2,map_y:0,current_resources:0},
  {id:"far-free",map_x:10,map_y:0,current_resources:100},
  {id:"own",map_x:5,map_y:0,is_mine:true,occupied_by:1,current_resources:100}
 ];
 assert.deepEqual(nodes.sort(compare).map(node=>node.id),["own","far-free","empty","foreign","reserved"]);
 home={x:13,z:-11};
 const nearby=[{id:"origin",map_x:0,map_y:0,collection_amount:5000000},{id:"castle",map_x:13,map_y:-10,collection_amount:5000000}];
 assert.equal(nearby.sort(compare)[0].id,"castle");
 assert.match(ui,/filteredNodes\(\)\.sort\(compareResourceNodes\)/);
});

test("collection estimate matches server rounding and disables empty node collection",async()=>{
 const [ui,server]=await Promise.all([read("rally-ui.js"),read("rally.js")]);
 const {runInNewContext}=await import("node:vm");
 const start=ui.indexOf("function collectableNodeAmount(");
 const end=ui.indexOf("function selectNode(",start);
 assert.ok(start>=0&&end>start);
 const estimate=runInNewContext(ui.slice(start,end)+"\ncollectableNodeAmount");
 for(const [available,expected] of [[0,0],[1,0],[2,1],[3,1],[101,50],[-1,0],[undefined,0],[Infinity,0]]){
  assert.equal(estimate({current_resources:available}),expected);
 }
 assert.equal(estimate({current_resources:4000000,collection_amount:0}),0);
 assert.equal(estimate({current_resources:5000000,collection_amount:5000000}),5000000);
 assert.match(server,/available>=betaHarvestThreshold\(node\)\?5000000:0/);
 assert.match(ui,/addAction\(actions,"Coletar",\(\)=>runNodeAction\("collect",node\),busy\|\|amount<1\)/);
 assert.match(ui,/Aguardando regeneração para coletar/);
});
test("monster search favors living unlocked targets with sufficient hunt energy",async()=>{
 const ui=await read("scripts/world-monster-preview.js");
 const {runInNewContext}=await import("node:vm");
 const start=ui.indexOf("function monsterSearchRank(");
 const end=ui.indexOf('locate.addEventListener("click"',start);
 assert.ok(start>=0&&end>start);
 const rank=runInNewContext(ui.slice(start,end)+"\nmonsterSearchRank");
 const progress={unlockedLevel:3,energy:5,energyCosts:{1:3,2:5,3:8,4:10}};
 assert.equal(rank({hp:100,level:1},progress,true),0);
 assert.equal(rank({hp:100,level:2},progress,true),0);
 assert.equal(rank({hp:100,level:3},progress,true),1);
 assert.equal(rank({hp:100,level:4},progress,true),2);
 assert.equal(rank({hp:0,level:1},progress,true),3);
 assert.equal(rank({hp:100,level:1},progress,false),2);
 assert.match(ui,/Energia insuficiente/);
 assert.match(ui,/Math\.hypot\(a\.x-home\.x,a\.z-home\.z\)/);
});
test("accelerated beta harvest is ready at the initial seeded stock and regenerates after depletion",async()=>{
 const server=await read("rally.js");
 const {runInNewContext}=await import("node:vm");
 const start=server.indexOf("function betaHarvestThreshold(");
 const end=server.indexOf("async function kingdomForPlayer(",start);
 assert.ok(start>=0&&end>start);
 const policy=runInNewContext(server.slice(start,end)+"\n({betaHarvestThreshold,nodeReadyAt,nodeRegeneration})");
 const node={max_resources:10000,current_resources:8000,regen_rate:400,last_regen:1000};
 const required=policy.betaHarvestThreshold(node);
 assert.equal(required,8000);
 assert.equal(policy.nodeReadyAt(node,1000,required),1000);
 const depleted={...node,current_resources:0};
 assert.equal(policy.nodeReadyAt(depleted,1000,required),73000);
 assert.equal(policy.nodeRegeneration(depleted,72999),7999);
 assert.equal(policy.nodeRegeneration(depleted,73000),8000);
});

test("world map resets all authenticated panels when the stored session changes",async()=>{
 const ui=await read("world-map.js");
 const {runInNewContext}=await import("node:vm");
 const start=ui.indexOf("function worldSessionChanged(");
 const end=ui.indexOf("const RESOURCE",start);
 assert.ok(start>=0&&end>start);
 let current="session-a",listener,reloads=0,invalidations=0;
 const gate={invalidate(){invalidations++;}};
 runInNewContext(ui.slice(start,end),{
  token:"session-a",readWorldSession:()=>({token:current}),
  worldRefreshGate:gate,realmRefreshGate:gate,
  window:{addEventListener(name,callback){assert.equal(name,"storage");listener=callback;},location:{reload(){reloads++;}}}
 });
 listener({key:"theme"});listener({key:"coi_game_token"});
 assert.equal(reloads,0);
 current="session-b";listener({key:"coi_game_token"});
 assert.equal(reloads,1);assert.equal(invalidations,2);
 current="";listener({key:null});
 assert.equal(reloads,2);assert.equal(invalidations,4);
});
test("expedition preview shows authoritative resource yield before occupation",async()=>{
 const [ui,map]=await Promise.all([read("rally-ui.js"),read("world-map.js")]);
 const {runInNewContext}=await import("node:vm");
 const start=ui.indexOf("function collectableNodeAmount("),end=ui.indexOf("function nodeStockMeter(",start);
 assert.ok(start>=0&&end>start);
 const preview=runInNewContext(ui.slice(start,end)+"\nnodeHarvestPreview",{NODE_TYPES:{farm:{resource:"Comida"}}});
 const full={node_type:"farm",collection_amount:5000000,current_resources:5000000,max_resources:5000000};
 assert.equal(preview(full).amount,5000000);
 assert.equal(preview(full).resource,"Comida");
 assert.equal(preview({...full,occupied_by:2}).blocked,true);
 assert.equal(preview({...full,is_mine:true,occupied_by:1}).blocked,false);
 assert.equal(preview({...full,reserved_by_rally:"r"}).blocked,true);
 const regenerating=preview({...full,collection_amount:0,current_resources:1000,collection_ready_at:160,server_time:100});
 assert.equal(regenerating.amount,0);
 assert.match(regenerating.readyLabel,/1 min/);
 assert.match(map,/addStat\(grid,"Coleta estimada",harvest.blocked\?"Indisponível"/);
});

test("collection receipt reports authoritative resource and own/allied troop returns",async()=>{
 const ui=await read("rally-ui.js");
 const {runInNewContext}=await import("node:vm");
 const start=ui.indexOf("function nodeActionReceipt("),end=ui.indexOf("async function runNodeAction(",start);
 assert.ok(start>=0&&end>start);
 const receipt=runInNewContext(ui.slice(start,end)+"\nnodeActionReceipt",{NODE_TYPES:{farm:{resource:"Comida"}},fmt:value=>String(Number(value||0))});
 assert.equal(receipt("collect",{node_type:"farm"},{collected:5000000}),"Coleta concluída: 5000000 comida.");
 assert.equal(receipt("collect-return",{node_type:"farm"},{collected:5000000,returned:12,returned_allies:3}),"Coleta concluída: 5000000 comida. 12 tropas próprias retornaram. 3 tropas aliadas retornaram.");
 assert.equal(receipt("collect-return",{node_type:"unknown"},{collected:5,returned:2,returned_allies:0}),"Coleta concluída: 5 recursos. 2 tropas próprias retornaram.");
 assert.match(ui,/data=>nodeActionReceipt\(action,node,data\)/);
});

test("rally and gathering action controls maintain mobile touch targets and visible focus",async()=>{
 const css=await read("styles/rally.css");
 const rule=css.match(/\.rally-action\{([^}]+)\}/)?.[1];
 assert.ok(rule);
 assert.match(rule,/min-height:44px/);
 assert.match(rule,/min-width:44px/);
 assert.match(rule,/font-size:12px/);
 assert.match(rule,/touch-action:manipulation/);
 assert.match(css,/\.rally-action:focus-visible\{[^}]*outline:/);
 assert.match(css,/\.resource-node-yield\{[^}]*font-variant-numeric:tabular-nums/);
});

test("committed gathering receipt survives a temporary map refresh failure",async()=>{
 const ui=await read("rally-ui.js");
 const {runInNewContext}=await import("node:vm");
 const start=ui.indexOf("async function loadRallyState("),end=ui.indexOf("function init(",start);
 assert.ok(start>=0&&end>start);
 const messages=[];
 let current="original";
 const load=runInNewContext(ui.slice(start,end)+"\nloadRallyState",{
  token:"original",readRallySession:()=>({token:current}),
  api:async()=>{throw new Error("offline");},
  notify:(message,error)=>messages.push({message,error})
 });
 await load("Coleta concluída.");
 assert.equal(messages[0].message,"Coleta concluída. Não foi possível atualizar o mapa; aguarde a próxima sincronização.");
 assert.equal(messages[0].error,true);
 current="other";
 await load("Coleta concluída.");
 assert.equal(messages.length,1);
});
