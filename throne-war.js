import {loadMarchCapacity,assertWithinMarchCapacity} from "./march-capacity.js";
// Rules for the Throne War. Dates are computed from the per-realm unlock
// timestamp kept in D1; browser clocks do not authorize combat or coronations.
export const THRONE_SHIELD_DAYS=35;
export const THRONE_PREPARATION_HOURS=24;
export const THRONE_CONTEST_HOURS=8;
export const THRONE_CYCLE_DAYS=7;
export const THRONE_HOLD_MINUTES=30;
const DAY=86400000;
const HOUR=3600000;
export const THRONE_UNIT_POWER=Object.freeze({
  militia:1,swordsman:3,spearman:3,archer:3,cavalry:5,
  knight:8,crossbowman:5,catapult:9,ram:8,trebuchet:12
});
export function throneTimeline(openedAt,at=new Date()){
  const opened=Date.parse(String(openedAt).replace(" ","T")+(String(openedAt).includes("Z")?"":"Z"));
  const now=at instanceof Date?at.getTime():new Date(at).getTime();
  if(!Number.isFinite(opened)||!Number.isFinite(now))throw Error("Tempo do trono inválido");
  const shieldEnd=opened+THRONE_SHIELD_DAYS*DAY;
  const contestLength=THRONE_CONTEST_HOURS*HOUR;
  const week=THRONE_CYCLE_DAYS*DAY;
  const phase=now<shieldEnd-HOUR*THRONE_PREPARATION_HOURS?"shield":
    now<shieldEnd?"preparation":((now-shieldEnd)%week)<contestLength?"contest":"recovery";
  const cycle=now<shieldEnd?0:Math.floor((now-shieldEnd)/week);
  const contestStart=shieldEnd+cycle*week;
  const contestEnd=contestStart+contestLength;
  const nextStageAt=phase==="shield"?shieldEnd-THRONE_PREPARATION_HOURS*HOUR:
    phase==="preparation"?shieldEnd:
    phase==="contest"?contestEnd:shieldEnd+(cycle+1)*week;
  return {phase,cycle,shieldUntil:new Date(shieldEnd).toISOString(),
    contestStartsAt:new Date(contestStart).toISOString(),
    contestEndsAt:new Date(contestEnd).toISOString(),
    nextStageAt:new Date(nextStageAt).toISOString(),
    remainingSeconds:Math.max(0,Math.ceil((nextStageAt-now)/1000)),
    shielded:now<shieldEnd};
}
export function validateThroneArmy(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Selecione as tropas de cerco");
  const entries=Object.entries(raw);
  if(!entries.length||entries.length>10)throw Error("Formação de cerco inválida");
  const army={};
  let quantity=0,power=0;
  for(const [unit,value] of entries){
    if(!Object.hasOwn(THRONE_UNIT_POWER,unit)||
       !Number.isSafeInteger(value)||value<1||value>10000)
      throw Error("Tropa ou quantidade inválida");
    army[unit]=value;quantity+=value;power+=THRONE_UNIT_POWER[unit]*value;
  }
  if(quantity<200||quantity>10000)throw Error("O cerco exige de 200 a 10.000 tropas");
  return {units:army,quantity,power};
}
export function throneCombat(attackerPower,defenderPower){
  const attack=Number(attackerPower),defense=Number(defenderPower);
  if(!Number.isSafeInteger(attack)||!Number.isSafeInteger(defense)||
     attack<1||defense<1)throw Error("Poder de combate inválido");
  return {won:attack>=defense,attackPower:attack,defenderPower:defense};
}
export function mayCoronate(throne,openedAt,now=new Date()){
  const cycle=Number(throne?.occupation_cycle);
  const since=Date.parse(String(throne?.occupied_since||""));
  if(!Number.isSafeInteger(cycle)||cycle<0||!Number.isFinite(since)||
     !Number.isSafeInteger(Number(throne?.occupying_alliance_id))||
     Number(throne.occupying_alliance_id)<1) return false;
  const opened=Date.parse(String(openedAt).replace(" ","T")+(String(openedAt).includes("Z")?"":"Z"));
  const contestEnd=opened+THRONE_SHIELD_DAYS*DAY+cycle*THRONE_CYCLE_DAYS*DAY+THRONE_CONTEST_HOURS*HOUR;
  const finish=since+THRONE_HOLD_MINUTES*60000;
  return Number.isFinite(opened)&&finish<=contestEnd&&
    new Date(now).getTime()>=finish&&!(throne.crowned_cycle!=null&&Number(throne.crowned_cycle)===cycle);
}
export function thronePublicView(opening,throne,at=new Date()){
  const timeline=throneTimeline(opening.unlocked_at,at);
  const occupancyCycle=Number(throne?.occupation_cycle);
  const holding=occupancyCycle===timeline.cycle&&Number(throne?.occupying_alliance_id)>0;
  const winCycle=Number(throne?.crowned_cycle);
  return {...timeline,realmId:Number(opening.realm_id),
    throneTerritoryId:Number(throne?.territory_id||0),
    occupantAllianceId:holding?Number(throne.occupying_alliance_id):null,
    occupantAllianceTag:holding?(throne.occupant_alliance_tag||""):null,
    holderSince:holding?throne.occupied_since:null,
    kingAllianceId:winCycle===timeline.cycle?Number(throne.crowned_alliance_id)||null:null,
    reigningAllianceTag:throne?.king_alliance_tag||null,
    reigningKingdom:throne?.kingdom_name||null,
    holdRequiredMinutes:THRONE_HOLD_MINUTES,
    minimumSiegeTroops:200,
    minimumCastleLevel:10,
    status:timeline.shielded?"protected":timeline.phase};
}


