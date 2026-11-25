// Visual projection only: the authenticated Worker owns positions and placement.
const KINDS=new Set(["dragon_nest","summon_altar"]);
export function planSpecialCityLandmarks(rows=[]){
 const seen=new Set(),out=[];
 for(const row of Array.isArray(rows)?rows:[]){
  const type=row?.building_type,x=row?.grid_x,z=row?.grid_z;
  if(!KINDS.has(type)||seen.has(type)||!Number.isSafeInteger(x)||!Number.isSafeInteger(z)||x< -25||z< -25||x>22||z>22||row.width!==3||row.height!==3)continue;
  seen.add(type);
  // Grid coordinates are upper-left; model anchor is the footprint center.
  out.push({building_type:type,position_x:x+1.5,position_z:z+1.5,level:1});
 }
 return out;
}
