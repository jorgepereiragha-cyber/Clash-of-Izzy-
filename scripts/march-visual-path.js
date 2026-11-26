// Original presentation-only interpolation. Does not alter authoritative arrival or combat.
export function marchVisualProgress(now,start,end){
 if(![now,start,end].every(Number.isFinite)||end<=start)return 0;
 return Math.max(0,Math.min(1,(now-start)/(end-start)));
}
export function marchVisualPoint(origin,target,progress){
 const t=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
 const dx=target.x-origin.x,dz=target.z-origin.z;
 return {x:origin.x+dx*t,z:origin.z+dz*t,heading:Math.atan2(dx,dz)};
}
