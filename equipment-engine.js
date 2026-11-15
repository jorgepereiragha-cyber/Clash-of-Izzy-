// Clash of Izzy — catálogo e regras puras da forja real.
// Percentuais são bônus aditivos, limitados no servidor. Skins divinas são cosméticas.
export const EQUIPMENT_CATALOG = Object.freeze([
  {id:"iron_sword",name:"Lâmina de Ferro",slot:"weapon",rarity:"comum",icon:"⚔️",description:"Arma inicial equilibrada.",base:{attack:1.2,critical:0.2},growth:{attack:0.35,critical:0.05},craft:{gold:650,iron:35}},
  {id:"rune_spear",name:"Lança das Runas",slot:"weapon",rarity:"épico",icon:"🔱",description:"Uma arma gravada com runas antigas.",base:{attack:2.1,critical:0.4},growth:{attack:0.45,critical:0.08},craft:{gold:2400,iron:100}},
  {id:"raven_helm",name:"Elmo dos Corvos",slot:"helmet",rarity:"raro",icon:"🪶",description:"Inspirado nos mensageiros de Odin.",base:{defense:1.3,critical:0.25},growth:{defense:0.3,critical:0.05},craft:{gold:1100,iron:55}},
  {id:"warden_plate",name:"Couraça do Guardião",slot:"armor",rarity:"raro",icon:"🛡️",description:"Proteção reforçada para a linha de frente.",base:{defense:2.0,health:1.0},growth:{defense:0.4,health:0.25},craft:{gold:1500,iron:75}},
  {id:"storm_boots",name:"Botas da Tempestade",slot:"boots",rarity:"épico",icon:"🥾",description:"Aumentam a velocidade das marchas.",base:{march:1.0,health:0.5},growth:{march:0.25,health:0.15},craft:{gold:2200,iron:90}},
  {id:"frost_ring",name:"Anel do Inverno",slot:"accessory",rarity:"raro",icon:"💍",description:"Equilibra vigor e resistência.",base:{attack:0.6,defense:0.6},growth:{attack:0.18,defense:0.18},craft:{gold:1300,iron:60}},
  {id:"mjolnir_fragment",name:"Fragmento de Mjölnir",slot:"weapon",rarity:"lendário",icon:"⚡",description:"Relíquia lendária de alto poder.",base:{attack:3.2,critical:0.8},growth:{attack:0.55,critical:0.12},craft:{gold:6200,iron:220}},
  {id:"valkyrie_charm",name:"Talismã das Valquírias",slot:"accessory",rarity:"lendário",icon:"🪽",description:"Bênção de coragem e vigor.",base:{defense:1.5,health:1.8},growth:{defense:0.3,health:0.35},craft:{gold:5800,iron:200}}
]);
export const EQUIPMENT_RESEARCH = Object.freeze([
  {id:"gear_forging",name:"Metalurgia Rúnica",icon:"⚒️",description:"Aumenta o ataque concedido pelos equipamentos.",effect:"Ataque",perLevel:0.75,max:10,base:{gold:900,stone:120}},
  {id:"gear_ward",name:"Runas de Proteção",icon:"ᛉ",description:"Aprimora a defesa dos equipamentos.",effect:"Defesa",perLevel:0.75,max:10,base:{gold:900,stone:120}},
  {id:"gear_vitality",name:"Forja Vital",icon:"❤️",description:"Amplia a vitalidade concedida pelas peças.",effect:"Vida",perLevel:0.5,max:10,base:{gold:1100,stone:150}},
  {id:"gear_logistics",name:"Passos de Asgard",icon:"🌬️",description:"Aumenta a velocidade das marchas.",effect:"Marcha",perLevel:0.5,max:10,base:{gold:1300,stone:180}}
]);
export const NORSE_SKINS = Object.freeze([
  {id:"norse_odin",name:"Odin — Pai de Todos",icon:"🪶",rarity:"lendária",price:2400,description:"Manto azul-escuro, lança rúnica e dois corvos; visual exclusivo."},
  {id:"norse_thor",name:"Thor — Senhor do Trovão",icon:"⚡",rarity:"lendária",price:2400,description:"Armadura de tempestade, detalhes de bronze e martelo Mjölnir."},
  {id:"norse_freyja",name:"Freyja — Brilho de Fólkvangr",icon:"✨",rarity:"épica",price:1800,description:"Manto dourado, colar Brísingamen e motivos de falcão."},
  {id:"norse_loki",name:"Loki — Véu da Trapaça",icon:"🐍",rarity:"épica",price:1800,description:"Armadura verde e negra, runas mutáveis e brilho de fogo."},
  {id:"norse_tyr",name:"Týr — Juramento de Fenrir",icon:"🛡️",rarity:"épica",price:1800,description:"Armadura de juramento, runas de justiça e manopla rúnica."}
]);
export function equipmentItemStats(item,level=1){
  const n=Math.max(1,Math.min(20,Math.floor(Number(level)||1))),out={};
  for(const key of Object.keys(item.base||{}))out[key]=Number((item.base[key]+(n-1)*(item.growth[key]||0)).toFixed(2));
  return out;
}
export function equipmentBonuses(owned,equipped,research){
  const selected=new Set((equipped||[]).map(x=>x.item_key)),sum={attack:0,defense:0,health:0,march:0,critical:0};
  for(const row of owned||[]){if(!selected.has(row.item_key))continue;const item=EQUIPMENT_CATALOG.find(x=>x.id===row.item_key);if(!item)continue;for(const [key,value] of Object.entries(equipmentItemStats(item,row.level)))sum[key]+=value;}
  const levels=Object.fromEntries((research||[]).map(x=>[x.research_key,Number(x.level)||0]));
  sum.attack+=Math.min(10,levels.gear_forging||0)*0.75;
  sum.defense+=Math.min(10,levels.gear_ward||0)*0.75;
  sum.health+=Math.min(10,levels.gear_vitality||0)*0.5;
  sum.march+=Math.min(10,levels.gear_logistics||0)*0.5;
  return {attackPercent:Number(Math.min(30,sum.attack).toFixed(2)),defensePercent:Number(Math.min(30,sum.defense).toFixed(2)),healthPercent:Number(Math.min(25,sum.health).toFixed(2)),marchSpeedPercent:Number(Math.min(20,sum.march).toFixed(2)),criticalChancePercent:Number(Math.min(15,sum.critical).toFixed(2))};
}
