// Offline candidate review. No runtime CDN or modifications to production assets.
import {mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const dir="art-candidates";
const picks={
 "medieval-rts-faction-buildings":{"24999":"hospital","25000":"academy","24995":"stable","24932":"lumber_mill","24936":"quarry"},
 "medieval-siege-and-castle-defence":{"28838":"castle_gate","28872":"cavalry"}
};
async function get(url,limit,host){
 const u=new URL(url);
 if(u.protocol!=="https:"||u.hostname!==host||u.username||u.password||u.port)throw Error("invalid source");
 const r=await fetch(u,{redirect:"error",signal:AbortSignal.timeout(45000)});
 if(!r.ok||!r.body)throw Error("HTTP "+r.status);
 const reader=r.body.getReader(),chunks=[];let n=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>limit)throw Error("size limit");chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
await mkdir(dir,{recursive:true});
const report=[];
for(const [pack,roles] of Object.entries(picks)){
 const manifest=JSON.parse(await get("https://3dassets.dev/api/v1/packs/"+pack,5*1024*1024,"3dassets.dev"));
 for(const [id,role] of Object.entries(roles)){
  const a=manifest.data?.assets?.find(x=>String(x.id)===id);
  if(!a||a.status!=="published"||a.license?.slug!=="cc0-1.0"||a.cdnUrl!=="https://cdn.3dassets.dev/assets/"+id+"/v1/model.glb")throw Error("unexpected provider metadata "+id);
  const b=await get(a.cdnUrl,2*1024*1024,"cdn.3dassets.dev");
  if(b.length<20||b.length!==a.stats?.fileSize||b.toString("ascii",0,4)!=="glTF"||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length||b.readUInt32LE(16)!==0x4e4f534a)throw Error("invalid GLB "+id);
  const len=b.readUInt32LE(12);if(len<2||len%4||20+len>b.length)throw Error("invalid JSON chunk");
  const g=JSON.parse(b.subarray(20,20+len).toString("utf8").trim());
  if(g.asset?.version!=="2.0"||!g.meshes?.length||[...(g.images||[]),...(g.buffers||[])].some(x=>x.uri!==undefined))throw Error("external or empty asset");
  const name=role+"-"+id+".glb";await writeFile(dir+"/"+name,b);
  report.push({role,name,title:a.title,source:a.url,sourceUrl:a.cdnUrl,license:"CC0-1.0",aiGenerated:a.aiGenerated,bytes:b.length,sha256:createHash("sha256").update(b).digest("hex"),animations:g.animations?.map(x=>x.name||"unnamed")||[],triangles:a.stats.triangles,approved:false});
 }
}
await writeFile(dir+"/candidate-report.json",JSON.stringify(report,null,2)+"\n");
console.log("Candidates validated structurally: "+report.length+". Visual approval still required.");
