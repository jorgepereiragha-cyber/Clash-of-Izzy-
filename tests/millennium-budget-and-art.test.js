import test from "node:test";
import assert from "node:assert/strict";
import {readFile,mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {GLB_BUDGET_BYTES,measureBundledGlbs,projectGlbAddition,registeredGlbPaths,bindBuildingModel} from "../scripts/millennium-art-budget.mjs";
const manifest=JSON.parse(await readFile(new URL("../assets/3d/manifest.json",import.meta.url),"utf8"));
test("budget uses actual bytes including disabled GLBs and remains strictly below the existing limit",async()=>{
 const total=await measureBundledGlbs(manifest,new URL("..",import.meta.url).pathname);
 assert.equal(total,registeredGlbPaths(manifest).reduce((sum,p)=>sum+manifest.files[p].bytes,0));
 assert.ok(total<GLB_BUDGET_BYTES);
 assert.equal(projectGlbAddition(4_472_716,202_924).allowed,false);
 assert.equal(projectGlbAddition(4_472_716,127_283).allowed,true);
 assert.equal(projectGlbAddition(4_472_716,127_284).allowed,false);
 assert.throws(()=>projectGlbAddition(1,NaN));
});
test("canonical building binding is immutable and preserves 2D and unrelated categories",()=>{
 const copy=bindBuildingModel(manifest,"farm","quaternius-farm");
 assert.equal(copy.version,2);
 assert.deepEqual(copy.entityArt.buildings.farm.canvas2d,manifest.entityArt.buildings.farm.canvas2d);
 assert.deepEqual(copy.entityArt.heroes,manifest.entityArt.heroes);
 assert.deepEqual(copy.entityArt.buildings.farm.webgl.modelIds,["quaternius-farm"]);
 assert.throws(()=>bindBuildingModel(manifest,"castle","millennium-castle"));
 assert.throws(()=>bindBuildingModel(manifest,"__proto__","anything"));
});

test("budget rejects nested unregistered GLBs including uppercase extensions",async()=>{
 const {tmpdir}=await import("node:os");
 const {join}=await import("node:path");
 const root=await mkdtemp(join(tmpdir(),"izzy-budget-"));
 try{
  const dir=join(root,"assets","3d","nested");
  await mkdir(dir,{recursive:true});
  const fixture={version:2,models:[],props:[],units:[],files:{}};
  assert.equal(await measureBundledGlbs(fixture,root),0);
  await writeFile(join(dir,"orphan.GLB"),Buffer.alloc(16));
  await assert.rejects(measureBundledGlbs(fixture,root),/Unregistered bundled GLB/);
 }finally{await rm(root,{recursive:true,force:true});}
});
