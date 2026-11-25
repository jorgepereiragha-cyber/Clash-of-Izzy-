// Server-owned castle peace shield. Separate from the imperial throne shield.
// Never consume inventory while castle PvP remains unavailable.
const DURATION=Object.freeze({shield_8h:28800,shield_3d:259200});
export const castleShieldsEnabled=env=>env?.ENVIRONMENT==="beta"&&env?.CASTLE_PVP_ENABLED==="true"&&env?.CASTLE_SHIELDS_ENABLED==="true";
export function shieldActive(until,now=Date.now()){
 if(until==null||until==="")return false;
 const raw=String(until),parsed=Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(raw)?raw.replace(" ","T")+"Z":raw);
 return !Number.isFinite(parsed)||parsed>now; // malformed stored dates fail closed
}
export async function castleShieldState(env,kingdomId){
 const row=await env.DB.prepare("SELECT shield_until FROM world_territories WHERE territory_key=? AND owner_kingdom_id=? AND territory_kind='castle'").bind("kingdom_castle_"+kingdomId,kingdomId).first();
 return {available:castleShieldsEnabled(env)&&Boolean(row),active:shieldActive(row?.shield_until),until:row?.shield_until??null};
}
export async function activateCastleShield(env,kingdomId,body){
 if(!castleShieldsEnabled(env))return {ok:false,status:409,error:"Proteção PvP ainda indisponível; nenhum item consumido."};
 const item=body?.itemId,requestId=body?.requestId;
 if(!Number.isSafeInteger(kingdomId)||kingdomId<1||typeof item!=="string"||!Object.hasOwn(DURATION,item)||typeof requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))return {ok:false,status:400,error:"Escudo ou identificador inválido."};
 const key="kingdom_castle_"+kingdomId;
 const event=JSON.stringify({requestId,itemId:item});
 const eligible="territory_key=? AND owner_kingdom_id=? AND territory_kind='castle' AND (shield_until IS NULL OR julianday(shield_until)<=julianday('now'))";
 // Refuse replacement of an active shield; replay IDs are retained in the event log.
 // All predicates are evaluated at the authoritative database write.
 const statements=[
  env.DB.prepare("UPDATE shop_inventory SET quantity=quantity-1 WHERE kingdom_id=? AND item_id=? AND quantity>=1 AND EXISTS(SELECT 1 FROM world_territories WHERE "+eligible+") AND NOT EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='castle_shield_activated' AND json_extract(payload_json,'$.requestId')=?)").bind(kingdomId,item,key,kingdomId,kingdomId,requestId),
  env.DB.prepare("UPDATE world_territories SET shield_until=strftime('%Y-%m-%dT%H:%M:%fZ','now',?) WHERE "+eligible+" AND changes()=1").bind("+"+DURATION[item]+" seconds",key,kingdomId),
  env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,'castle_shield_activated',? WHERE changes()=1").bind(kingdomId,event)
 ];
 const result=await env.DB.batch(statements);
 if(Number(result[2]?.meta?.changes)!==1)return {ok:false,status:409,error:"Escudo ativo, item indisponível ou operação repetida."};
 return {ok:true,shield:await castleShieldState(env,kingdomId)};
}
