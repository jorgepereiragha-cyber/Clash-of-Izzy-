// Original hunt progression and energy policy. Server only; no client-supplied
// power, energy or victories are trusted. Values are provisional beta tuning.
export const HUNT_LEVELS=Object.freeze([1,3,5,8,12,18]);
export const HUNT_ENERGY_MAX=120;
export const HUNT_ENERGY_RECOVERY_SECONDS=300;
export const HUNT_RULES=Object.freeze({
 1:Object.freeze({energy:10,respawnSeconds:120,rewardFood:180,rewardWood:120}),
 3:Object.freeze({energy:12,respawnSeconds:180,rewardFood:420,rewardWood:280}),
 5:Object.freeze({energy:15,respawnSeconds:240,rewardFood:750,rewardWood:500}),
 8:Object.freeze({energy:20,respawnSeconds:300,rewardFood:1200,rewardWood:800}),
 12:Object.freeze({energy:25,respawnSeconds:420,rewardFood:2100,rewardWood:1400}),
 18:Object.freeze({energy:30,respawnSeconds:600,rewardFood:3600,rewardWood:2400})
});
export function huntEnergyAt(row,now){
 if(!Number.isSafeInteger(now)||now<1)return null;
 if(row==null)return {energy:HUNT_ENERGY_MAX,updatedAt:now};
 const energy=row.energy,updatedAt=row.updated_at;
 if(!Number.isSafeInteger(energy)||energy<0||energy>HUNT_ENERGY_MAX||!Number.isSafeInteger(updatedAt)||updatedAt<1||updatedAt>now)return null;
 if(energy===HUNT_ENERGY_MAX)return {energy,updatedAt:now};
 const earned=Math.floor((now-updatedAt)/HUNT_ENERGY_RECOVERY_SECONDS);
 const next=Math.min(HUNT_ENERGY_MAX,energy+earned);
 return {energy:next,updatedAt:next===HUNT_ENERGY_MAX?now:updatedAt+earned*HUNT_ENERGY_RECOVERY_SECONDS};
}
export function nextHuntLevel(clearedLevel){
 if(clearedLevel===0)return HUNT_LEVELS[0];
 const i=HUNT_LEVELS.indexOf(clearedLevel);
 return i<0?null:HUNT_LEVELS[Math.min(i+1,HUNT_LEVELS.length-1)];
}
export function evaluateMonsterHunt({monster,kingdomRegion,clearedLevel=0,energyRow=null,now}={}){
 const deny=code=>({ok:false,code});
 if(!monster||!Number.isSafeInteger(monster.id)||monster.id<1||!Number.isSafeInteger(monster.generation)||monster.generation<1)return deny("INVALID_MONSTER");
 if(!Number.isSafeInteger(kingdomRegion)||kingdomRegion<1||kingdomRegion>3||monster.map_region!==kingdomRegion)return deny("REALM_MISMATCH");
 if(!Number.isSafeInteger(monster.hp)||!Number.isSafeInteger(monster.max_hp)||monster.hp<1||monster.hp>monster.max_hp||monster.respawn_at!==0)return deny("MONSTER_UNAVAILABLE");
 if(!Number.isSafeInteger(monster.level)||!Object.hasOwn(HUNT_RULES,monster.level))return deny("INVALID_LEVEL");
 const unlocked=nextHuntLevel(clearedLevel);
 if(unlocked===null||monster.level>unlocked)return deny("HUNT_LEVEL_LOCKED");
 const state=huntEnergyAt(energyRow,now);
 if(!state)return deny("INVALID_ENERGY");
 const rules=HUNT_RULES[monster.level];
 if(state.energy<rules.energy)return deny("INSUFFICIENT_ENERGY");
 // At full capacity the recovery clock starts only when energy is consumed.
 return {ok:true,monsterId:monster.id,generation:monster.generation,level:monster.level,energyCost:rules.energy,energyAfter:state.energy-rules.energy,energyUpdatedAt:state.updatedAt,respawnSeconds:rules.respawnSeconds};
}
