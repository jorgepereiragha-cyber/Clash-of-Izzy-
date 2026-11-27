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
 return {ok:true,attackerId,defenderId:Number(row.defender_id),territoryId:targetTerritoryId,
  // Internal snapshot; never serialize it into a player-facing response.
  guardSnapshot:Object.freeze({attackerCastleId:Number(row.attacker_castle_id),region:row.attacker_region,
   attackerShield:row.attacker_shield??null,defenderShield:row.defender_shield??null})};
}


// Embed in the SAME conditional UPDATE as a troop debit or settlement claim.
// Exact shield snapshots deliberately invalidate even a harmless shield change:
// re-read and repeat preflight before retrying. Both flags remain mandatory.
export function castlePvpAtomicGuard(env,eligibility){
 const e=eligibility,s=e?.guardSnapshot;
 const validId=n=>Number.isSafeInteger(n)&&n>0;
 if(!castleShieldsEnabled(env)||e?.ok!==true||!s||
  ![e.attackerId,e.defenderId,e.territoryId,s.attackerCastleId,s.region].every(validId)||
  e.attackerId===e.defenderId)return {sql:"0",args:[]};
 // Fail closed for unparseable or currently active shields even if a caller
 // accidentally passes a stale/invalid snapshot.
 if(shieldActive(s.attackerShield)||shieldActive(s.defenderShield))return {sql:"0",args:[]};
 return {sql:"EXISTS(SELECT 1 FROM kingdoms a JOIN kingdoms d ON d.id=? "+
  "JOIN world_territories t ON t.id=? AND t.owner_kingdom_id=d.id AND t.territory_kind='castle' AND t.territory_key='kingdom_castle_'||d.id "+
  "JOIN world_territories own ON own.id=? AND own.owner_kingdom_id=a.id AND own.territory_kind='castle' AND own.territory_key='kingdom_castle_'||a.id "+
  "WHERE a.id=? AND a.id<>d.id AND a.map_region=? AND d.map_region=a.map_region AND t.map_region=a.map_region AND own.map_region=a.map_region "+
  "AND own.shield_until IS ? AND t.shield_until IS ? "+
  "AND (own.shield_until IS NULL OR julianday(own.shield_until)<=julianday('now')) "+
  "AND (t.shield_until IS NULL OR julianday(t.shield_until)<=julianday('now')) "+
  "AND NOT EXISTS(SELECT 1 FROM alliance_members am JOIN alliance_members dm ON dm.alliance_id=am.alliance_id WHERE am.kingdom_id=a.id AND dm.kingdom_id=d.id))",
  args:[e.defenderId,e.territoryId,s.attackerCastleId,e.attackerId,s.region,s.attackerShield,s.defenderShield]};
}
