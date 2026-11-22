/** Castle phases are visual only; the Worker/D1 remains authoritative. */
export const CASTLE_TIERS=Object.freeze([
 Object.freeze({tier:1,name:"Fortaleza de Madeira",from:1,to:5}),
 Object.freeze({tier:2,name:"Castelo de Pedra",from:6,to:10}),
 Object.freeze({tier:3,name:"Fortaleza Real",from:11,to:20}),
 Object.freeze({tier:4,name:"Cidadela Épica",from:21,to:30})
]);
export function getCastleTier(level){
 const n=Number(level),safe=Number.isFinite(n)?Math.max(1,Math.min(30,Math.floor(n))):1;
 return CASTLE_TIERS.find(t=>safe>=t.from&&safe<=t.to).tier;
}
export function getCastleProgression(level){
 const n=Number(level),safe=Number.isFinite(n)?Math.max(1,Math.min(30,Math.floor(n))):1;
 const tier=CASTLE_TIERS[getCastleTier(safe)-1];
 return {level:safe,tier:tier.tier,name:tier.name,tierFrom:tier.from,tierTo:tier.to,
 nextTierAt:tier.tier===4?null:CASTLE_TIERS[tier.tier].from};
}