const throneQuery="SELECT r.realm_id,r.unlocked_at,t.*, "+
  "oa.tag AS occupant_alliance_tag,ka.tag AS king_alliance_tag,k.kingdom_name "+
  "FROM realm_openings r JOIN realm_thrones t ON t.realm_id=r.realm_id "+
  "LEFT JOIN alliances oa ON oa.id=t.occupying_alliance_id "+
  "LEFT JOIN alliances ka ON ka.id=t.crowned_alliance_id "+
  "LEFT JOIN kingdoms k ON k.id=t.crowned_kingdom_id WHERE r.realm_id=?";
export async function getThroneStatus(env,realmId,now=new Date()){
  if(!Number.isSafeInteger(realmId)||realmId<1||realmId>3)throw RangeError("Mapa inválido");
  let row=await env.DB.prepare(throneQuery).bind(realmId).first();
  if(!row)return null;
  if(mayCoronate(row,row.unlocked_at,now)){
    await env.DB.prepare(
      "UPDATE realm_thrones SET crowned_alliance_id=occupying_alliance_id,"+
      "crowned_kingdom_id=occupying_kingdom_id,crowned_cycle=occupation_cycle,crowned_at=? "+
      "WHERE realm_id=? AND revision=? AND occupying_alliance_id IS NOT NULL "+
      "AND (crowned_cycle IS NULL OR crowned_cycle<>occupation_cycle)"
    ).bind(new Date(now).toISOString(),realmId,Number(row.revision)).run();
    row=await env.DB.prepare(throneQuery).bind(realmId).first();
  }
  return {row,public:thronePublicView(row,row,now)};
}

