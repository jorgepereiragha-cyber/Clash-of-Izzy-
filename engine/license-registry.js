// Registry uses exact canonical full paths, not basenames. No network third-party loads.
export const REGISTRY_PATH="/assets/3d/licenses.json";
export const ACCEPTED_LICENSES=Object.freeze(["CC0-1.0","CC-BY-4.0"]);
const LICENSE_URLS={"CC0-1.0":"https://creativecommons.org/publicdomain/zero/1.0/","CC-BY-4.0":"https://creativecommons.org/licenses/by/4.0/"};
function https(value){try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password}catch{return false}}
export function canonicalAssetPath(value,origin="https://local.invalid"){
 if(typeof value!=="string"||value.includes("\\")||/[?#]/.test(value))throw Error("Caminho de asset inválido.");
 const decoded=decodeURIComponent(value);
 if(decoded.includes("\\")||/[?#\u0000]/.test(decoded)||decoded.split("/").some(x=>x===".."||x==="."))throw Error("Caminho de asset inválido.");
 const u=new URL(value,origin);
 if(u.origin!==origin||u.username||u.password||u.search||u.hash)throw Error("Asset externo não aprovado.");
 const path=decodeURIComponent(u.pathname);
 if(!/^\/assets\/(?:3d|models|textures)\/.+\.(?:glb|png|jpe?g|webp|ktx2)$/i.test(path))throw Error("Asset fora do registro.");
 return path;
}
export function validateLicenseRegistry(registry){
 if(registry?.version!==1||!registry.assets||Array.isArray(registry.assets)||typeof registry.assets!=="object")throw Error("Registro de licenças inválido.");
 const map=new Map();
 for(const [path,item] of Object.entries(registry.assets)){
  if(canonicalAssetPath(path)!==path||!item||!ACCEPTED_LICENSES.includes(item.license)||item.licenseUrl!==LICENSE_URLS[item.license]||!https(item.source)||typeof item.attribution!=="string"||!item.attribution.trim()||typeof item.title!=="string"||!item.title.trim()||typeof item.modified!=="boolean"||!/^\d{4}-\d{2}-\d{2}$/.test(item.reviewedAt||"")||!/^([0-9a-f]{64})$/.test(item.sha256||""))throw Error("Licença não aprovada: "+path);
  if(item.modified&&(!item.changes||typeof item.changes!=="string"))throw Error("Alterações sem descrição: "+path);
  map.set(path,Object.freeze({...item}));
 }
 return map;
}
export function assertLicensedAsset(registry,url,origin="https://local.invalid",manifestEntry=null){
 const path=canonicalAssetPath(url,origin);
 const entry=registry.get(path);
 if(!entry)throw Error("Asset sem licença registrada: "+path);
 if(manifestEntry&&(entry.license!==manifestEntry.license||entry.source!==manifestEntry.sourceUrl))throw Error("Licença diverge do manifesto: "+path);
 return entry;
}
let request;
export function loadLicenseRegistry(){
 if(!request)request=fetch(REGISTRY_PATH,{credentials:"same-origin",cache:"no-cache",redirect:"error"}).then(async r=>{
  if(!r.ok)throw Error("Registro de licenças indisponível.");
  return validateLicenseRegistry(await r.json());
 }).catch(error=>{request=undefined;throw error});
 return request;
}
