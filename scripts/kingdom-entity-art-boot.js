import {loadEntityManifest,resolveEntity2DAsset,createEntityArtElement,resolveQualityFolder,loadEntityCanvasImage,peekEntityCanvasImage,loadCachedImage,imageCacheInfo} from "./kingdom-2d-art-atlas.js";
export const normalizeQualityProfile=resolveQualityFolder;
export class KingdomEntityArtController {
  constructor({manifest,quality="balanced"}={}){this.manifest=manifest||{version:2};this.setQuality(quality);}
  setQuality(profile){this.quality=normalizeQualityProfile(profile);}
  getAsset(category,id,tier=1){return resolveEntity2DAsset(this.manifest,category,id,{quality:this.quality,tier});}
  getBuildingAsset(id,tier=1){return this.getAsset("buildings",id,tier);}
  // Match the nine visible Canvas plots and resolve the exact artwork
  // selected by the renderer (level and graphics quality included).
  getCityPreloadAssets(buildings){
    const unique=new Map();
    for(const building of (Array.isArray(buildings)?buildings:[]).slice(0,9)){
      const asset=this.getBuildingAsset(building?.building_type,building?.level);
      if(asset&&!unique.has(asset.src))unique.set(asset.src,asset);
    }
    return [...unique.values()];
  }
  getDragonPortrait(id){return this.getAsset("dragons",id);}
  getTroopIcon(id){return this.getAsset("troops",id);}
  getHeroPortrait(id){return this.getAsset("heroes",id);}
  acquireImage(url,ImageClass){return loadCachedImage(url,ImageClass);}
  cacheInfo(){return imageCacheInfo();}
  preload(category,id,tier=1){const asset=this.getAsset(category,id,tier);return asset?loadEntityCanvasImage(asset).catch(()=>null):Promise.resolve(null);}
  drawCanvas2DEntity(ctx,{category,id,tier=1,x,y,w,h}){
    if(!ctx||![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return false;
    const asset=this.getAsset(category,id,tier),image=asset&&peekEntityCanvasImage(asset);
    if(!image)return false;
    try{ctx.drawImage(image,x,y,w,h);return true;}catch{return false;}
  }
  bindDomArtTargets(root){
    for(const host of root.querySelectorAll("[data-entity-art-category][data-entity-art-id]")){
      const asset=this.getAsset(host.dataset.entityArtCategory,host.dataset.entityArtId,host.dataset.entityArtTier);
      if(host.hasAttribute("data-entity-art-existing")){
        const use=host.querySelector("use");
        if(use&&asset?.kind==="symbol")use.setAttribute("href",asset.src);
        continue;
      }
      const old=host.querySelector(".coi-entity-art");
      if(!asset){old?.remove();continue;}
      if(old?.dataset.artSource===asset.src)continue;
      const node=createEntityArtElement(asset,host.ownerDocument);
      if(!node)continue;
      node.classList.add("coi-entity-art");node.dataset.artSource=asset.src;
      if(host.classList.contains("resource-icon"))host.replaceChildren(node);
      else {old?.remove();host.prepend(node);}
    }
  }
}
if(typeof window!=="undefined"&&typeof document!=="undefined"){
  let controller,revision=0,inFlightSignature=null;
  const currentBuildings=()=>window.__coiKingdomBuildings||[];
  const city=()=>document.getElementById("city");
  function updatePreviews(){
    for(const [selectId,previewId] of [["unitType","coiTroopArtPreview"],["coiHeroCandidate","coiHeroArtPreview"]]){
      const select=document.getElementById(selectId),preview=document.getElementById(previewId);
      if(select&&preview)preview.dataset.entityArtId=select.value;
    }
  }
  function paint(){
    if(!controller)return;
    controller.setQuality(city()?.dataset.qualityTier);
    updatePreviews();controller.bindDomArtTargets(document);
  }
  function warmCity(){
    const host=city();if(!controller||!host||host.classList.contains("has-3d"))return;
    const assets=controller.getCityPreloadAssets(currentBuildings());
    const missing=assets.filter(asset=>!peekEntityCanvasImage(asset));
    if(!missing.length){
      if(inFlightSignature!==null){++revision;inFlightSignature=null;}
      return;
    }
    // A previously loaded URL may have been evicted by the bounded cache.
    // Retry missing artwork without duplicating concurrent decodes.
    const signature=JSON.stringify(assets.map(asset=>asset.src));
    if(signature===inFlightSignature)return;
    inFlightSignature=signature;const run=++revision;
    Promise.all(missing.map(asset=>loadEntityCanvasImage(asset).catch(()=>null))).then(results=>{
      if(run!==revision)return;
      inFlightSignature=null;
      if(results.some(Boolean)&&!host.classList.contains("has-3d"))window.dispatchEvent(new Event("coi:entity-art-ready"));
    });
  }
  function render(){paint();warmCity();}
  for(const type of ["coi:kingdom-render","coi:kingdom-2d-fallback","coi:entity-art-targets"])window.addEventListener(type,()=>queueMicrotask(render));
  document.addEventListener("change",event=>{if(["unitType","coiHeroCandidate","coiHeroRole"].includes(event.target?.id))queueMicrotask(paint);});
  loadEntityManifest().then(manifest=>{
    controller=new KingdomEntityArtController({manifest});
    window.__coiDrawCityEntityArt=(ctx,options)=>controller.drawCanvas2DEntity(ctx,options);
    render();
  }).catch(()=>{/* Existing DOM and procedural art continue to work. */});
}
