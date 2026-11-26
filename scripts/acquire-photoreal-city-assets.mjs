// Offline acquisition only. Powered by Poly Haven (https://polyhaven.com).
// Outputs candidates for inspection; never changes game files or deploys.
import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const root=path.resolve(process.argv[2]||"art-candidates");
const ua="Clash-of-Izzy-art-acquisition/1.0 (GitHub Actions)";
const cap=24*1024*1024,totalCap=80*1024*1024;
let total=0;
const records=[];
function hash(algorithm,bytes){return createHash(algorithm).update(bytes).digest("hex");}
async function request(url,limit,hosts){
 const u=new URL(url);
 if(u.protocol!=="https:"||u.username||u.password||u.port||!hosts.includes(u.hostname))throw Error("Unapproved source");
 const response=await fetch(u,{headers:{"User-Agent":ua},redirect:"error",signal:AbortSignal.timeout(60000)});
 if(!response.ok||!response.body)throw Error("HTTP "+response.status+" "+u.hostname);
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error("Asset exceeds byte budget");chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
async function files(slug){return JSON.parse(await request("https://api.polyhaven.com/files/"+slug,2*1024*1024,["api.polyhaven.com"]));}
async function save(slug,relative,entry){
 if(!entry?.url||!Number.isSafeInteger(entry.size)||entry.size<1||entry.size>cap||! /^[a-f0-9]{32}$/i.test(entry.md5||""))throw Error("Missing size/hash for "+slug+"/"+relative);
 if(!relative.split("/").every(p=>/^[a-zA-Z0-9_.-]+$/.test(p)&&p!=="."&&p!==".."))throw Error("Invalid relative path");
 if(total+entry.size>totalCap)throw Error("Total budget exceeded");
 const bytes=await request(entry.url,entry.size,["dl.polyhaven.org","dl.polyhaven.com","cdn.polyhaven.com","cdn.polyhaven.org"]);
 if(bytes.length!==entry.size||hash("md5",bytes)!==entry.md5.toLowerCase())throw Error("Integrity mismatch "+relative);
 total+=bytes.length;
 const dest=path.join(root,slug,relative);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes);
 records.push({asset:slug,file:slug+"/"+relative,url:entry.url,source:"https://polyhaven.com/a/"+slug,license:"CC0-1.0",bytes:bytes.length,sha256:hash("sha256",bytes)});
}
await mkdir(root,{recursive:true});
for(const slug of ["medieval_wall_02","grassy_cobblestone"]){
 const listing=await files(slug);
 for(const [kind,name] of [["diff","color"],["nor_gl","normal"],["rough","roughness"]]){
  const entry=(listing[kind]||(kind==="diff"?listing.diffuse:null))?.["1k"]?.jpg;
  await save(slug,name+".jpg",entry);
 }
}
for(const slug of ["modular_fort_01","large_castle_door"]){
 const listing=await files(slug);
 const entry=listing.gltf?.["1k"]?.gltf;
 await save(slug,slug+".gltf",entry);
 for(const [name,dependency] of Object.entries(entry.include||{}))await save(slug,name,dependency);
}
await writeFile(path.join(root,"provenance.json"),JSON.stringify({provider:"Powered by Poly Haven",licenseUrl:"https://polyhaven.com/license",total,records},null,2)+"\n");
console.log("Verified candidates: "+records.length+" files, "+total+" bytes. No deployment.");
