import {mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {join,resolve,basename} from "node:path";
import {pathToFileURL} from "node:url";
export const FAMILIES=["medieval_wall_02","medieval_blocks_03","red_slate_roof_tiles_01","clay_roof_tiles_02","medieval_wood","old_wood_floor","rusty_metal_05","fabric_pattern_05","withered_grass","cobblestone_floor_001"];
const maps=[["diff","albedo"],["col_01","albedo"],["nor_gl","normal"],["rough","roughness"],["ao","ao"],["metal","metalness"]];
const LIMIT=8*1024*1024;
export function selectMaps(metadata){
 const chosen=new Map();
 for(const [key,role] of maps){
  if(chosen.has(role))continue;
  const formats=metadata?.[key]?.["1k"];
  const ext=formats?.png?"png":formats?.jpg?"jpg":null;
  const entry=ext&&formats[ext];if(!entry)continue;
  const url=new URL(entry.url);
  if(url.protocol!=="https:"||!["dl.polyhaven.org","cdn.polyhaven.com"].includes(url.hostname)||url.username||url.password)throw Error("Unexpected Poly Haven download origin");
  if(!Number.isSafeInteger(entry.size)||entry.size<1||entry.size>LIMIT||!/^[a-f0-9]{32}$/i.test(entry.md5||""))throw Error("Invalid provider size/hash");
  chosen.set(role,{role,ext,url:url.href,size:entry.size,md5:entry.md5.toLowerCase()});
 }
 if(!chosen.has("albedo"))throw Error("No reviewed albedo at 1k");
 return [...chosen.values()];
}
export async function acquire(folder,{fetchImpl=fetch}={}){
 if(basename(resolve(folder))!=="raw_textures")throw Error("Output must be a raw_textures staging directory");
 await mkdir(folder,{recursive:true});
 const report={license:"CC0-1.0",licenseUrl:"https://polyhaven.com/license",provider:"Poly Haven",resolution:"1k",files:[],missing:[]};
 let total=0;
 const get=async(url)=>{const res=await fetchImpl(url,{headers:{"User-Agent":"ClashOfIzzy-AssetPreparation/1.0"},redirect:"error",signal:AbortSignal.timeout(45000)});if(!res.ok)throw Error("HTTP "+res.status);return res};
 for(const id of FAMILIES){
  try{
   const metadata=await (await get("https://api.polyhaven.com/files/"+id)).json();
   const selected=selectMaps(metadata);
   for(const item of selected){
    const response=await get(item.url);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length!==item.size||createHash("md5").update(bytes).digest("hex")!==item.md5)throw Error("Provider checksum mismatch "+id);
    total+=bytes.length;if(total>80*1024*1024)throw Error("Staging budget exceeded");
    const file=id+"_"+item.role+"."+item.ext;
    await writeFile(join(folder,file),bytes,{flag:"wx"});
    report.files.push({file,source:"https://polyhaven.com/a/"+id,license:"CC0-1.0",role:item.role,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
   }
  }catch(e){report.missing.push({id,error:String(e.message).slice(0,200)});}
 }
 await writeFile(join(folder,"PROVENANCE.json"),JSON.stringify(report,null,2)+"\n",{flag:"wx"});
 if(report.missing.length)throw Error("Incomplete texture acquisition; see PROVENANCE.json. No publication.");
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const report=await acquire(process.argv[2]||"raw_textures");console.log("Prepared "+report.files.length+" texture maps.");}catch(e){console.error(e.message);process.exitCode=1;}
}
