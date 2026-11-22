// Política original de Guerra do Trono do Clash of Izzy.
// Referências de mecânica: CoK 2026 (Preparação/Disputa/Recuperação, ocupação
// contínua de 150 min); durações de cada fase são parâmetros próprios de Izzy.
export const THRONE_SHIELD_DAYS=35;
export const THRONE_HOLD_MINUTES=150;
export const THRONE_PREPARATION_HOURS=24;
export const THRONE_CONTEST_HOURS=24;
export const THRONE_RECOVERY_DAYS=7;
const DAY=86400000;
const SHIELD=THRONE_SHIELD_DAYS*DAY;
const PREPARATION=THRONE_PREPARATION_HOURS*3600000;
const CONTEST=THRONE_CONTEST_HOURS*3600000;
const RECOVERY=THRONE_RECOVERY_DAYS*DAY;
const CYCLE=PREPARATION+CONTEST+RECOVERY;
export const THRONE_NPC_POWER=250;
export const THRONE_GARRISON_CAP=1000000;
export const THRONE_ACTION_COOLDOWN_SECONDS=300;

export function throneTimestamp(value){
  if(value instanceof Date)return value.getTime();
  if(typeof value==="number")return value;
  if(typeof value!=="string")return NaN;
  const normalized=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ?value.replace(" ","T")+"Z":value;
  return Date.parse(normalized);
}
const iso=ms=>new Date(ms).toISOString();
export function thronePhase(openedAt,now=Date.now()){
  const start=throneTimestamp(openedAt);
  const time=throneTimestamp(now);
  if(!Number.isFinite(start)||!Number.isFinite(time)||time<start)
    throw new RangeError("Data de abertura ou tempo do trono inválido");
  const shieldUntil=start+SHIELD;
  if(time<shieldUntil){
    return {phase:"shield",roundId:0,shieldUntil:iso(shieldUntil),
      stageUntil:iso(shieldUntil),contestUntil:null,remainingSeconds:Math.ceil((shieldUntil-time)/1000),
      canAttack:false};
  }
  const age=time-shieldUntil;
  const roundId=Math.floor(age/CYCLE)+1;
  const offset=age%CYCLE;
  const roundStart=shieldUntil+(roundId-1)*CYCLE;
  const contestStart=roundStart+PREPARATION;
  const contestUntil=contestStart+CONTEST;
  const roundUntil=roundStart+CYCLE;
  const phase=offset<PREPARATION?"preparation":offset<PREPARATION+CONTEST?"contest":"recovery";
  const stageUntil=phase==="preparation"?contestStart:phase==="contest"?contestUntil:roundUntil;
  return {phase,roundId,shieldUntil:iso(shieldUntil),stageUntil:iso(stageUntil),
    contestUntil:iso(contestUntil),remainingSeconds:Math.ceil((stageUntil-time)/1000),
    canAttack:phase==="contest"};
}
export function canCrownThrone({heldSince,contestUntil,now=Date.now()}){
  const held=throneTimestamp(heldSince),contestEnd=throneTimestamp(contestUntil),
        t=throneTimestamp(now),capture=held+THRONE_HOLD_MINUTES*60000;
  return Number.isFinite(held)&&Number.isFinite(contestEnd)&&Number.isFinite(t)
    &&capture<=contestEnd&&t>=capture&&held<=contestEnd;
}
export function thronePowerForArmy(unit,quantity,units){
  const amount=Number(quantity);
  if(!Object.hasOwn(units,unit)||!Number.isSafeInteger(amount)||amount<1||amount>5000)
    throw new RangeError("Tropa ou quantidade inválida");
  const power=Number(units[unit].power);
  if(!Number.isSafeInteger(power)||power<1)throw new RangeError("Poder inválido");
  return {power:Math.min(THRONE_GARRISON_CAP,power*amount),
    casualties:Math.max(1,Math.ceil(amount*.05))};
}
export function resolveThroneSiege(current,allianceId,kingdomId,power,now){
  const alliance=Number(allianceId),kingdom=Number(kingdomId);
  if(!Number.isSafeInteger(alliance)||alliance<1||
    !Number.isSafeInteger(kingdom)||kingdom<1||
    !Number.isSafeInteger(power)||power<1||power>THRONE_GARRISON_CAP)
    throw new RangeError("Assalto inválido");
  const time=iso(throneTimestamp(now));
  if(!current){
    if(power<THRONE_NPC_POWER)return {result:"npc_defended",garrisonPower:THRONE_NPC_POWER,
      holdingAllianceId:null,holdingKingdomId:null,heldSince:null};
    return {result:"captured",garrisonPower:power,holdingAllianceId:alliance,
      holdingKingdomId:kingdom,heldSince:time};
  }
  const existing=Number(current.holding_alliance_id),garrison=Number(current.garrison_power);
  if(existing===alliance){
    return {result:"reinforced",garrisonPower:Math.min(THRONE_GARRISON_CAP,garrison+power),
      holdingAllianceId:existing,holdingKingdomId:Number(current.holding_kingdom_id),
      heldSince:current.held_since};
  }
  if(power>garrison){
    return {result:"captured",garrisonPower:Math.max(1,power-garrison),
      holdingAllianceId:alliance,holdingKingdomId:kingdom,heldSince:time};
  }
  return {result:"defended",garrisonPower:Math.max(1,garrison-power),
    holdingAllianceId:existing,holdingKingdomId:Number(current.holding_kingdom_id),
    heldSince:current.held_since};
}
