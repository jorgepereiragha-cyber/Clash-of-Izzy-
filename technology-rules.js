const EFFECT_TO_BONUS=Object.freeze({
  infantry_attack:"infantryAttackPercent",
  cavalry_attack:"cavalryAttackPercent",
  archer_attack:"archerAttackPercent",
  wall_defense:"wallDefensePercent",
  march_speed:"marchSpeedPercent",
  food_production:"foodProductionPercent",
  stone_production:"stoneProductionPercent",
  wood_production:"woodProductionPercent"
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function calculateTechnologyBonuses(rows){
  const bonuses={
    infantryAttackPercent:0,
    cavalryAttackPercent:0,
    archerAttackPercent:0,
    wallDefensePercent:0,
    marchSpeedPercent:0,
    foodProductionPercent:0,
    stoneProductionPercent:0,
    woodProductionPercent:0
  };
  for(const row of Array.isArray(rows)?rows:[]){
    let effect={};
    try{
      effect=typeof row.effect_json==="string"?JSON.parse(row.effect_json||"{}"):(row.effect_json||{});
    }catch{
      effect={};
    }
    if(!effect||typeof effect!=="object"||Array.isArray(effect))continue;
    const level=clamp(Math.floor(Number(row.level)||0),0,10);
    for(const [effectKey,bonusKey] of Object.entries(EFFECT_TO_BONUS)){
      const perLevel=Number(effect[effectKey]);
      if(Number.isFinite(perLevel)&&perLevel>0)bonuses[bonusKey]+=perLevel*level*100;
    }
  }
  for(const key of Object.keys(bonuses)){
    bonuses[key]=Math.round(clamp(bonuses[key],0,key==="wallDefensePercent"?30:50)*1e6)/1e6;
  }
  return bonuses;
}

export function technologyLevelCap(maxLevel,academyLevel){
  const maximum=clamp(Math.floor(Number(maxLevel)||10),1,10);
  const academy=clamp(Math.floor(Number(academyLevel)||0),0,10);
  return Math.min(maximum,academy*3);
}

export function technologyAcademyRequirement(nextLevel){
  return Math.max(1,Math.ceil(clamp(Math.floor(Number(nextLevel)||1),1,10)/3));
}

export function calculateTechnologyResearchCost(baseCost,level){
  const safeLevel=clamp(Math.floor(Number(level)||0),0,9);
  return Math.ceil(Math.max(0,Number(baseCost)||0)*Math.pow(1.55,safeLevel));
}

export function calculateTechnologyResearchDuration(baseSeconds,level){
  const safeLevel=clamp(Math.floor(Number(level)||0),0,9);
  return Math.max(30,Math.ceil(Math.max(30,Number(baseSeconds)||30)*Math.pow(1.35,safeLevel)));
}
