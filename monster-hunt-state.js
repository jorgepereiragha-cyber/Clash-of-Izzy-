import {HUNT_ENERGY_MAX,HUNT_ENERGY_RECOVERY_SECONDS,HUNT_RULES,HUNT_UNIT_DAMAGE,huntEnergyAt,nextHuntLevel} from "./monster-hunt-policy.js";
// A reino sem histórico começa com energia cheia; o primeiro despacho persiste o gasto.
export async function huntProgressView(db,kingdomId,now=Math.floor(Date.now()/1000)){
 if(!Number.isSafeInteger(kingdomId)||kingdomId<1)return null;
 const row=await db.prepare("SELECT energy,updated_at,cleared_level,revision FROM monster_hunt_progress WHERE kingdom_id=?").bind(kingdomId).first();
 const state=huntEnergyAt(row,now),clearedLevel=row?.cleared_level??0;
 const unlockedLevel=nextHuntLevel(clearedLevel);
 if(!state||unlockedLevel===null)return null;
 return {energy:state.energy,maxEnergy:HUNT_ENERGY_MAX,recoverySeconds:HUNT_ENERGY_RECOVERY_SECONDS,nextEnergyAt:state.energy===HUNT_ENERGY_MAX?null:state.updatedAt+HUNT_ENERGY_RECOVERY_SECONDS,clearedLevel,unlockedLevel,energyCosts:Object.fromEntries(Object.entries(HUNT_RULES).map(([level,rules])=>[level,rules.energy])),unitDamage:HUNT_UNIT_DAMAGE};
}
