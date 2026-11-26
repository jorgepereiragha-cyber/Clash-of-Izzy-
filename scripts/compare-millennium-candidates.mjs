// Compare the exact indexed triangle attributes of source and welded GLBs.
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {measureBundledGlbs,projectGlbAddition} from "./millennium-art-budget.mjs";
const [original,optimized]=process.argv.slice(2);
const manifest=JSON.parse(await readFile("assets/3d/manifest.json","utf8"));
const currentBytes=await measureBundledGlbs(manifest);
const report=JSON.parse(await readFile(path.join(original,"conversion-report.json"),"utf8"));
const output=[];
function signature(bytes){
 const len=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+len).toString().trim()),start=28+len;
 const primitive=g.meshes[0].primitives[0],idx=g.accessors[primitive.indices],iv=g.bufferViews[idx.bufferView];
 const hash=createHash("sha256");
 for(let i=0;i<idx.count;i++){
  const j=bytes.readUInt16LE(start+iv.byteOffset+(idx.byteOffset||0)+i*2);
  for(const [key,width] of [["POSITION",12],["NORMAL",12],["TEXCOORD_0",8]]){
   const a=g.accessors[primitive.attributes[key]],v=g.bufferViews[a.bufferView];
   if(j>=a.count)throw Error("Vertex index out of range");
   const offset=start+v.byteOffset+(a.byteOffset||0)+j*width;
   hash.update(bytes.subarray(offset,offset+width));
  }
 }
 return {hash:hash.digest("hex"),triangles:idx.count/3,images:g.images,materials:g.materials};
}
for(const item of report){
 const name=item.name+".glb",a=await readFile(path.join(original,name)),b=await readFile(path.join(optimized,name));
 const s1=signature(a),s2=signature(b);
 if(JSON.stringify(s1)!==JSON.stringify(s2)||b.length>a.length)throw Error("Candidate changes visual attributes or grows: "+name);
 output.push({name,originalBytes:a.length,optimizedBytes:b.length,savedBytes:a.length-b.length,sha256:createHash("sha256").update(b).digest("hex"),triangles:s2.triangles,budget:projectGlbAddition(currentBytes,b.length)});
}
const summary={currentBytes,candidates:output,castle:output.find(x=>x.name==="caro_fortress_struct.glb"),allThreeCivic:projectGlbAddition(currentBytes,output.filter(x=>/caro_(farmstead|market|storehouse)\.glb/.test(x.name)).reduce((s,x)=>s+x.optimizedBytes,0))};
await writeFile(path.join(optimized,"budget-report.json"),JSON.stringify(summary,null,2)+"\n");
console.log(JSON.stringify(summary,null,2));
