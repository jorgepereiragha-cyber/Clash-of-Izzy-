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

// Visual formations inspired by RTS conventions, not combat or speed modifiers.
// The existing maximum of three soldiers per march is preserved on all tiers.
export function planMarchFormation(type,quality="balanced"){
 const low=quality==="low";
 if(type==="attack")return {color:"red",positions:low?[[0,.48],[0,-.45]]:[[0,.55],[-.48,-.28],[.48,-.28]]};
 if(type==="gather")return {color:"green",positions:low?[[0,.42],[0,-.42]]:[[0,.78],[0,0],[0,-.78]]};
 if(type==="scout")return {color:"gold",positions:low?[[0,.15]]:[[-.42,.20],[.42,-.20]]};
 return {color:"blue",positions:low?[[-.4,0],[.4,0]]:[[-.42,-.28],[.42,-.28],[0,.48]]};
}
