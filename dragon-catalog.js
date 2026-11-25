// Catálogo canônico de 9 dragões do Clash of Izzy: 3 azuis, 3 roxos e 3 dourados.
// Apenas um dragão equipado aplica bônus. A coleção mantém progresso individual.
export const DRAGON_CATALOG=Object.freeze([
  {
    "key": "ember_wyrm",
    "name": "Brasa de Arven",
    "rarity": "blue",
    "attack": 1.1,
    "defense": 1.5,
    "element": "Fogo",
    "description": "Dragão inicial dos guardiões de Arven",
    "food": 0,
    "wood": 0,
    "stone": 0,
    "gold": 0,
    "castle": 1
  },
  {
    "key": "mist_talon",
    "name": "Garra da Névoa",
    "rarity": "blue",
    "attack": 1.5,
    "defense": 1.1,
    "element": "Ar",
    "description": "Vigiante das montanhas cobertas de névoa",
    "food": 9000,
    "wood": 7000,
    "stone": 5000,
    "gold": 3000,
    "castle": 5
  },
  {
    "key": "frost_glimmer",
    "name": "Aurora Glacial",
    "rarity": "blue",
    "attack": 1.3,
    "defense": 1.4,
    "element": "Gelo",
    "description": "Escudo vivo das fronteiras congeladas",
    "food": 10000,
    "wood": 7000,
    "stone": 7000,
    "gold": 3500,
    "castle": 5
  },
  {
    "key": "storm_rune",
    "name": "Fúria Rúnica",
    "rarity": "purple",
    "attack": 2.9,
    "defense": 2.2,
    "element": "Raio",
    "description": "Protetor das ruínas do trovão",
    "food": 22000,
    "wood": 18000,
    "stone": 15000,
    "gold": 8500,
    "castle": 12
  },
  {
    "key": "jade_guardian",
    "name": "Guardião Esmeralda",
    "rarity": "purple",
    "attack": 2.2,
    "defense": 3,
    "element": "Terra",
    "description": "Coração da selva ancestral de Eldoria",
    "food": 24000,
    "wood": 16000,
    "stone": 18000,
    "gold": 9000,
    "castle": 12
  },
  {
    "key": "abyss_wing",
    "name": "Asa do Abismo",
    "rarity": "purple",
    "attack": 2.7,
    "defense": 2.7,
    "element": "Sombra",
    "description": "Guardião dos portais escuros",
    "food": 23000,
    "wood": 20000,
    "stone": 16000,
    "gold": 9000,
    "castle": 12
  },
  {
    "key": "sun_ascendant",
    "name": "Ascendente Solar",
    "rarity": "gold",
    "attack": 5.4,
    "defense": 4.3,
    "element": "Sol",
    "description": "Lenda dourada do pacote Master",
    "master": true
  },
  {
    "key": "astral_aegis",
    "name": "Égide Astral",
    "rarity": "gold",
    "attack": 4.2,
    "defense": 5.5,
    "element": "Estrelas",
    "description": "Lenda dourada do pacote Master",
    "master": true
  },
  {
    "key": "imperial_drake",
    "name": "Dragão da Coroa",
    "rarity": "gold",
    "attack": 5,
    "defense": 5,
    "element": "Ouro",
    "description": "Lenda dourada do pacote Master",
    "master": true
  }
].map(item=>Object.freeze(item)));
export const DRAGON_BY_KEY=Object.freeze(Object.fromEntries(DRAGON_CATALOG.map(dragon=>[dragon.key,dragon])));
export const MASTER_DRAGON_KEYS=Object.freeze(DRAGON_CATALOG.filter(x=>x.master).map(x=>x.key));
export const DRAGON_BONUS_CAP=5.5;
// Original passive affinities. Unlock from individual level AND bond, never from client input.
export const DRAGON_ELEMENTAL_SKILLS=Object.freeze(Object.fromEntries(Object.entries({
 ember_wyrm:{name:"Chama Guardiã",attack:0.1,defense:0.2},
 mist_talon:{name:"Rajada Cortante",attack:0.3,defense:0},
 frost_glimmer:{name:"Escudo Glacial",attack:0,defense:0.3},
 storm_rune:{name:"Fulgor Rúnico",attack:0.3,defense:0},
 jade_guardian:{name:"Muralha Esmeralda",attack:0,defense:0.3},
 abyss_wing:{name:"Véu do Abismo",attack:0.15,defense:0.15},
 sun_ascendant:{name:"Coroa Solar",attack:0.3,defense:0},
 astral_aegis:{name:"Égide Estelar",attack:0,defense:0.3},
 imperial_drake:{name:"Juramento Imperial",attack:0.15,defense:0.15}
}).map(([key,value])=>[key,Object.freeze(value)])));
const DRAGON_SKILL_MILESTONES=Object.freeze([20,50,80]);
function validProgress(value){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(100,Math.floor(n))):1;}
export function getDragonElementalSkill(row={}){
 const key=String(row?.dragon_key||"");
 if(!Object.hasOwn(DRAGON_ELEMENTAL_SKILLS,key))return null;
 const skill=DRAGON_ELEMENTAL_SKILLS[key],level=validProgress(row.level),bond=validProgress(row.bond);
 const rank=DRAGON_SKILL_MILESTONES.filter(n=>level>=n&&bond>=n).length;
 const round=n=>Number(n.toFixed(2));
 return {name:skill.name,rank,maxRank:3,nextMilestone:DRAGON_SKILL_MILESTONES[rank]??null,
   attackPercent:round(skill.attack*rank/3),defensePercent:round(skill.defense*rank/3)};
}
export function getDragonCombatBonuses(row={}){
 const key=String(row?.dragon_key||""),dragon=Object.hasOwn(DRAGON_BY_KEY,key)?DRAGON_BY_KEY[key]:null;
 if(!dragon)return {attackPercent:0,defensePercent:0};
 const level=validProgress(row.level),bond=validProgress(row.bond);
 const skill=getDragonElementalSkill({dragon_key:key,level,bond});
 const factor=dragon.rarity==="gold"?.85+.1*((level-1)/99)+.05*((bond-1)/99):.65+.25*((level-1)/99)+.1*((bond-1)/99);
 return {
   attackPercent:Math.min(DRAGON_BONUS_CAP,Number((dragon.attack*factor+(skill?.attackPercent||0)).toFixed(2))),
   defensePercent:Math.min(DRAGON_BONUS_CAP,Number((dragon.defense*factor+(skill?.defensePercent||0)).toFixed(2)))
 };
}
// Same cost policy for the authoritative debit and the read-only UI preview.
export function dragonUpgradeCost(level){
 if(!Number.isSafeInteger(level)||level<1||level>=100)return null;
 return {food:250*level,wood:150*level,stone:100*level,iron:25*level};
}
export function getDragonUpgradePreview(row={}){
 const key=row?.dragon_key;
 if(!Object.hasOwn(DRAGON_BY_KEY,key))return null;
 const level=validProgress(row.level),bond=validProgress(row.bond),cost=dragonUpgradeCost(level);
 if(!cost)return null;
 const next={dragon_key:key,level:level+1,bond:Math.min(100,bond+2)};
 return {cost,level:next.level,bond:next.bond,...getDragonCombatBonuses(next),elementalSkill:getDragonElementalSkill(next)};
}
export function getDragonCollectionView(ownedKeys=[],activeKey="ember_wyrm",level=1,bond=1,progressRows=[]){
 const owned=new Set(ownedKeys.map(String)),progress=new Map(progressRows.map(row=>[row.dragon_key,row]));
 return DRAGON_CATALOG.map(dragon=>{
   const equipped=owned.has(dragon.key)&&dragon.key===activeKey;
   const saved=owned.has(dragon.key)?progress.get(dragon.key):null;
   const individualLevel=validProgress(equipped?level:saved?.level);
   const individualBond=validProgress(equipped?bond:saved?.bond);
   const individual={dragon_key:dragon.key,level:individualLevel,bond:individualBond};
   return {...dragon,owned:owned.has(dragon.key),equipped,level:individualLevel,bond:individualBond,
     elementalSkill:getDragonElementalSkill(individual),...getDragonCombatBonuses(individual),
     nextUpgrade:equipped?getDragonUpgradePreview(individual):null};
 });
}
