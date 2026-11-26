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


// Decorative streets only: blocked plots remain authoritative, and no path changes
// building positions or creates a gameplay entity. A bounded, deterministic grid
// search connects available plot perimeters without crossing occupied cells.
export function planCityStreetCells(plots){
 const min=-25,max=24,key=(x,z)=>`${x},${z}`;
 const neighbors=([x,z])=>[[x-1,z],[x+1,z],[x,z-1],[x,z+1]].filter(([a,b])=>a>=min&&a<=max&&b>=min&&b<=max);
 const rects=(Array.isArray(plots)?plots:[]).slice(0,24).filter(p=>p&&[p.minX,p.maxX,p.minZ,p.maxZ].every(Number.isFinite)&&p.minX<p.maxX&&p.minZ<p.maxZ).map(p=>({
  x0:Math.max(min,Math.floor(p.minX/CITY_TILE_WORLD+1e-6)),
  x1:Math.min(max,Math.ceil(p.maxX/CITY_TILE_WORLD-1e-6)-1),
  z0:Math.max(min,Math.floor(p.minZ/CITY_TILE_WORLD+1e-6)),
  z1:Math.min(max,Math.ceil(p.maxZ/CITY_TILE_WORLD-1e-6)-1)
 })).filter(p=>p.x0<=p.x1&&p.z0<=p.z1);
 if(rects.length<2)return [];
 const blocked=new Set();
 for(const p of rects)for(let x=p.x0;x<=p.x1;x++)for(let z=p.z0;z<=p.z1;z++)blocked.add(key(x,z));
 const perimeter=p=>{
  const cells=[];
  for(let x=p.x0;x<=p.x1;x++)cells.push([x,p.z0-1],[x,p.z1+1]);
  for(let z=p.z0;z<=p.z1;z++)cells.push([p.x0-1,z],[p.x1+1,z]);
  return cells.filter(([x,z])=>x>=min&&x<=max&&z>=min&&z<=max&&!blocked.has(key(x,z)));
 };
 const network=new Map();
 for(const p of rects){
  const starts=perimeter(p);
  if(!starts.length)continue;
  if(!network.size){
   // Begin near the center of the settlement, not at an arbitrary plot corner.
   starts.sort((a,b)=>Math.abs(a[0])+Math.abs(a[1])-Math.abs(b[0])-Math.abs(b[1]));
   network.set(key(...starts[0]),starts[0]);continue;
  }
  const queue=starts.slice(),prev=new Map(starts.map(c=>[key(...c),null]));
  let found=null;
  for(let i=0;i<queue.length;i++){
   const cell=queue[i],k=key(...cell);
   if(network.has(k)){found=cell;break;}
   for(const next of neighbors(cell)){
    const nk=key(...next);
    if(blocked.has(nk)||prev.has(nk))continue;
    prev.set(nk,cell);queue.push(next);
   }
  }
  for(let c=found;c;c=prev.get(key(...c)))network.set(key(...c),c);
 }
 return network.size>1?[...network.values()].map(([x,z])=>({x,z})):[];
}
