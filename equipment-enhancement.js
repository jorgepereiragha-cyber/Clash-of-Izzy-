// Original Clash of Izzy reinforcement economy. All costs and values are server-owned.
export const ENHANCEMENT_COSTS = Object.freeze([10,20,35,50,75,100,150,200,300,500]);
export const FRAGMENT_RECIPES = Object.freeze({
  comum:Object.freeze({quantity:10,gold:150,iron:15,castle:1}),
  raro:Object.freeze({quantity:10,gold:400,iron:40,castle:5}),
  epico:Object.freeze({quantity:10,gold:1000,iron:100,castle:10}),
  lendario:Object.freeze({quantity:10,gold:2500,iron:250,castle:15})
});
export function enhancementLevel(value){
  return Number.isSafeInteger(value) && value>=0 && value<=10 ? value : 0;
}
export function enhancementCost(level){return ENHANCEMENT_COSTS[enhancementLevel(level)] ?? null;}
export function enhancedStats(def,level,enhancement){
  const factor=1+enhancementLevel(enhancement)*0.025;
  return Object.fromEntries(Object.entries(def.base).map(([key,value])=>
    [key,Number(((value+(def.growth[key]||0)*(level-1))*factor).toFixed(4))]));
}
export function reinforcementSetBonus(levels){
  const result={attackPercent:0,defensePercent:0,healthPercent:0,stage:0};
  if(!Array.isArray(levels)||levels.length!==5)return result;
  const min=Math.min(...levels.map(enhancementLevel));
  if(min>=2){result.attackPercent+=1;result.stage=2;}
  if(min>=4){result.defensePercent+=2;result.stage=4;}
  if(min>=6){result.healthPercent+=3;result.stage=6;}
  if(min>=8){result.attackPercent+=4;result.defensePercent+=4;result.stage=8;}
  if(min>=10){result.attackPercent+=5;result.defensePercent+=5;result.healthPercent+=5;result.stage=10;}
  return result;
}
