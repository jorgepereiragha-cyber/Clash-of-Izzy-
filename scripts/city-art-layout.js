// Shared visual conversion only. The server-supplied cityLayout remains authoritative.
export const CITY_TILE_WORLD = .53;
export function readCityFootprint(catalog,type){
 const f=catalog&&Object.hasOwn(catalog,type)?catalog[type]:null;
 return f&&Number.isInteger(f.width)&&Number.isInteger(f.height)&&f.width>=1&&f.width<=5&&f.height>=1&&f.height<=5?f:null;
}
export function cityModelAnchor(x,z,footprint){
 return {x:(x+(footprint?footprint.width/2:0))*CITY_TILE_WORLD,z:(z+(footprint?footprint.height/2:0))*CITY_TILE_WORLD};
}
// Fit asymmetrical models within their reserved plot without changing D1 coordinates.
export function cityModelFit(type,footprint,extentX,extentZ){
 if(!footprint||!Number.isFinite(extentX)||!Number.isFinite(extentZ)||extentX<=0||extentZ<=0)return 1;
 const limit=type==="castle"?1.4:1;
 return Math.min(limit,footprint.width*CITY_TILE_WORLD*.92/(2*extentX),footprint.height*CITY_TILE_WORLD*.92/(2*extentZ));
}
