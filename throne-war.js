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
    new Date(now).getTime()>=finish&&Number(throne.crowned_cycle)!==cycle;
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