// A single atomic D1 batch gates casualties, idempotency and ownership.
// No purchase, gold, gems, kingdom shield or external account is modified.
export async function assaultThrone(env,kingdom,body,now=new Date()){
  const realmId=Number(kingdom?.map_region)||1;
  const kingdomId=Number(kingdom?.id);
  if(!Number.isSafeInteger(kingdomId)||kingdomId<1) return {ok:false,status:401,error:"Reino inválido"};
  if(Number(kingdom?.castle_level)<10)
    return {ok:false,status:409,error:"Castelo nível 10 necessário para o cerco"};
  const requestId=String(body?.requestId||"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))
    return {ok:false,status:400,error:"Identificador único do cerco inválido"};
  let selection;
  try{selection=validateThroneArmy(body?.units)}catch(e){
    return {ok:false,status:400,error:e.message};
  }
  const membership=await env.DB.prepare(
    "SELECT am.alliance_id FROM alliance_members am "+
    "JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=?"
  ).bind(kingdomId).first();
  if(!membership)return {ok:false,status:409,error:"É necessário participar de uma aliança"};
  const state=await getThroneStatus(env,realmId,now);
  if(!state)return {ok:false,status:503,error:"Trono deste mapa ainda não preparado"};
  const {row}=state,timeline=throneTimeline(row.unlocked_at,now);
  if(timeline.phase!=="contest")return {ok:false,status:409,error:"Trono protegido ou Guerra do Trono fora da disputa",shieldUntil:timeline.shieldUntil};
  if(Number(row.crowned_cycle)===timeline.cycle&&row.crowned_alliance_id!=null)
    return {ok:false,status:409,error:"O trono já foi conquistado nesta guerra"};
  if(Number(row.occupation_cycle)===timeline.cycle&&Number(row.occupying_alliance_id)===Number(membership.alliance_id))
    return {ok:false,status:409,error:"Sua aliança já ocupa o Trono"};
  let marchLimit;
  try{
    marchLimit=await loadMarchCapacity(env,kingdomId,body?.heroKey??null);
    assertWithinMarchCapacity(selection.units,marchLimit.capacity);
  }catch(error){
    if(error instanceof RangeError)return {ok:false,status:409,error:error.message};
    throw error;
  }
  const defender=Number(row.occupation_cycle)===timeline.cycle&&row.occupying_alliance_id
    ?Math.max(1200,Math.ceil(Number(row.occupying_power)*.8)):1200;
  const combat=throneCombat(selection.power,defender);
  const casualtyFraction=combat.won?.12:.24;
  const losses=Object.fromEntries(Object.entries(selection.units).map(([unit,qty])=>[unit,Math.max(1,Math.ceil(qty*casualtyFraction))]));
  const unitsJson=JSON.stringify(selection.units),lossesJson=JSON.stringify(losses);
  const types=Object.keys(selection.units).length;
  const timestamp=new Date(now).toISOString();
  // Phase, event cycle, ownership revision, replay ID, full troop availability,
  // and per-kingdom cooldown are validated on the server in the debit itself.
  const debit=env.DB.prepare(
    "UPDATE army_units SET quantity=quantity-CAST((SELECT value FROM json_each(?) WHERE key=army_units.unit_type) AS INTEGER) "+
    "WHERE kingdom_id=? AND tier=1 AND unit_type IN (SELECT key FROM json_each(?)) "+
    "AND (SELECT COUNT(*) FROM json_each(?) req JOIN army_units u ON u.kingdom_id=? AND u.tier=1 "+
      "AND u.unit_type=req.key AND u.quantity>=CAST(req.value AS INTEGER))=? "+
    "AND EXISTS(SELECT 1 FROM realm_thrones t WHERE t.realm_id=? AND t.revision=? "+
      "AND (t.crowned_cycle IS NULL OR t.crowned_cycle<>?) "+
      "AND datetime('now')>=datetime(?) AND datetime('now')<datetime(?)) "+
    "AND NOT EXISTS(SELECT 1 FROM throne_assaults WHERE kingdom_id=? "+
      "AND (request_id=? OR created_at>datetime('now','-5 minutes')))"
  ).bind(lossesJson,kingdomId,unitsJson,unitsJson,kingdomId,types,realmId,Number(row.revision),
    timeline.cycle,timeline.contestStartsAt,timeline.contestEndsAt,kingdomId,requestId);
  const attempt=env.DB.prepare(
    "INSERT INTO throne_assaults(realm_id,cycle,kingdom_id,alliance_id,request_id,units_json,"+
    "casualties_json,attacker_power,defender_power,won) "+
    "SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()=?"
  ).bind(realmId,timeline.cycle,kingdomId,Number(membership.alliance_id),requestId,unitsJson,
    lossesJson,combat.attackPower,combat.defenderPower,combat.won?1:0,types);
  const capture=env.DB.prepare(
    "UPDATE realm_thrones SET occupying_alliance_id=?,occupying_kingdom_id=?, "+
    "occupied_since=?,occupation_cycle=?,occupying_power=?,revision=revision+1 "+
    "WHERE realm_id=? AND revision=? AND ?=1 "+
    "AND EXISTS(SELECT 1 FROM throne_assaults WHERE kingdom_id=? AND request_id=?)"
  ).bind(Number(membership.alliance_id),kingdomId,timestamp,timeline.cycle,
    combat.attackPower,realmId,Number(row.revision),combat.won?1:0,kingdomId,requestId);
  const record=env.DB.prepare(
    "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) "+
    "SELECT ?,'throne_assault',? WHERE EXISTS "+
    "(SELECT 1 FROM throne_assaults WHERE kingdom_id=? AND request_id=?)"
  ).bind(kingdomId,JSON.stringify({realmId,won:combat.won,cycle:timeline.cycle,
    losses,attackerPower:combat.attackPower,defenderPower:combat.defenderPower}),kingdomId,requestId);
  try{
    const results=await env.DB.batch([debit,attempt,capture,record]);
    if(Number(results[1]?.meta?.changes)!==1)
      return {ok:false,status:409,error:"Exército insuficiente, cerco repetido ou evento encerrado"};
    return {ok:true,combat:{...combat,realmId,cycle:timeline.cycle,losses,
      allianceId:Number(membership.alliance_id),
      occupying:combat.won,holdMinutes:THRONE_HOLD_MINUTES}};
  }catch(e){
    if(/UNIQUE|constraint/i.test(String(e?.message||"")))
      return {ok:false,status:409,error:"Cerco duplicado ou estado do trono alterado"};
    throw e;
  }
}
