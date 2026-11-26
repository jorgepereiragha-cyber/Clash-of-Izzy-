import test from "node:test";
import assert from "node:assert/strict";
import { isApprovedArtLicense, approvedManifestEntry } from "../scripts/art-license-policy.js";
import { auditArt } from "../scripts/audit-art-licenses.mjs";
test("all committed models and textures have recorded license evidence and exact SHA-256", async()=> {
  const result = await auditArt();
  assert.ok(result.files >= 11);
  assert.ok(result.models >= 8);
});
test("commercial license policy fails closed",()=>{
  for(const value of ["CC-BY-NC-4.0","GPL-3.0","AGPL-3.0","Adobe-RF","free",undefined]) assert.equal(isApprovedArtLicense(value),false);
  for(const value of ["CC0-1.0","CC-BY-3.0","CC-BY-4.0","CC-BY-SA-3.0"]) assert.equal(isApprovedArtLicense(value),true);
  const asset={src:"/assets/3d/model.glb",license:"CC0-1.0",source:"Artist",sourceUrl:"https://example.com/model"};
  const file={...asset,attribution:"Artist",sha256:"a".repeat(64)};
  assert.equal(approvedManifestEntry(asset,{}),false);
  assert.equal(approvedManifestEntry(asset,{[asset.src]:file}),true);
  assert.equal(approvedManifestEntry(asset,{[asset.src]:{...file,license:"CC-BY-NC-4.0"}}),false);
  assert.equal(approvedManifestEntry(asset,{[asset.src]:{...file,sha256:"fake"}}),false);
});

test("share-alike art requires explicit adaptation license and provenance",()=>{
 const asset={src:"/assets/3d/fortress.glb",license:"CC-BY-SA-3.0",source:"Millennium A.D.",sourceUrl:"https://github.com/0ADMods/millenniumad"};
 const file={...asset,attribution:"Original authors",sha256:"b".repeat(64),licenseFile:"licenses/Millennium-AD.txt"};
 assert.equal(approvedManifestEntry(asset,{[asset.src]:file}),false);
 const approved={...file,licenseUrl:"https://creativecommons.org/licenses/by-sa/3.0/",adaptedArtLicense:"CC-BY-SA-3.0",modifications:"COLLADA to GLB, texture resizing"};
 assert.equal(approvedManifestEntry(asset,{[asset.src]:approved}),true);
 for(const patch of [{modifications:" "},{adaptedArtLicense:"CC0-1.0"},{licenseUrl:"https://example.com"},{licenseFile:"../license.txt"}]){
   assert.equal(approvedManifestEntry(asset,{[asset.src]:{...approved,...patch}}),false);
 }
});


test("manifest rejects duplicate enabled model roles without rejecting disabled alternatives",async()=>{
 const {mkdtemp,mkdir,writeFile,rm,readFile,cp}=await import("node:fs/promises");
 const {tmpdir}=await import("node:os");
 const path=await import("node:path");
 const {validateAssetManifest}=await import("../scripts/validate-3d-assets.js");
 const root=await mkdtemp(path.join(tmpdir(),"coi-asset-role-"));
 try{
  const dir=path.join(root,"assets","3d");
  await mkdir(dir,{recursive:true});
  const manifest=JSON.parse(await readFile(new URL("../assets/3d/manifest.json",import.meta.url),"utf8"));
  const first=manifest.models.find(a=>a.enabled);
  // Preserve the source GLB and its relative texture dependencies in each fixture.
  const sourceDir=new URL(".",new URL(".."+first.src,import.meta.url));
  await cp(sourceDir,path.join(dir,"first"),{recursive:true});
  await cp(sourceDir,path.join(dir,"second"),{recursive:true});
  const filename=first.src.split("/").at(-1);
  const base={...first,src:"/assets/3d/first/"+filename};
  const alt={...base,id:base.id+"-alternate",src:"/assets/3d/second/"+filename};
  const save=async enabled=>writeFile(path.join(dir,"manifest.json"),JSON.stringify({version:2,models:[base,{...alt,enabled}],props:[],units:[]}));
  await save(false);assert.equal((await validateAssetManifest(root)).enabled,1);
  await save(true);await assert.rejects(validateAssetManifest(root),/modelo ativo duplicado/);
 }finally{await rm(root,{recursive:true,force:true});}
});
