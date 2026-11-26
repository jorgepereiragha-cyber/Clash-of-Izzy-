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
  for(const value of ["CC-BY-NC-4.0","GPL-3.0","AGPL-3.0","CC-BY-SA-3.0","Adobe-RF","free",undefined]) assert.equal(isApprovedArtLicense(value),false);
  for(const value of ["CC0-1.0","CC-BY-3.0","CC-BY-4.0"]) assert.equal(isApprovedArtLicense(value),true);
  const asset={src:"/assets/3d/model.glb",license:"CC0-1.0",source:"Artist",sourceUrl:"https://example.com/model"};
  const file={...asset,attribution:"Artist",sha256:"a".repeat(64)};
  assert.equal(approvedManifestEntry(asset,{}),false);
  assert.equal(approvedManifestEntry(asset,{[asset.src]:file}),true);
  assert.equal(approvedManifestEntry(asset,{[asset.src]:{...file,license:"CC-BY-NC-4.0"}}),false);
  assert.equal(approvedManifestEntry(asset,{[asset.src]:{...file,sha256:"fake"}}),false);
});
