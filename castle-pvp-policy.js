import { castleShieldsEnabled, shieldActive } from "./castle-shield.js";

// Internal server-only preflight. The caller must repeat the same eligibility
// predicates inside the atomic dispatch and resolution writes. Never expose
// this private snapshot or rely on a client-provided alliance/shield value.
export async function castlePvpEligibility(env,attackerId,targetTerritoryId,now=Date.now()){
 const deny=(code,status=409)=>({ok:false,code,status});
 if(!castleShieldsEnabled(env))return deny("CASTLE_PVP_DISABLED");
 if(!Number.isSafeInteger(attackerId)||attackerId<1||!Number.isSafeInteger(targetTerritoryId)||targetTerritoryId<1)return deny("INVALID_TARGET",400);
 const row=await env.DB.prepare(
  "SELECT a.id AS attacker_id,d.id AS defender_id,a.map_region AS attacker_region,d.map_region AS defender_region,"+
  "t.map_region AS target_region,t.shield_until AS defender_shield,own.shield_until AS attacker_shield,"+
  "own.id AS attacker_castle_id,EXISTS(SELECT 1 FROM alliance_members am JOIN alliance_members dm ON dm.alliance_id=am.alliance_id WHERE am.kingdom_id=a.id AND dm.kingdom_id=d.id) AS allied "+
  "FROM kingdoms a JOIN world_territories t ON t.id=? AND t.territory_kind='castle' "+
  "JOIN kingdoms d ON d.id=t.owner_kingdom_id AND t.territory_key='kingdom_castle_'||d.id "+
  "JOIN world_territories own ON own.owner_kingdom_id=a.id AND own.territory_key='kingdom_castle_'||a.id AND own.territory_kind='castle' AND own.map_region=a.map_region "+
  "WHERE a.id=?"
 ).bind(targetTerritoryId,attackerId).first();
 if(!row)return deny("CASTLE_NOT_FOUND",404);
 if(Number(row.attacker_id)===Number(row.defender_id))return deny("SELF_ATTACK");
 if(!Number.isSafeInteger(row.attacker_region)||row.attacker_region<1||row.attacker_region!==row.defender_region||row.attacker_region!==row.target_region)return deny("REALM_MISMATCH");
 if(Number(row.allied)!==0)return deny("ALLIED_CASTLE");
 // Deliberately conservative for the pilot: reject attacks while either
 // castle is shielded instead of silently cancelling the attacker's shield.
 if(shieldActive(row.attacker_shield,now))return deny("ATTACKER_SHIELDED");
 if(shieldActive(row.defender_shield,now))return deny("DEFENDER_SHIELDED");
 return {ok:true,attackerId,defenderId:Number(row.defender_id),territoryId:targetTerritoryId};
}
