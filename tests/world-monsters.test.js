import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
import {worldMonsterPreview} from "../world-monsters.js";
test("monster preview is persisted, isolated by region, idempotent and read-only",async()=>{
 const migration=await readFile(new URL("../migrations/0048_world_monsters.sql",import.meta.url),"utf8");
 const sql=new DatabaseSync(":memory:");
 try{
  sql.exec("CREATE TABLE players(id INTEGER PRIMARY KEY,player_id TEXT); CREATE TABLE kingdoms(id INTEGER PRIMARY KEY,player_id INTEGER,map_region INTEGER); INSERT INTO players VALUES(1,'a'),(2,'b'),(3,'c'); INSERT INTO kingdoms VALUES(1,1,1),(2,2,2),(3,3,3)");
  sql.exec(migration);sql.exec(migration);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM world_monsters").get().n,18);
  const env={ENVIRONMENT:"beta",GAME_4X_SYSTEMS_ENABLED:"true",DB:{prepare(q){return{bind(...args){return{first:async()=>sql.prepare(q).get(...args),all:async()=>({results:sql.prepare(q).all(...args)})}}}}}};
  const regions=await Promise.all(["a","b","c"].map(p=>worldMonsterPreview(env,p)));
  assert.deepEqual(regions.map(x=>x.region),[1,2,3]);
  for(const result of regions){assert.equal(result.monsters.length,6);assert.equal(result.combatEnabled,false);assert.deepEqual(result.monsters.map(x=>x.level),[1,3,5,8,12,18]);assert.ok(result.monsters.every(m=>m.hp===m.max_hp));}
  assert.equal(new Set(regions.flatMap(x=>x.monsters.map(m=>m.id))).size,18);
  assert.equal(await worldMonsterPreview(env,"absent"),null);
  assert.deepEqual(await worldMonsterPreview({ENVIRONMENT:"production",GAME_4X_SYSTEMS_ENABLED:"true"},"a"),{enabled:false,combatEnabled:false,monsters:[]});
  assert.throws(()=>sql.exec("UPDATE world_monsters SET hp=max_hp+1"));
  assert.throws(()=>sql.exec("UPDATE world_monsters SET map_region=4"));
  const id=regions[0].monsters[0].id;
  sql.prepare("UPDATE world_monsters SET hp=0,respawn_at=2000000000 WHERE id=?").run(id);
  sql.exec(migration);
  assert.equal((await worldMonsterPreview(env,"a")).monsters[0].hp,0);
 }finally{sql.close()}
});
test("monster guide uses authenticated read-only endpoint and safe text rendering",async()=>{
 const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
 const [worker,ui,html,ignore]=await Promise.all([read("worker.js"),read("scripts/world-monster-preview.js"),read("world.html"),read(".assetsignore")]);
 assert.match(worker,/url\.pathname==="\/api\/game\/world-monsters"&&request\.method==="GET"/);
 assert.match(worker,/worldMonsterPreview\(env,playerId\)/);
 assert.match(ui,/Authorization:"Bearer "\+bearer/);
 assert.doesNotMatch(ui,/innerHTML|method:"POST"/);
 assert.match(html,/id="worldMonsterPreview" hidden/);
 assert.ok(ignore.split(/\r?\n/).includes("world-monsters.js"));
});

