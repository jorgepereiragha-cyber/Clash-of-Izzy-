// Shared local manifest, usable without WebGL or engine dependencies.
let pending;
export function loadEntityManifest(fetcher=globalThis.fetch) {
  if (!pending) pending=Promise.resolve().then(()=>fetcher("/assets/3d/manifest.json",{cache:"no-cache"}))
    .then(r=>{if(!r.ok)throw new Error("Manifesto de arte indisponível");return r.json();})
    .catch(error=>{pending=undefined;throw error;});
  return pending;
}
const own=(obj,key)=>obj&&typeof key==="string"&&Object.hasOwn(obj,key)?obj[key]:null;
export function resolveQualityFolder(value) {
  return value==="low"||value==="high"?value:"balanced";
}
function localPath(path) {
  if(typeof path!=="string"||!path||path.includes("..")||!/^[-a-zA-Z0-9_ /%.]+$/.test(path))return null;
  const relative=path.replace(/^\/?assets\//,"");
  if(relative.startsWith("/")||!relative.includes("/"))return null;
  return "/assets/"+relative;
}
export function resolveEntity2DAsset(manifest,category,id,{tier=1,quality="balanced"}={}) {
  const entry=own(own(manifest?.entityArt,category),id);
  if(!entry)return null;
  const tierEntry=own(entry.tiers,String(Math.max(1,Math.floor(Number(tier)||1))));
  const spec=tierEntry?.canvas2d||entry.canvas2d;
  if(!spec)return null;
  const selected=own(spec.quality,resolveQualityFolder(quality))||spec;
  const src=localPath(selected.src);
  if(src&&/\.(webp|png|jpe?g|svg)$/i.test(src))return {kind:"image",src};
  const atlas=localPath(selected.atlas);
  if(!atlas||!atlas.endsWith(".svg")||!/^[-a-zA-Z0-9_]+$/.test(selected.symbol||""))return null;
  return {kind:"symbol",src:atlas+"#"+selected.symbol,viewBox:/^\d+(?: \d+){3}$/.test(selected.viewBox||"")?selected.viewBox:"0 0 100 100"};
}
export const resolveBuilding2DAsset=(m,id,tier=1,quality="balanced")=>resolveEntity2DAsset(m,"buildings",id,{tier,quality});
export const resolveDragon2DAsset=(m,id)=>resolveEntity2DAsset(m,"dragons",id);
export const resolveTroop2DAsset=(m,id)=>resolveEntity2DAsset(m,"troops",id);
export const resolveHero2DPortrait=(m,id)=>resolveEntity2DAsset(m,"heroes",id);
const images=new Map(),LIMIT=48;
export function loadCachedImage(url,ImageClass=globalThis.Image) {
  if(typeof url!=="string"||!url.startsWith("/assets/")||localPath(url)!==url)return Promise.reject(new Error("URL de arte inválida"));
  if(images.has(url)){const p=images.get(url);images.delete(url);images.set(url,p);return p;}
  const p=Promise.resolve().then(()=>new Promise((resolve,reject)=>{
    const img=new ImageClass();img.decoding="async";img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Imagem indisponível: "+url));img.src=url;
  })).catch(error=>{if(images.get(url)===p)images.delete(url);throw error;});
  images.set(url,p);while(images.size>LIMIT)images.delete(images.keys().next().value);
  return p;
}
export function createEntityArtElement(asset,doc=globalThis.document) {
  if(!asset||!doc)return null;
  if(asset.kind==="image"){const img=doc.createElement("img");img.src=asset.src;img.alt="";img.decoding="async";img.loading="lazy";return img;}
  const ns="http://www.w3.org/2000/svg",svg=doc.createElementNS(ns,"svg"),use=doc.createElementNS(ns,"use");
  svg.setAttribute("viewBox",asset.viewBox);svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");use.setAttribute("href",asset.src);svg.append(use);return svg;
}
