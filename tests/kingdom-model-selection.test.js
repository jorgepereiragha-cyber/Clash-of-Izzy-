import test from "node:test";
import assert from "node:assert/strict";
import {selectBuildingAsset, MODEL_LIMITS} from "../scripts/kingdom-model-selection.js";
const a=(id,minLevel,lod,enabled=true,type="castle")=>({id,type,minLevel,lod,enabled});
const models=[a("base",1,1),a("ten",10,1),a("twenty",20,1),a("high",20,0),a("low",20,2),a("disabled",25,0,false),a("other",30,0,true,"farm")];
test("visual selection respects server level, type, enabled and LOD",()=>{
 assert.equal(selectBuildingAsset(models,"castle",1,"high").id,"base");
 assert.equal(selectBuildingAsset(models,"castle",19,"high").id,"ten");
 assert.equal(selectBuildingAsset(models,"castle",25,"high").id,"high");
 assert.equal(selectBuildingAsset(models,"castle",30,"balanced").id,"twenty");
 assert.equal(selectBuildingAsset(models,"castle",30,"low").id,"low");
 assert.equal(selectBuildingAsset(models,"farm",1),null);
 assert.equal(selectBuildingAsset(models,"castle",NaN).id,"base");
});
test("legacy manifest and invalid data are safe",()=>{
 const legacy={id:"legacy",type:"wall",enabled:true};
 assert.equal(selectBuildingAsset([legacy],"wall",7),legacy);
 assert.equal(selectBuildingAsset([a("bad",-1,0)],"castle",1),null);
 assert.equal(selectBuildingAsset(null,"castle",1),null);
 assert.ok(MODEL_LIMITS.models>=56);
 assert.ok(MODEL_LIMITS.units>=11);
});
