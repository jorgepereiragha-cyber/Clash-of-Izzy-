import {loadEntityManifest,resolveEntity2DAsset,createEntityArtElement} from "./kingdom-2d-art-atlas.js";
// Optional DOM decoration; existing controls and labels remain authoritative.
let manifest;
function paint() {
  if(!manifest)return;
  for(const host of document.querySelectorAll("[data-entity-art-category][data-entity-art-id]")){
    if(host.querySelector(".coi-entity-art"))continue;
    const asset=resolveEntity2DAsset(manifest,host.dataset.entityArtCategory,host.dataset.entityArtId,{quality:document.getElementById("city")?.dataset.qualityTier});
    const node=createEntityArtElement(asset);
    if(!node)continue;
    // Preserve original fallback text until vector art is available.
    if(host.classList.contains("resource-icon"))host.replaceChildren();
    node.classList.add("coi-entity-art");host.prepend(node);
  }
}
window.addEventListener("coi:kingdom-render",paint);
loadEntityManifest().then(value=>{manifest=value;paint();}).catch(()=>{/* no impact on play */});
