// Prepare a reviewed CC0 asset bundle. No production changes, no remote runtime dependency.
import {createHash} from "node:crypto";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {validateAssetManifest} from "./validate-3d-assets.js";
export const SOURCE={
  "repository": "trebeljahr/quaternius-showcase",
  "revision": "0128ca510d653bb04d6d1e4885bd8890b5050b4f",
  "author": "Quaternius",
  "pack": "Medieval Village Pack",
  "sourceUrl": "https://quaternius.com/packs/medievalvillage.html",
  "license": "CC0-1.0",
  "files": [
    {
      "type": "lumber_mill",
      "filename": "Sawmill.glb",
      "bytes": 309568,
      "gitBlob": "61bb00a510792562bcad524ab874f8dcd6542b86",
      "targetFootprint": 1.8,
      "targetHeight": 1.8
    },
    {
      "type": "stable",
      "filename": "Stable.glb",
      "bytes": 444596,
      "gitBlob": "0a5d8cf36222f8a579bb44c9402a8f8df1b50da6",
      "targetFootprint": 1.8,
      "targetHeight": 1.8
    },
    {
      "type": "market",
      "filename": "MarketStand_1.glb",
      "bytes": 84992,
      "gitBlob": "3894530a8476c5411cb685278eafcaedd90e1249",
      "targetFootprint": 1.65,
      "targetHeight": 1.65
    }
  ]
};
export function verifyModel(bytes, entry){
 if(bytes.length!==entry.bytes)throw Error("Unexpected size: "+entry.filename);
 const blob=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
 if(blob!==entry.gitBlob)throw Error("Git blob mismatch: "+entry.filename);
 if(bytes.length<20||bytes.toString("ascii",0,4)!=="glTF"||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw Error("Invalid GLB: "+entry.filename);
 const length=bytes.readUInt32LE(12);
 if(length<2||20+length>bytes.length||length%4!==0)throw Error("Invalid GLB JSON chunk");
 const json=JSON.parse(bytes.subarray(20,20+length).toString("utf8").trim());
 if(json.asset?.version!=="2.0"||!Array.isArray(json.meshes)||!json.meshes.length)throw Error("Missing GLB geometry");
 for(const item of [...(json.images||[]),...(json.buffers||[])])if(item.uri!==undefined&&!String(item.uri).startsWith("data:"))throw Error("External GLB dependency: "+entry.filename);
 return {sha256:createHash("sha256").update(bytes).digest("hex"),meshes:json.meshes.length,animations:(json.animations||[]).map(x=>x.name||"unnamed")};
}
export async function prepareBundle({root=process.cwd(),fetchImpl=fetch}={}){
 // Only run in a disposable checkout. All downloads are verified before any file is written.
 const manifest=JSON.parse(await readFile(join(root,"assets/3d/manifest.json"),"utf8"));
 const files=[];
 for(const entry of SOURCE.files){
  const remote="https://raw.githubusercontent.com/"+SOURCE.repository+"/"+SOURCE.revision+"/public/glb/medieval_village_pack/"+entry.filename;
  const response=await fetchImpl(remote,{redirect:"error",signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error("Download failed: "+entry.filename);
  const bytes=Buffer.from(await response.arrayBuffer());
  const provenance=verifyModel(bytes,entry);
  const src="/assets/3d/quaternius/medieval-village/"+entry.filename;
  const id="quaternius-village-"+entry.type;
  if(manifest.models.some(x=>x.id===id||x.type===entry.type||x.src===src))throw Error("Duplicate model slot: "+entry.type);
  files.push({entry,bytes,src,id,provenance});
 }
 const folder=join(root,"assets/3d/quaternius/medieval-village");
 await mkdir(folder,{recursive:true});
 for(const item of files){
  await writeFile(join(folder,item.entry.filename),item.bytes,{flag:"wx"});
  manifest.models.push({id:item.id,type:item.entry.type,src:item.src,enabled:true,targetFootprint:item.entry.targetFootprint,targetHeight:item.entry.targetHeight,source:SOURCE.author+" "+SOURCE.pack,sourceUrl:SOURCE.sourceUrl,license:SOURCE.license});
 }
 const report={source:SOURCE,files:files.map(x=>({file:x.src,...x.provenance})),status:"prepared_for_visual_review"};
 await writeFile(join(folder,"PROVENANCE.json"),JSON.stringify(report,null,2)+"\n",{flag:"wx"});
 await writeFile(join(root,"assets/3d/manifest.json"),JSON.stringify(manifest,null,2)+"\n");
 await validateAssetManifest(root);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{console.log(JSON.stringify(await prepareBundle(),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
