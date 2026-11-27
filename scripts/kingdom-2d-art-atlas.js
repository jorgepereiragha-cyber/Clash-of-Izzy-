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
  const key=String(value??"").trim().toLowerCase();
  return key==="low"||key==="high"?key:"balanced";
}
function localPath(path) {
  if(typeof path!=="string"||!path||path.includes("..")||!/^[-a-zA-Z0-9_ /.]+$/.test(path))return null;
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
function rememberImage(key,load){
  if(images.has(key)){const entry=images.get(key);images.delete(key);images.set(key,entry);return entry.promise;}
  const entry={image:null,promise:null};
  entry.promise=Promise.resolve().then(load).then(image=>{entry.image=image;return image;})
    .catch(error=>{if(images.get(key)===entry)images.delete(key);throw error;});
  images.set(key,entry);
  while(images.size>LIMIT)images.delete(images.keys().next().value);
  return entry.promise;
}
function decodeImage(url,ImageClass=globalThis.Image){
  return new Promise((resolve,reject)=>{
    const img=new ImageClass();img.decoding="async";
    img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Imagem indisponível: "+url));img.src=url;
  });
}
export function loadCachedImage(url,ImageClass=globalThis.Image) {
  if(typeof url!=="string"||!url.startsWith("/assets/")||localPath(url)!==url)return Promise.reject(new Error("URL de arte inválida"));
  return rememberImage(url,()=>decodeImage(url,ImageClass));
}
export function imageCacheInfo(){return {size:images.size,limit:LIMIT,keys:[...images.keys()]};}
// Small separate cache of source XML, not decoded images. No remote URLs.
const atlasDocuments=new Map(),ATLAS_LIMIT=4;
function loadSvgAtlas(path){
  if(atlasDocuments.has(path))return atlasDocuments.get(path);
  const request=fetch(path,{credentials:"same-origin"}).then(r=>{if(!r.ok)throw new Error("Atlas indisponível");return r.text();})
    .then(xml=>{const doc=new DOMParser().parseFromString(xml,"image/svg+xml");if(doc.querySelector("parsererror")||doc.documentElement.localName!=="svg")throw new Error("Atlas inválido");return doc;})
    .catch(error=>{if(atlasDocuments.get(path)===request)atlasDocuments.delete(path);throw error;});
  atlasDocuments.set(path,request);while(atlasDocuments.size>ATLAS_LIMIT)atlasDocuments.delete(atlasDocuments.keys().next().value);
  return request;
}
export function loadEntityCanvasImage(asset){
  if(asset?.kind==="image")return loadCachedImage(asset.src);
  const parts=typeof asset?.src==="string"?asset.src.split("#"):[];
  const [path,symbol]=parts;
  if(asset?.kind!=="symbol"||parts.length!==2||!path?.startsWith("/assets/")||localPath(path)!==path||!path.endsWith(".svg")||!/^[-a-zA-Z0-9_]+$/.test(symbol||""))return Promise.reject(new Error("Símbolo inválido"));
  return rememberImage(asset.src,async()=>{
    const doc=await loadSvgAtlas(path),ns="http://www.w3.org/2000/svg";
    const node=Array.from(doc.querySelectorAll("symbol")).find(s=>s.getAttribute("id")===symbol);
    if(!node)throw new Error("Símbolo ausente: "+symbol);
    const svg=doc.createElementNS(ns,"svg");
    const viewBox=node.getAttribute("viewBox")||asset.viewBox||"0 0 100 100";
    svg.setAttribute("viewBox",viewBox);
    const dimensions=viewBox.trim().split(/\s+/).map(Number);
    if(dimensions.length!==4||!dimensions.every(Number.isFinite)||dimensions[2]<=0||dimensions[3]<=0)throw new Error("Dimensões inválidas");
    svg.setAttribute("width",String(dimensions[2]));svg.setAttribute("height",String(dimensions[3]));
    for(const child of Array.from(doc.documentElement.children))if(child.localName==="defs")svg.append(child.cloneNode(true));
    svg.append(node.cloneNode(true));
    const use=doc.createElementNS(ns,"use");use.setAttribute("href","#"+symbol);use.setAttribute("width",String(dimensions[2]));use.setAttribute("height",String(dimensions[3]));svg.append(use);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:"image/svg+xml;charset=utf-8"}));
    try{return await decodeImage(url);}finally{URL.revokeObjectURL(url);}
  });
}
export function peekEntityCanvasImage(asset){
  const entry=images.get(asset?.src);
  if(!entry?.image)return null;
  images.delete(asset.src);images.set(asset.src,entry);
  return entry.image;
}
export function createEntityArtElement(asset,doc=globalThis.document) {
  if(!asset||!doc)return null;
  if(asset.kind==="image"){const img=doc.createElement("img");img.src=asset.src;img.alt="";img.decoding="async";img.loading="lazy";return img;}
  const ns="http://www.w3.org/2000/svg",svg=doc.createElementNS(ns,"svg"),use=doc.createElementNS(ns,"use");
  svg.setAttribute("viewBox",asset.viewBox);svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");use.setAttribute("href",asset.src);svg.append(use);return svg;
}

// Canonical resource art shared by the map, HUD and resource-node cards.
const WORLD_RESOURCE_KEYS=new Set(["food","wood","stone","iron","gold","gems"]);
export function worldResourceArt(key,doc=globalThis.document){
  if(!WORLD_RESOURCE_KEYS.has(key))return null;
  const art=createEntityArtElement({kind:"symbol",src:"/assets/art/eldoria/hud.svg#resource-"+key,viewBox:"0 0 100 100"},doc);
  art?.classList.add("world-resource-art");return art;
}
