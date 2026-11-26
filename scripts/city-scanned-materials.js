// Local-only, audited photo-scan maps. No remote image requests at runtime.
export const CITY_SCANNED_MATERIALS=Object.freeze({
  "stone": {
    "color": "/assets/3d/materials/stone-color.jpg",
    "normal": "/assets/3d/materials/stone-normal.jpg"
  },
  "wood": {
    "color": "/assets/3d/materials/wood-color.jpg",
    "normal": "/assets/3d/materials/wood-normal.jpg"
  }
});
export function scannedMaterialResolution(profile){
 return profile?.loadOptionalAssets&&profile?.pbrMaps?profile.tier==="high"?512:256:0;
}
export function neutralizeScanColor(data){
 // Normalize photo texture into neutral detail before applying owned skin tint.
 let sum=0;for(let i=0;i<data.length;i+=4)sum+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
 const mean=sum/Math.max(1,data.length/4);
 for(let i=0;i<data.length;i+=4){const y=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];const v=Math.max(35,Math.min(255,Math.round(206+(y-mean)*.82)));data[i]=data[i+1]=data[i+2]=v;}
 return data;
}
