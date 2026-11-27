// Strict build-time GLB budget; includes disabled alternatives and measures actual bytes.
import {readFile,readdir} from "node:fs/promises";
import path from "node:path";
export const GLB_BUDGET_BYTES=4_600_000;
export function registeredGlbPaths(manifest){
 if(manifest?.version!==2)throw Error("Expected manifest v2");
 const paths=new Set();
 for(const category of ["models","props","units"]){
  if(!Array.isArray(manifest[category]))throw Error("Missing "+category);
  for(const entry of manifest[category]){
   if(typeof entry.src!=="string"||!/^\/assets\/3d\/[^?#\\]+\.glb$/i.test(entry.src)||entry.src.split("/").some(p=>p===".."||p==="."))throw Error("Invalid GLB path");
   if(paths.has(entry.src))throw Error("Duplicate bundled GLB path "+entry.src);
   paths.add(entry.src);
  }
 }
 return [...paths];
}
export async function measureBundledGlbs(manifest,root=process.cwd()){
 const registered=new Set(registeredGlbPaths(manifest));
 async function scan(dir,prefix){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const src=prefix+"/"+entry.name;
   if(entry.isSymbolicLink())throw Error("Unexpected symlink in asset directory "+src);
   if(entry.isDirectory())await scan(path.join(dir,entry.name),src);
   else if(/\.glb$/i.test(entry.name)&&!registered.has(src))throw Error("Unregistered bundled GLB "+src);
  }
 }
 await scan(path.join(root,"assets","3d"),"/assets/3d");
 let total=0;
 for(const src of registered){
  const declared=manifest.files?.[src]?.bytes;
  const bytes=(await readFile(path.join(root,src.slice(1)))).length;
  if(!Number.isSafeInteger(declared)||declared!==bytes||bytes<=0)throw Error("Invalid byte provenance "+src);
  total+=bytes;
 }
 return total;
}
export function projectGlbAddition(currentBytes,candidateBytes){
 if(!Number.isSafeInteger(currentBytes)||currentBytes<0||!Number.isSafeInteger(candidateBytes)||candidateBytes<=0)throw Error("Invalid byte count");
 const projectedBytes=currentBytes+candidateBytes;
 if(!Number.isSafeInteger(projectedBytes))throw Error("Unsafe total");
 return {currentBytes,candidateBytes,projectedBytes,remainingBytes:GLB_BUDGET_BYTES-1-projectedBytes,allowed:projectedBytes<GLB_BUDGET_BYTES};
}
export function bindBuildingModel(manifest,type,id){
 const entry=manifest?.entityArt?.buildings?.[type];
 if(manifest?.version!==2||!entry||!Object.hasOwn(manifest.entityArt.buildings,type))throw Error("Unknown canonical building");
 const active=manifest.models.filter(a=>a.type===type&&a.enabled===true);
 if(active.length!==1||active[0].id!==id||!manifest.files?.[active[0].src])throw Error("Exactly one registered enabled model required");
 return {...manifest,entityArt:{...manifest.entityArt,buildings:{...manifest.entityArt.buildings,[type]:{...entry,webgl:{...entry.webgl,modelIds:[id]}}}}};
}
