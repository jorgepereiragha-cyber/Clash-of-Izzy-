// Original science expansion; beta only. Existing research/queue keys remain unchanged.
export const scienceEnabled=env=>env.ENVIRONMENT==="beta"&&env.GAME_4X_SYSTEMS_ENABLED==="true";
const def=(name,category,effect,perLevel,academy,prerequisite,cost)=>Object.freeze({name,category,effect,perLevel,academy,prerequisite:Object.freeze(prerequisite),cost:Object.freeze(cost),maxLevel:10});
const imperial=(name,effect,prerequisite,cost)=>Object.freeze({...def(name,"Ciências imperiais",effect,0.2,10,prerequisite,cost),maxLevel:30,imperial:true});
export const IMPERIAL_VIP_CAPS=Object.freeze([0,5,10,15,20,24,27,30]);
export const SCIENCE_CATALOG=Object.freeze({
 scholarship:def("Erudição de Eldoria","Desenvolvimento","Redução do tempo de pesquisa",1.5,1,["economy",1],{wood:320,stone:220,iron:15}),
 conscription:def("Disciplina de recrutas","Militar","Redução do tempo de treinamento",1.5,2,["military",1],{wood:400,stone:240,iron:40}),
 field_logistics:def("Estradas de campanha","Logística","Velocidade de marcha",1,3,["military",2],{wood:420,stone:300,iron:50}),
 military_medicine:def("Medicina de campanha","Hospital","Capacidade hospitalar",2,2,["defense",1],{wood:340,stone:260,iron:25}),
 imperial_attack:imperial("Ofensiva imperial","Ataque das tropas",["military",10],{wood:900,stone:600,iron:180}),
 imperial_defense:imperial("Bastião imperial","Defesa das tropas",["defense",10],{wood:650,stone:1000,iron:160}),
 imperial_health:imperial("Vitalidade imperial","Vida das tropas",["defense",10],{wood:800,stone:800,iron:150})
});
export function scienceLevel(value,max=10){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;}
export function sciencePercent(key,level){return Object.hasOwn(SCIENCE_CATALOG,key)?Number((SCIENCE_CATALOG[key].perLevel*scienceLevel(level,SCIENCE_CATALOG[key].maxLevel)).toFixed(2)):0;}
export function imperialScienceCap(kingdom={}){
 return Number(kingdom.castle_level)===30?IMPERIAL_VIP_CAPS[scienceLevel(kingdom.prestige,7)]:0;
}
export function imperialCombatBonuses(rows=[],kingdom={}){
 const cap=imperialScienceCap(kingdom),levels=new Map(rows.map(r=>[r.research_key,r.level]));
 return {attackPercent:sciencePercent("imperial_attack",scienceLevel(levels.get("imperial_attack"),cap)),defensePercent:sciencePercent("imperial_defense",scienceLevel(levels.get("imperial_defense"),cap)),healthPercent:sciencePercent("imperial_health",scienceLevel(levels.get("imperial_health"),cap))};
}
export function scienceRequirement(key,level){const d=SCIENCE_CATALOG[key];return Object.hasOwn(SCIENCE_CATALOG,key)?d.academy+Math.floor(scienceLevel(level,d.maxLevel)/(d.imperial?3:2)):0;}
export function scienceDuration(seconds,key,level){return Math.max(10,Math.ceil(seconds*(1-sciencePercent(key,level)/100)));}
export function hospitalScienceCapacity(level,medicine){return Math.max(0,Math.floor(Number(level)||0))*(100+2*scienceLevel(medicine));}
export function scienceView(rows=[],academy=0,kingdom={}){
 const levels=new Map(rows.map(r=>[r.research_key,Number(r.level)||0]));
 return Object.entries(SCIENCE_CATALOG).map(([key,d])=>{
  const level=scienceLevel(levels.get(key),d.maxLevel),requiredAcademy=scienceRequirement(key,level),[requiredKey,requiredLevel]=d.prerequisite;
  const unlockedMax=d.imperial?imperialScienceCap(kingdom):d.maxLevel;
  const nextVip=d.imperial&&level<d.maxLevel?IMPERIAL_VIP_CAPS.findIndex(cap=>cap>level):null;
  const prerequisiteMet=(levels.get(requiredKey)||0)>=requiredLevel;
  const academyMet=academy>=requiredAcademy;
  const lockedReason=level>=d.maxLevel?"max_level":level>=unlockedMax?"vip":!academyMet?"academy":!prerequisiteMet?"prerequisite":null;
  const nextBonusPercent=level<unlockedMax?sciencePercent(key,level+1):null;
  return {key,...d,level,unlockedMax,nextVip,requiredAcademy,requiredKey,requiredLevel,prerequisiteMet,academyMet,lockedReason,available:lockedReason===null,bonusPercent:sciencePercent(key,Math.min(level,unlockedMax)),nextBonusPercent,nextCost:level<d.maxLevel?Object.fromEntries(Object.entries(d.cost).map(([k,v])=>[k,v*(level+1)])):null};
 });
}
