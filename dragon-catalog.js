// Catálogo canônico de 9 dragões do Clash of Izzy: 3 azuis, 3 roxos e 3 dourados.
// Apenas um dragão equipado aplica bônus. O nível pertence ao dragão ativo persistido.
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
export function getDragonCombatBonuses(row={}){
 const dragon=DRAGON_BY_KEY[String(row.dragon_key||"")];
 if(!dragon)return {attackPercent:0,defensePercent:0};
 const level=Math.max(1,Math.min(100,Number(row.level)||1));
 const bond=Math.max(1,Math.min(100,Number(row.bond)||1));
 const factor=dragon.rarity==="gold"?.85+.1*((level-1)/99)+.05*((bond-1)/99):.65+.25*((level-1)/99)+.1*((bond-1)/99);
 return {
   attackPercent:Math.min(DRAGON_BONUS_CAP,Number((dragon.attack*factor).toFixed(2))),
   defensePercent:Math.min(DRAGON_BONUS_CAP,Number((dragon.defense*factor).toFixed(2)))
 };
}
export function getDragonCollectionView(ownedKeys=[],activeKey="ember_wyrm",level=1,bond=1){
 const owned=new Set(ownedKeys.map(String));
 return DRAGON_CATALOG.map(dragon=>({
   ...dragon,
   owned:owned.has(dragon.key),
   equipped:dragon.key===activeKey,
   attackPercent:getDragonCombatBonuses({...dragon,dragon_key:dragon.key,level,bond}).attackPercent,
   defensePercent:getDragonCombatBonuses({...dragon,dragon_key:dragon.key,level,bond}).defensePercent
 }));
}
