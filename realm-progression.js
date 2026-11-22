// Fonte canônica da política de abertura dos mundos de Eldoria.
// A população corresponde aos reinos registrados (um reino por player_id).
// Jogadores existentes não são migrados e o mundo desbloqueado não fecha depois.
export const REALM_THRESHOLDS=Object.freeze([0,700,1000]);
export const REALM_NAMES=Object.freeze(["Eldoria • Origem","Eldoria • Fronteira","Eldoria • Ascensão"]);
export function eligibleRealmForPopulation(population){
 const count=Number(population);
 if(!Number.isSafeInteger(count)||count<0)throw new RangeError("População inválida");
 return count>=1000?3:count>=700?2:1;
}
export function getRealmCoordinates(slot,realm=1){
 if(!Number.isSafeInteger(slot)||slot<0||!Number.isSafeInteger(realm)||realm<1||realm>3)throw new RangeError("Posição ou mapa inválido");
 return {mapX:((slot%20)-10)*5,mapZ:(Math.floor(slot/20)-10)*5,mapRegion:realm,mapSlot:slot};
}
export function realmStatusView(total,openedIds=[],counts={},playerRegion=null){
 if(!Number.isSafeInteger(total)||total<0)throw new RangeError("População inválida");
 const opened=new Set(openedIds.map(Number));
 return {
  registeredPlayers:total,
  counting:"reinos registrados (um por jogador), não jogadores simultâneos",
  currentRealm:Number.isSafeInteger(playerRegion)&&playerRegion>=1&&playerRegion<=3?playerRegion:null,
  realms:REALM_THRESHOLDS.map((threshold,index)=>{
   const id=index+1;
   const open=opened.has(id);
   return {id,name:REALM_NAMES[index],status:open?"open":"locked",open,
     unlockAtPlayers:threshold,playersRemaining:open?0:Math.max(0,threshold-total),
     inhabitants:Math.max(0,Number(counts[id])||0)};
  })
 };
}
