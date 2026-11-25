// Original science expansion; beta only. Existing research/queue keys remain unchanged.
export const scienceEnabled=env=>env.ENVIRONMENT==="beta"&&env.GAME_4X_SYSTEMS_ENABLED==="true";
const def=(name,category,effect,perLevel,academy,prerequisite,cost)=>Object.freeze({name,category,effect,perLevel,academy,prerequisite:Object.freeze(prerequisite),cost:Object.freeze(cost),maxLevel:10});
export const SCIENCE_CATALOG=Object.freeze({
 scholarship:def("Erudição de Eldoria","Desenvolvimento","Redução do tempo de pesquisa",1.5,1,["economy",1],{wood:320,stone:220,iron:15}),
 conscription:def("Disciplina de recrutas","Militar","Redução do tempo de treinamento",1.5,2,["military",1],{wood:400,stone:240,iron:40}),
 field_logistics:def("Estradas de campanha","Logística","Velocidade de marcha",1,3,["military",2],{wood:420,stone:300,iron:50}),
 military_medicine:def("Medicina de campanha","Hospital","Capacidade hospitalar",2,2,["defense",1],{wood:340,stone:260,iron:25})
});
export function scienceLevel(value,max=10){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;}
export function sciencePercent(key,level){return Object.hasOwn(SCIENCE_CATALOG,key)?SCIENCE_CATALOG[key].perLevel*scienceLevel(level):0;}
export function scienceRequirement(key,level){const d=SCIENCE_CATALOG[key];return Object.hasOwn(SCIENCE_CATALOG,key)?d.academy+Math.floor(scienceLevel(level)/2):0;}
export function scienceDuration(seconds,key,level){return Math.max(10,Math.ceil(seconds*(1-sciencePercent(key,level)/100)));}
export function hospitalScienceCapacity(level,medicine){return Math.max(0,Math.floor(Number(level)||0))*(100+2*scienceLevel(medicine));}
export function scienceView(rows=[],academy=0){
 const levels=new Map(rows.map(r=>[r.research_key,Number(r.level)||0]));
 return Object.entries(SCIENCE_CATALOG).map(([key,d])=>{
  const level=scienceLevel(levels.get(key)),requiredAcademy=scienceRequirement(key,level),[requiredKey,requiredLevel]=d.prerequisite;
  return {key,...d,level,requiredAcademy,requiredKey,requiredLevel,prerequisiteMet:(levels.get(requiredKey)||0)>=requiredLevel,available:level<d.maxLevel&&academy>=requiredAcademy&&(levels.get(requiredKey)||0)>=requiredLevel,bonusPercent:sciencePercent(key,level),nextCost:level<d.maxLevel?Object.fromEntries(Object.entries(d.cost).map(([k,v])=>[k,v*(level+1)])):null};
 });
}
