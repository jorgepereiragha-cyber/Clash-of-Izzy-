// Progressão independente dos pacotes VIP comerciais: castelo 1..30, depois VIP 1..7.
// A coluna persistida kingdoms.prestige (0..7) é reutilizada, sem migração destrutiva.
export const CASTLE_MAX_LEVEL=30;
export const CASTLE_VIP_MAX_LEVEL=7;
export const CASTLE_VIP_GEM_COSTS=Object.freeze([1000,2500,5000,10000,20000,40000,80000]);
export function castleVipLevel(value){
 const number=Number(value);
 return Number.isFinite(number)?Math.max(0,Math.min(CASTLE_VIP_MAX_LEVEL,Math.trunc(number))):0;
}
export function getCastleVipBonuses(level=0){
 const tier=castleVipLevel(level);
 return Object.freeze({productionPercent:tier*10,attackPercent:Number((tier*.5).toFixed(2)),defensePercent:tier});
}
export function getCastleVipState(kingdom={}){
 const level=castleVipLevel(kingdom.prestige);
 const castleLevel=Math.max(1,Math.min(CASTLE_MAX_LEVEL,Number(kingdom.castle_level)||1));
 const eligible=castleLevel>=CASTLE_MAX_LEVEL&&level<CASTLE_VIP_MAX_LEVEL;
 const next=level<CASTLE_VIP_MAX_LEVEL?Object.freeze({
   level:level+1,
   gemCost:CASTLE_VIP_GEM_COSTS[level],
   bonuses:getCastleVipBonuses(level+1)
 }):null;
 return {castleLevel,level,maxLevel:CASTLE_VIP_MAX_LEVEL,eligible,completed:level===CASTLE_VIP_MAX_LEVEL,bonuses:getCastleVipBonuses(level),next,
   note:castleLevel<CASTLE_MAX_LEVEL?"Alcance o castelo nível 30 para avançar no VIP do Castelo.":level===CASTLE_VIP_MAX_LEVEL?"VIP 7 é a evolução máxima do castelo.":"Ascensão permanente: o castelo permanece nível 30."};
}
