// Check actual assets against the reviewed registry. Never auto-approve an unregistered file.
import {readFile,writeFile,readdir,lstat,realpath} from "node:fs/promises";
import {createHash} from "node:crypto";
import {join,resolve,sep} from "node:path";
import {pathToFileURL} from "node:url";
import {validateLicenseRegistry,assertLicensedAsset} from "../engine/license-registry.js";
export const renderCredits=(reg)=>{const groups=new Map();for(const item of Object.values(reg.assets)){const key=JSON.stringify([item.attribution,item.title,item.source,item.license,item.licenseUrl,item.modified,item.changes||""]);if(!groups.has(key))groups.set(key,item)};const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");return '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Créditos | Clash of Izzy</title><link rel="stylesheet" href="/styles/coi-theme.css"><style>body{margin:0;background:#101a2b;color:#f1e6cf;font:16px/1.6 system-ui}main{max-width:760px;margin:auto;padding:32px 20px}a{color:#f1c467}li{margin:12px 0}h1{color:#f1c467}</style></head><body><main><h1>Créditos de arte</h1><p>Recursos 3D e texturas de terceiros registrados nesta versão.</p><ul>\n'+[...groups.values()].map(i=>'<li>'+esc(i.title)+' — '+esc(i.attribution)+' · <a href="'+esc(i.source)+'">Origem</a> · <a href="'+esc(i.licenseUrl)+'">'+esc(i.license)+'</a>'+(i.modified?' · Alterações: '+esc(i.changes):'')+'</li>').join('\n')+'\n</ul><p>Clash of Izzy é um projeto independente. Créditos CC0 são voluntários.</p><p><a href="/portal.html">Portal oficial</a></p></main></body></html>\n'};
async function walk(dir){
 const result=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  const p=join(dir,e.name);
  if(e.isSymbolicLink())throw Error("Symlink não permitido: "+p);
  if(e.isDirectory())result.push(...await walk(p));else if(e.isFile())result.push(p);
 }
 return result;
}
export async function verifyLicenses(root=process.cwd(),{write=false}={}){
 root=await realpath(root);
 const raw=JSON.parse(await readFile(join(root,"assets/3d/licenses.json"),"utf8"));
 const registry=validateLicenseRegistry(raw);
 const manifest=JSON.parse(await readFile(join(root,"assets/3d/manifest.json"),"utf8"));
 for(const entry of [...manifest.models,...manifest.props,...manifest.units])if(entry.enabled)assertLicensedAsset(registry,entry.src,"https://local.invalid",entry);
 const scanned=new Set();
 for(const dir of ["assets/3d","assets/models","assets/textures"]){
  const folder=join(root,dir);
  if(dir==="assets/textures"){try{await lstat(folder)}catch(e){if(e.code==="ENOENT")continue;throw e}}
  if((await lstat(folder)).isSymbolicLink())throw Error("Diretório de assets não pode ser symlink: "+dir);
  for(const p of await walk(folder)){
   if(!/\.(glb|png|jpe?g|webp|ktx2)$/i.test(p))continue;
   const key="/"+p.slice(root.length+1).split(sep).join("/");
   const item=assertLicensedAsset(registry,key);
   const data=await readFile(p);
   if(createHash("sha256").update(data).digest("hex")!==item.sha256)throw Error("SHA-256 divergente: "+key);
   scanned.add(key);
  }
 }
 for(const key of registry.keys())if(!scanned.has(key))throw Error("Registro sem arquivo verificado: "+key);
 const credits=renderCredits(raw);
 for(const file of ["creditos.html","public-portal/creditos.html"]){
  const p=join(root,file);
  if(write)await writeFile(p,credits);
  else if(await readFile(p,"utf8")!==credits)throw Error("Créditos desatualizados: "+file);
 }
 return {registered:registry.size,verified:scanned.size,issues:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{console.log(JSON.stringify(await verifyLicenses(process.cwd(),{write:process.argv.includes("--write")})));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
