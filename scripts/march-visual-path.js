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

const UNIT_TYPES=Object.freeze(["militia","swordsman","spearman","archer","crossbowman","cavalry","knight","mage","catapult","ram","trebuchet"]);
// Only the authenticated server snapshot feeds this presentation; unknown or
// malformed content is ignored, and representative count is strictly bounded.
export function readMarchComposition(value){
 let row=value;
 if(typeof row==="string"){if(row.length>4096)return [];try{row=JSON.parse(row);}catch{return [];}}
 if(!row||typeof row!=="object"||Array.isArray(row))return [];
 return UNIT_TYPES.flatMap(type=>{const count=Object.hasOwn(row,type)?row[type]:0;return Number.isSafeInteger(count)&&count>0?[{type,count}]:[];});
}
export function planMarchRepresentatives(value,budget){
 const limit=Math.max(0,Math.min(3,Math.floor(Number(budget)||0)));
 const units=readMarchComposition(value).sort((a,b)=>b.count-a.count||UNIT_TYPES.indexOf(a.type)-UNIT_TYPES.indexOf(b.type));
 const result=[];
 for(let round=0;round<limit&&result.length<limit;round++){
  for(const u of units){if(result.length>=limit)break;if(u.count>round)result.push(u.type);}
 }
 return result;
}
