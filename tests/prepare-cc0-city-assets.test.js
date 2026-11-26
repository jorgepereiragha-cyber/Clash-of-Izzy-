import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {SOURCE,verifyModel} from "../scripts/prepare-cc0-city-assets.mjs";
test("city import pins three distinct small CC0 model blobs",()=>{
 assert.equal(SOURCE.license,"CC0-1.0");
 assert.match(SOURCE.revision,/^[a-f0-9]{40}$/);
 assert.equal(new Set(SOURCE.files.map(x=>x.type)).size,3);
 assert.ok(SOURCE.files.reduce((n,x)=>n+x.bytes,0)<1024*1024);
 for(const entry of SOURCE.files){
  assert.match(entry.gitBlob,/^[a-f0-9]{40}$/);
  assert.throws(()=>verifyModel(Buffer.alloc(entry.bytes),entry),/Git blob mismatch/);
  assert.throws(()=>verifyModel(Buffer.alloc(1),entry),/Unexpected size/);
 }
});
test("GLB verifier checks structure and self-contained dependencies after hash",()=>{
 const fixture=uri=>{
  const json=Buffer.from(JSON.stringify({asset:{version:"2.0"},meshes:[{}],images:uri?[{uri}]:[]}));
  const length=Math.ceil(json.length/4)*4;
  const glb=Buffer.alloc(20+length,32);glb.write("glTF");glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(length,12);glb.writeUInt32LE(0x4e4f534a,16);json.copy(glb,20);
  return [glb,{filename:"fixture.glb",bytes:glb.length,gitBlob:createHash("sha1").update("blob "+glb.length+"\0").update(glb).digest("hex")}];
 };
 assert.equal(verifyModel(...fixture()).meshes,1);
 assert.throws(()=>verifyModel(...fixture("https://invalid.example/texture.png")),/External GLB dependency/);
});
test("asset import workflow cannot deploy and has read-only repository permissions",async()=>{
 const workflow=await readFile(new URL("../.github/workflows/prepare-cc0-city-assets.yml",import.meta.url),"utf8");
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/actions\/upload-artifact/);
 assert.doesNotMatch(workflow,/wrangler|git push|secrets\./);
});