test("monster pins use isometric coordinates when available and revert to tactical coordinates on failure",async()=>{
 const ui=await readFile(new URL("../scripts/world-monster-preview.js",import.meta.url),"utf8");
 const scene=await readFile(new URL("../world-map-3d.js",import.meta.url),"utf8");
 const html=await readFile(new URL("../world.html",import.meta.url),"utf8");
 const {runInNewContext}=await import("node:vm");
 const start=ui.indexOf("function projectPins(){"),end=ui.indexOf("function clearPins()",start);
 assert.ok(start>=0&&end>start);
 const button={style:{}};
 const pins=new Map([["1",{button,monster:{x:22,z:-8}}]]);
 let fallback=false;
 const window={__coiWorldMap3D:{projectPoint:(x,z)=>({left:x*2,top:z+100})}};
 const project=runInNewContext(ui.slice(start,end)+"\nprojectPins",{pins,window,mapHost:{classList:{contains:()=>fallback}}});
 project();
 assert.equal(button.style.left,"44px");assert.equal(button.style.top,"92px");
 fallback=true;project();
 assert.equal(button.style.left,"69.8%");assert.equal(button.style.top,"57.2%");
 fallback=false;delete window.__coiWorldMap3D;project();
 assert.equal(button.style.left,"69.8%");
 assert.match(scene,/function projectMapPoint\(x,z\) \{\s*if \(disposed \|\| contextLost/);
 assert.match(ui,/coi:world-map-2d-fallback/);
 assert.match(ui,/button\.setAttribute\("aria-pressed",String\(key===id\)\)/);
 assert.match(html,/\.world-monster-pin\.selected/);
});

test("all six persisted monster types have distinct original tactical portraits",async()=>{
 const [atlas,ui,migration]=await Promise.all(["assets/art/eldoria/monsters.svg","scripts/world-monster-preview.js","migrations/0048_world_monsters.sql"].map(path=>readFile(new URL("../"+path,import.meta.url),"utf8")));
 const ids=[...atlas.matchAll(/<symbol id="([^"]+)" viewBox="0 0 64 64">/g)].map(m=>m[1]);
 assert.deepEqual(ids,["ash_wolf","iron_boar","frost_bear","marsh_wyrm","stone_golem","ember_drake"]);
 assert.ok(Buffer.byteLength(atlas)<12000);
 assert.doesNotMatch(atlas,/<script|<image|<foreignObject|onload=/i);
 for(const id of ids){assert.ok(migration.includes("'"+id+"'"));assert.ok(ui.includes('"'+id+'"'));}
 assert.match(ui,/MONSTER_KEYS\.includes\(key\)/);
 assert.match(ui,/\/assets\/art\/eldoria\/monsters\.svg#"\+key/);
 assert.equal((ui.match(/monsterArt\(monster\.monster_key\)/g)||[]).length,2);
});

test("3D monster models have bounded distinct silhouettes and ignore invalid or dead spawns",async()=>{
 const {monsterModelKeys,monsterParts,visibleMonsterRows}=await import("../scripts/world-monster-models.js");
 assert.equal(monsterModelKeys.length,6);
 const signatures=new Set();
 for(const key of monsterModelKeys){
  const parts=monsterParts(key);
  assert.ok(parts.length>=7&&parts.length<=12);
  assert.ok(parts.every(p=>["orb","box","cone","rock"].includes(p.shape)&&[p.x,p.y,p.z,p.sx,p.sy,p.sz,p.rx,p.ry,p.rz].every(Number.isFinite)&&p.sx>0&&p.sy>0&&p.sz>0));
  signatures.add(JSON.stringify(parts));
 }
 assert.equal(signatures.size,6);
 assert.deepEqual(monsterParts("__proto__"),[]);
 const good={id:2,x:10,z:5,hp:100,monster_key:"ash_wolf"};
 const rows=visibleMonsterRows([good,good,{...good,id:3,hp:0},{...good,id:4,x:999},{...good,id:5,monster_key:"unknown"}]);
 assert.deepEqual(rows,[{id:2,x:10,z:5,key:"ash_wolf"}]);
 assert.deepEqual(visibleMonsterRows([{...good,hp:50}]),rows);
});
test("monster GPU batches rebuild only on changed visual state and dispose resources",async()=>{
 const {createWorldMonsterLayer}=await import("../scripts/world-monster-models.js");
 const counters={batch:0,geometry:0,material:0};
 class Group{constructor(){this.children=[];}add(x){this.children.push(x);}remove(x){this.children=this.children.filter(v=>v!==x);}}
 class Geo{dispose(){counters.geometry++;}}
 class Material{dispose(){counters.material++;}}
 class Object3D{constructor(){this.position=this.scale=this.rotation={set(){}};}updateMatrix(){}}
 class Color{setHex(){return this;}}
 class InstancedMesh{constructor(){this.instanceMatrix={};this.instanceColor={};}setMatrixAt(){}setColorAt(){}computeBoundingSphere(){}dispose(){counters.batch++;}}
 const THREE={Group,SphereGeometry:Geo,BoxGeometry:Geo,ConeGeometry:Geo,DodecahedronGeometry:Geo,MeshStandardMaterial:Material,Object3D,Color,InstancedMesh};
 const root=new Group(),layer=createWorldMonsterLayer(THREE,root,()=>0);
 const row={id:1,x:1,z:2,hp:100,monster_key:"ash_wolf"};
 assert.equal(layer.update([row]),true);
 assert.ok(root.children[0].children.length<=4);
 assert.equal(layer.update([{...row,hp:20}]),false);
 assert.equal(counters.batch,0);
 assert.equal(layer.update([{...row,hp:0}]),true);
 assert.ok(counters.batch>0);
 layer.dispose();layer.dispose();
 assert.equal(counters.geometry,4);assert.equal(counters.material,1);assert.equal(root.children.length,0);
 assert.equal(layer.update([row]),false);
});
