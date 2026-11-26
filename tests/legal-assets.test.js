import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateLicenseRegistry,assertLicensedAsset} from "../engine/license-registry.js";
import {verifyLicenses} from "../scripts/generate-licenses.mjs";
const registry=JSON.parse(await readFile(new URL("../assets/3d/licenses.json",import.meta.url),"utf8"));
test("all 3D assets and companion textures are registered, hash-verified and credited",async()=>{
 const result=await verifyLicenses();
 assert.equal(result.issues,0);assert.equal(result.verified,Object.keys(registry.assets).length);assert.ok(result.verified>=10);
});
test("rejects restricted licenses, missing attribution, traversal, and duplicate basenames",()=>{
 const path=Object.keys(registry.assets)[0],entry=registry.assets[path];
 for(const license of ["CC-BY-NC-4.0","GPL-3.0","AGPL-3.0","unknown","Adobe-RF","CC-BY-SA-3.0"]){
  assert.throws(()=>validateLicenseRegistry({version:1,assets:{[path]:{...entry,license}}}),/Licença não aprovada/);
 }
 const valid=validateLicenseRegistry(registry);
 assert.ok(assertLicensedAsset(valid,path));
 assert.throws(()=>assertLicensedAsset(valid,"/assets/models/"+path.split("/").pop()));
 for(const url of ["https://other.invalid"+path,"/assets/3d/../private.glb","/assets/3d/%2e%2e/private.glb",path+"?x=1"])assert.throws(()=>assertLicensedAsset(valid,url));
 assert.throws(()=>validateLicenseRegistry({version:1,assets:{[path]:{...entry,attribution:""}}}));
});
test("CC-BY 4.0 requires attribution and correct license link, with changes documented",()=>{
 const path=Object.keys(registry.assets)[0],entry={...registry.assets[path],license:"CC-BY-4.0",licenseUrl:"https://creativecommons.org/licenses/by/4.0/",modified:true,changes:"Material adjusted"};
 assert.equal(validateLicenseRegistry({version:1,assets:{[path]:entry}}).get(path).license,"CC-BY-4.0");
 assert.throws(()=>validateLicenseRegistry({version:1,assets:{[path]:{...entry,changes:""}}}));
});
