import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
test("three acquired medieval city GLBs match provenance and active manifest",async()=>{
 const root=new URL("../assets/3d/",import.meta.url);
 const folder=new URL("quaternius/medieval-village/",root);
 const report=JSON.parse(await readFile(new URL("PROVENANCE.json",folder),"utf8"));
 const manifest=JSON.parse(await readFile(new URL("manifest.json",root),"utf8"));
 assert.equal(report.license,"CC0-1.0");
 assert.equal(report.files.length,3);
 assert.equal(new Set(report.files.map(f=>f.sha256)).size,3);
 for(const item of report.files){
  const bytes=await readFile(new URL(item.file,folder));
  assert.equal(bytes.length,item.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),item.sha256);
  assert.equal(createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex"),item.gitBlob);
  const record=manifest.models.find(x=>x.src==="/assets/3d/quaternius/medieval-village/"+item.file);
  assert.equal(record?.enabled,true);
  assert.equal(record?.license,"CC0-1.0");
 }
 assert.deepEqual(manifest.models.filter(x=>x.source==="Quaternius Medieval Village Pack").map(x=>x.type).sort(),["lumber_mill","market","stable"]);
});
