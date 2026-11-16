import { simulateBattle, simulatePvpBattle, calculateMarchDuration, applyUnitLosses } from "./game-adapter.js";
import { ANGEL_DEATH_EVENT, getAngelDeathWeekendWindow, simulateAngelDeathAttack, angelDeathRewardForRank } from "./angel-death-event.js";
import { consumeRateLimit } from "./api-rate-limit.js";
import { buildTrigramSearchQuery, fuzzyTokenDistance } from "./search-ranking.js";
import { calculateQueueDurationSeconds } from "./kingdom-queue-rules.js";
import { processEmailQueue, requestEmailVerification, verifyEmailToken, getEmailPreferences, updateEmailPreferences, getEmailHistory, queueEmailForInternalPlayer } from "./email-system.js";
import { getValhallaMultipliers, scaleValhallaDurationSeconds, handleValhallaConfig } from "./valhalla-config.js";
import { handleValhallaShop, getValhallaBuffMultipliers } from "./valhalla-shop.js";
import { distributeValhallaDailyRunes } from "./valhalla-rewards.js";
import { handleValhallaAdmin } from "./valhalla-admin.js";
import { handleRally, processDueRallies } from "./rally.js";
import { getPetBonuses, getPetsState, handlePetsRoute } from "./pets.js";
import { getBattleReplay } from "./battle-replay.js";
import { handlePlayerAccountRoute } from "./player-accounts.js";
import { handleMercadoPagoRoute } from "./mercadopago-orders.js";
const BUILDINGS = {
  castle:{label:"Castelo",wood:300,stone:200,food:0,iron:0},
  barracks:{label:"Quartel",wood:180,stone:90,food:0,iron:0},
  farm:{label:"Fazenda",wood:120,stone:50,food:0,iron:0},
  quarry:{label:"Pedreira",wood:150,stone:60,food:0,iron:0},
  lumber_mill:{label:"Serraria",wood:150,stone:60,food:0,iron:0},
  iron_mine:{label:"Mina de ferro",wood:180,stone:100,food:0,iron:0},
  market:{label:"Mercado",wood:160,stone:80,food:0,iron:0},
  academy:{label:"Centro de Pesquisa Militar",wood:220,stone:160,food:0,iron:0},
  wall:{label:"Muralha",wood:250,stone:250,food:0,iron:0},
  hospital:{label:"Hospital",wood:200,stone:120,food:0,iron:0},
  watchtower:{label:"Torre de vigia",wood:180,stone:140,food:0,iron:0},
  stable:{label:"Estábulo",wood:220,stone:130,food:0,iron:0},
  archery_range:{label:"Campo de arqueiros",wood:190,stone:110,food:0,iron:0},
  siege_workshop:{label:"Oficina de cerco",wood:300,stone:220,food:0,iron:20},
  embassy:{label:"Embaixada",wood:220,stone:180,food:0,iron:0},
  warehouse:{label:"Armazém",wood:170,stone:100,food:0,iron:0}
};
const HERO_TEMPLATES = {
soldado_basico:{name:"Soldado Recruta",title:"Recruta do Reino",rarity:"white",type:"infantaria",stats:{hp:500,attack:80,defense:60,speed:30},skill:"Golpe Rápido",skillDesc:"Ataque básico simples",skillPower:1.2},
arqueiro_comum:{name:"Arqueiro da Floresta",title:"Atirador Comum",rarity:"white",type:"arqueiro",stats:{hp:400,attack:100,defense:40,speed:45},skill:"Flecha Simples",skillDesc:"Disparo básico",skillPower:1.3},
cavaleiro_iniciante:{name:"Cavaleiro Novato",title:"Montador Iniciante",rarity:"white",type:"cavalaria",stats:{hp:600,attack:90,defense:70,speed:50},skill:"Investida",skillDesc:"Carga básica",skillPower:1.4},
curandeiro_aldeia:{name:"Curandeiro da Aldeia",title:"Médico Rural",rarity:"white",type:"suporte",stats:{hp:450,attack:50,defense:50,speed:35},skill:"Cura Menor",skillDesc:"Restaura pouca vida",skillPower:1.1},
capitao_espada:{name:"Capitão da Guarda",title:"Líder Militar",rarity:"blue",type:"infantaria",stats:{hp:1200,attack:180,defense:140,speed:40},skill:"Corte Devastador",skillDesc:"Ataque poderoso em área",skillPower:2},
mestre_arco:{name:"Mestre Arqueiro",title:"Atirador de Elite",rarity:"blue",type:"arqueiro",stats:{hp:900,attack:220,defense:80,speed:60},skill:"Chuva de Flechas",skillDesc:"Múltiplos disparos",skillPower:2.2},
cavaleiro_dragao:{name:"Cavaleiro do Dragão",title:"Montador de Dragão",rarity:"blue",type:"cavalaria",stats:{hp:1400,attack:200,defense:160,speed:70},skill:"Sopro de Fogo",skillDesc:"Ataque flamejante",skillPower:2.5},
sacerdotisa_luar:{name:"Sacerdotisa do Luar",title:"Curandeira Mística",rarity:"blue",type:"suporte",stats:{hp:1000,attack:120,defense:100,speed:50},skill:"Cura Lunar",skillDesc:"Cura poderosa em área",skillPower:1.8},
rei_artur:{name:"Rei Artur",title:"O Rei Eterno",rarity:"purple",type:"infantaria",stats:{hp:3500,attack:500,defense:400,speed:55},skill:"Excalibur",skillDesc:"Espada sagrada causa dano massivo",skillPower:4.5},
merlin_arquimago:{name:"Merlin",title:"O Arquimago Supremo",rarity:"purple",type:"suporte",stats:{hp:2800,attack:650,defense:250,speed:65},skill:"Meteoro Ancestral",skillDesc:"Invoca destruição dos céus",skillPower:5},
joana_darc:{name:"Joana D\u0027Arc",title:"A Donzela de Ferro",rarity:"purple",type:"infantaria",stats:{hp:4000,attack:450,defense:550,speed:60},skill:"Fé Divina",skillDesc:"Proteção sagrada absoluta",skillPower:4},
genghis_khan:{name:"Genghis Khan",title:"O Flagelo de Deus",rarity:"purple",type:"cavalaria",stats:{hp:3200,attack:600,defense:300,speed:85},skill:"Horda Mongol",skillDesc:"Convoca exército de cavalaria",skillPower:4.8}
};
const HERO_RARITY={white:{label:"Branco · Comum",multiplier:1,fragments:5,maxLevel:30,maxStars:5},blue:{label:"Azul · Raro",multiplier:1.8,fragments:15,maxLevel:50,maxStars:6},purple:{label:"Roxo · Lendário",multiplier:3.5,fragments:40,maxLevel:70,maxStars:7}};
const HERO_STAR_COST={2:10,3:20,4:40,5:80,6:150,7:300};

const COSMETIC_SKINS={
 c1:{name:"Pedra Antiga",icon:"🏰",rarity:"comum",theme:"Medieval",price:250,visual:"Pedra clara, bandeiras de reino e acabamento clássico"},
 c2:{name:"Madeira Rústica",icon:"🏚️",rarity:"comum",theme:"Viking",price:250,visual:"Madeira escura, cordas e escudos nórdicos"},
 c3:{name:"Aço Forjado",icon:"⚙️",rarity:"comum",theme:"Industrial",price:250,visual:"Aço escovado e rebites de ferreiro"},
 c4:{name:"Areia do Deserto",icon:"🏜️",rarity:"comum",theme:"Egípcio",price:250,visual:"Pedra dourada e tecidos do deserto"},
 c5:{name:"Gelo Eterno",icon:"❄️",rarity:"comum",theme:"Nórdico",price:250,visual:"Cristais de gelo e brilho azul"},
 c6:{name:"Floresta Verde",icon:"🌲",rarity:"comum",theme:"Élfico",price:250,visual:"Madeira viva e folhagens"},
 c7:{name:"Vulcão",icon:"🌋",rarity:"comum",theme:"Vulcânico",price:250,visual:"Rocha escura e veios incandescentes"},
 c8:{name:"Oceano",icon:"🌊",rarity:"comum",theme:"Marinho",price:250,visual:"Pedra azul e reflexos de água"},
 r1:{name:"Ouro Envelhecido",icon:"👑",rarity:"rara",theme:"Real",price:700,visual:"Ouro antigo e ornamentos reais"},
 r2:{name:"Cristal Azul",icon:"💎",rarity:"rara",theme:"Cristalino",price:700,visual:"Cristais azuis translúcidos"},
 r3:{name:"Esmeralda",icon:"💚",rarity:"rara",theme:"Élfico",price:700,visual:"Jade e entalhes élficos"},
 r4:{name:"Rubi Sangrento",icon:"❤️",rarity:"rara",theme:"Vampírico",price:700,visual:"Rubi escuro e detalhes carmesim"},
 r5:{name:"Ametista",icon:"💜",rarity:"rara",theme:"Arcano",price:700,visual:"Ametista e inscrições arcanas"},
 e1:{name:"Diamante Eterno",icon:"💠",rarity:"épica",theme:"Supremo",price:1500,visual:"Facetas cristalinas e luz prateada"},
 e2:{name:"Fogo Dracônico",icon:"🔥",rarity:"épica",theme:"Dragão",price:1500,visual:"Escamas e veios de fogo"},
 e3:{name:"Trovão Divino",icon:"⚡",rarity:"épica",theme:"Tempestade",price:1500,visual:"Metal de tempestade e faíscas"},
 e4:{name:"Sombra Demoníaca",icon:"👹",rarity:"épica",theme:"Abissal",price:1500,visual:"Obsidiana e fumaça sombria"},
 l1:{name:"Dragão Primordial",icon:"🐉",rarity:"lendária",theme:"Supremo",price:3000,visual:"Escamas ancestrais e brilho dracônico"},
 l2:{name:"Celestial Divino",icon:"✨",rarity:"lendária",theme:"Celestial",price:3000,visual:"Ouro branco e luz celestial"},
 l3:{name:"Caos Primordial",icon:"🌀",rarity:"lendária",theme:"Caos",price:3000,visual:"Runas instáveis e energia cósmica"},
 n1:{name:"Odin — Pai de Todos",icon:"🪶",rarity:"lendária",theme:"Panteão Nórdico",price:2400,visual:"Manto azul-escuro, lança rúnica, dois corvos e brilho de sabedoria"},
 n2:{name:"Thor — Senhor do Trovão",icon:"⚡",rarity:"lendária",theme:"Panteão Nórdico",price:2400,visual:"Armadura de tempestade, Mjölnir e arcos elétricos"},
 n3:{name:"Freyja — Brilho de Fólkvangr",icon:"✨",rarity:"épica",theme:"Panteão Nórdico",price:1800,visual:"Manto dourado, colar Brísingamen e motivos de falcão"},
 n4:{name:"Loki — Véu da Trapaça",icon:"🐍",rarity:"épica",theme:"Panteão Nórdico",price:1800,visual:"Armadura verde e negra, runas mutáveis e ilusões"},
 n5:{name:"Týr — Juramento de Fenrir",icon:"🛡️",rarity:"épica",theme:"Panteão Nórdico",price:1800,visual:"Armadura de juramento, escudo rúnico e luz dourada"},
 n6:{name:"Heimdall — Guardião do Bifröst",icon:"🌈",rarity:"épica",theme:"Panteão Nórdico",price:1800,visual:"Armadura dourada, espada Hofund e aurora Bifröst"}
};
const COSMETIC_COLLECTIONS=[
 {id:"col_medieval",name:"Coleção Medieval",icon:"🏰",desc:"Complete as skins medievais",skins:["c1","c2","c3"],gems:500,shards:20},
 {id:"col_elemental",name:"Coleção Elemental",icon:"🌊",desc:"Domine os elementos",skins:["c5","c6","c7","c8"],gems:1000,shards:40},
 {id:"col_rara",name:"Mestre das Raras",icon:"💎",desc:"Colecione todas as skins raras",skins:["r1","r2","r3","r4","r5"],gems:2000,shards:60},
 {id:"col_epica",name:"Lenda Épica",icon:"🔥",desc:"Obtenha todas as skins épicas",skins:["e1","e2","e3","e4"],gems:5000,shards:100},
 {id:"col_lendaria",name:"Panteão Lendário",icon:"👑",desc:"Alcance todas as lendárias",skins:["l1","l2","l3"],gems:15000,shards:300},
 {id:"col_norse",name:"Panteão de Asgard",icon:"⚡",desc:"Reúna os seis visuais dos deuses nórdicos",skins:["n1","n2","n3","n4","n5","n6"],gems:5000,shards:200},
 {id:"col_completa",name:"Colecionador Supremo",icon:"🏆",desc:"Complete todas as coleções",skins:[],special:true,gems:50000,shards:1000}
];
const SEASON_END="2026-11-30T23:59:59.000Z";
const SEASONAL_COSMETICS=[
 {id:"s1",name:"Abóbora Assombrada",icon:"🎃",theme:"Halloween",visual:"Lanterna de abóbora, névoa e luz espectral",price:3000},
 {id:"s2",name:"Castelo dos Mortos",icon:"💀",theme:"Necromante",visual:"Pedra tumular, estandartes gastos e névoa",price:4500},
 {id:"s3",name:"Fortaleza Vampírica",icon:"🧛",theme:"Vampiro Lorde",visual:"Veludo escuro, rubis e vitrais carmesim",price:6000},
 {id:"s4",name:"Mansão Fantasma",icon:"👻",theme:"Assombração",visual:"Arquitetura espectral e luz fria",price:5000},
 {id:"s5",name:"Teia Demoníaca",icon:"🕷️",theme:"Aracnídeo",visual:"Obsidiana, seda e detalhes venenosos",price:5500},
 {id:"s6",name:"Noite Eterna",icon:"🦇",theme:"Lenda Sombria",visual:"Asas de morcego, lua negra e aura assombrada",price:12000,legendary:true}
];
const SKIN_FUSIONS=[
 {inputs:["c1","c2","c3"],output:{id:"f_medieval",name:"Fortaleza Medieval Suprema",icon:"🏰",rarity:"fundida",visual:"Pedra nobre, madeira entalhada e aço polido"}},
 {inputs:["c5","c6","c7"],output:{id:"f_elemental",name:"Convergência Elemental",icon:"🌪️",rarity:"fundida",visual:"Gelo, folhas e rocha vulcânica em harmonia"}},
 {inputs:["r1","r2","r3"],output:{id:"f_gemmaster",name:"Mestre das Gemas",icon:"💎",rarity:"fundida",visual:"Ouro, cristal azul e esmeralda"}},
 {inputs:["e1","e2","e3"],output:{id:"f_ascendant",name:"Ascensão Divina",icon:"⚡",rarity:"fundida lendária",visual:"Cristal, fogo dracônico e relâmpagos"}},
 {inputs:["e2","e4","r4"],output:{id:"f_demonlord",name:"Senhor Demônio",icon:"👹",rarity:"fundida lendária",visual:"Chamas, obsidiana e rubi"}},
 {inputs:["l1","l2","l3"],output:{id:"f_cosmos",name:"Entidade Cósmica",icon:"🌌",rarity:"fundida mítica",visual:"Escamas ancestrais, luz celestial e runas cósmicas"}}
];
async function ensureCosmeticDefaults(env,kingdomId){
 const initialized=await env.DB.prepare("INSERT OR IGNORE INTO kingdom_cosmetic_wallet(kingdom_id,shards) VALUES(?,150)").bind(kingdomId).run();
 if(initialized.meta.changes){
  const starter=["c1","c2","c3","c4","c5","c6","r1","r2","r3","e1","e2"];
  await env.DB.batch(starter.map(id=>env.DB.prepare("INSERT OR IGNORE INTO kingdom_cosmetics(kingdom_id,item_id,kind) VALUES(?,?,'standard')").bind(kingdomId,id)));
 }
}
async function getCosmeticState(env,kingdomId){
 await ensureCosmeticDefaults(env,kingdomId);
 const [owned,claims,wallet]=await Promise.all([
  env.DB.prepare("SELECT item_id,kind,acquired_at FROM kingdom_cosmetics WHERE kingdom_id=? ORDER BY acquired_at").bind(kingdomId).all(),
  env.DB.prepare("SELECT collection_id FROM kingdom_collection_claims WHERE kingdom_id=?").bind(kingdomId).all(),
  env.DB.prepare("SELECT shards FROM kingdom_cosmetic_wallet WHERE kingdom_id=?").bind(kingdomId).first()
 ]);
 return {owned:owned.results||[],claimed:(claims.results||[]).map(x=>x.collection_id),shards:wallet?.shards||0,skins:COSMETIC_SKINS,collections:COSMETIC_COLLECTIONS,seasonal:SEASONAL_COSMETICS,seasonEnd:SEASON_END,seasonActive:Date.now()<Date.parse(SEASON_END),fusions:SKIN_FUSIONS};
}

const SHOP_ITEMS={
 food_small:{name:"Saco de Comida",icon:"🌾",desc:"+5.000 comida",price:500,currency:"gold",gives:{food:5000},category:"resources"},
 food_medium:{name:"Carroça de Comida",icon:"🌾",desc:"+25.000 comida",price:2000,currency:"gold",gives:{food:25000},category:"resources"},
 food_large:{name:"Celeiro Real",icon:"🌾",desc:"+150.000 comida",price:10000,currency:"gold",gives:{food:150000},category:"resources"},
 wood_small:{name:"Feixe de Madeira",icon:"🪵",desc:"+5.000 madeira",price:500,currency:"gold",gives:{wood:5000},category:"resources"},
 wood_medium:{name:"Carga de Madeira",icon:"🪵",desc:"+25.000 madeira",price:2000,currency:"gold",gives:{wood:25000},category:"resources"},
 wood_large:{name:"Estoque Real",icon:"🪵",desc:"+150.000 madeira",price:10000,currency:"gold",gives:{wood:150000},category:"resources"},
 gold_small:{name:"Bolsa de Ouro",icon:"🪙",desc:"+10.000 ouro",price:100,currency:"gems",gives:{gold:10000},category:"resources"},
 gold_large:{name:"Baú de Ouro",icon:"🪙",desc:"+100.000 ouro",price:800,currency:"gems",gives:{gold:100000},category:"resources"},
 acc_5min:{name:"Acelerador 5 min",icon:"⚡",desc:"Item de aceleração de construção",price:20,currency:"gems",gives:{acc_5min:1},category:"accelerators"},
 acc_1h:{name:"Acelerador 1 hora",icon:"⚡",desc:"Item de aceleração de construção",price:50,currency:"gems",gives:{acc_1h:1},category:"accelerators"},
 acc_8h:{name:"Acelerador 8 horas",icon:"⚡",desc:"Item de aceleração de construção",price:200,currency:"gems",gives:{acc_8h:1},category:"accelerators"},
 acc_1d:{name:"Acelerador 1 dia",icon:"⚡",desc:"Item de aceleração de construção",price:400,currency:"gems",gives:{acc_1d:1},category:"accelerators"},
 train_1h:{name:"Acelerador de Treino 1h",icon:"⚔️",desc:"Item de aceleração de treinamento",price:60,currency:"gems",gives:{train_1h:1},category:"accelerators"},
 train_8h:{name:"Acelerador de Treino 8h",icon:"⚔️",desc:"Item de aceleração de treinamento",price:250,currency:"gems",gives:{train_8h:1},category:"accelerators"},
 res_1h:{name:"Acelerador de Pesquisa 1h",icon:"🔬",desc:"Item de aceleração de pesquisa",price:70,currency:"gems",gives:{res_1h:1},category:"accelerators"},
 res_8h:{name:"Acelerador de Pesquisa 8h",icon:"🔬",desc:"Item de aceleração de pesquisa",price:280,currency:"gems",gives:{res_8h:1},category:"accelerators"},
 shield_8h:{name:"Escudo 8 horas",icon:"🛡️",desc:"Item de proteção para o reino",price:300,currency:"gems",gives:{shield_8h:1},category:"special"},
 shield_3d:{name:"Escudo 3 dias",icon:"🛡️",desc:"Item de proteção para o reino",price:1000,currency:"gems",gives:{shield_3d:1},category:"special"},
 hero_exp:{name:"Livro de EXP",icon:"📖",desc:"+10.000 EXP para herói",price:200,currency:"gems",gives:{hero_exp:1},category:"special"},
 pack_starter:{name:"Pacote Iniciante",icon:"🎁",desc:"50k comida + 50k madeira + 10 aceleradores de 1h",price:500,currency:"gems",gives:{food:50000,wood:50000,acc_1h:10},category:"packages",originalPrice:800},
 pack_war:{name:"Pacote Guerra",icon:"⚔️",desc:"100k comida + aceleradores de treino e construção",price:1500,currency:"gems",gives:{food:100000,train_1h:20,acc_1h:10},category:"packages",originalPrice:2500},
 pack_legend:{name:"Pacote Lendário",icon:"👑",desc:"500k comida + 500k madeira + aceleradores + escudos + livros",price:5000,currency:"gems",gives:{food:500000,wood:500000,acc_1d:20,shield_8h:10,hero_exp:5},category:"packages",originalPrice:9000}
};
const MERCHANT_POOL=[
 {id:"food_large",stock:3,discount:.70},{id:"wood_large",stock:3,discount:.70},
 {id:"acc_1d",stock:5,discount:.60},{id:"acc_8h",stock:5,discount:.65},
 {id:"train_8h",stock:5,discount:.65},{id:"res_8h",stock:3,discount:.70},
 {id:"shield_3d",stock:2,discount:.60},{id:"hero_exp",stock:5,discount:.75},
 {id:"pack_war",stock:1,discount:.80},{id:"gold_large",stock:2,discount:.50},
 {id:"pack_starter",stock:2,discount:.70},{id:"food_medium",stock:4,discount:.65}
];
const SHOP_CYCLE_MS=8*60*60*1000;
function merchantCycle(now=Date.now()){return Math.floor(now/SHOP_CYCLE_MS);}
function merchantOffers(cycle){
 const pool=[...MERCHANT_POOL],seed=(cycle*2654435761)>>>0;
 let x=seed||1;const rand=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,8).map(o=>({id:o.id,stock:o.stock,discount:Math.round((1-o.discount)*100),price:Math.max(1,Math.floor(SHOP_ITEMS[o.id].price*o.discount))}));
}
async function getShopState(env,kingdomId){
const cycle=merchantCycle(),offers=merchantOffers(cycle);
 const rows=await env.DB.prepare("SELECT item_id,stock FROM merchant_stock WHERE kingdom_id=? AND cycle_id=?").bind(kingdomId,cycle).all();
 const stock=Object.fromEntries((rows.results||[]).map(r=>[r.item_id,r.stock]));
 const inventory=await env.DB.prepare("SELECT item_id,quantity FROM shop_inventory WHERE kingdom_id=? AND quantity>0 ORDER BY item_id").bind(kingdomId).all();
 return {cycle,refreshAt:(cycle+1)*SHOP_CYCLE_MS,offers:offers.map(o=>({...SHOP_ITEMS[o.id],id:o.id,price:o.price,discount:o.discount,stock:stock[o.id]??o.stock,originalPrice:SHOP_ITEMS[o.id].price})),items:SHOP_ITEMS,inventory:inventory.results||[]};
}
function heroView(row){const t=HERO_TEMPLATES[row.hero_key],r=HERO_RARITY[row.rarity];if(!t||!r)return row;const stats=Object.fromEntries(Object.entries(t.stats).map(([key,value])=>[key,Math.floor(value*r.multiplier*(1+(row.level-1)*.03+(row.stars-1)*.15))]));return {...row,name:t.name,title:t.title,type:t.type,rarity_label:r.label,max_level:r.maxLevel,max_stars:r.maxStars,stats,skill:t.skill,skill_description:t.skillDesc,skill_power:t.skillPower,fragments_to_next:HERO_STAR_COST[row.stars+1]||null};}
function rollHeroRarity(){const n=crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;return n<.70?"white":n<.95?"blue":"purple";}
const TROOP_CAPACITY_PER_BARRACKS_LEVEL = 500;
const UNITS = {
  militia:{label:"Milícia",food:12,wood:2,iron:0,power:2},
  swordsman:{label:"Espadachim",food:22,wood:4,iron:3,power:5},
  spearman:{label:"Lanceiro",food:18,wood:5,iron:2,power:4},
  archer:{label:"Arqueiro",food:20,wood:7,iron:1,power:5},
  cavalry:{label:"Cavalaria",food:35,wood:8,iron:8,power:9},
  knight:{label:"Cavaleiro",food:50,wood:10,iron:15,power:14},
  mage:{label:"Mago",food:42,wood:18,iron:10,power:12},
  crossbowman:{label:"Besteiro",food:28,wood:9,iron:5,power:7},
  catapult:{label:"Catapulta",food:70,wood:45,iron:20,power:22},
  ram:{label:"Aríete",food:60,wood:55,iron:18,power:20},
  trebuchet:{label:"Trabuco",food:90,wood:75,iron:30,power:30}
};
function json(data,status=200,extraHeaders={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","X-Frame-Options":"DENY","Cache-Control":"no-store",...extraHeaders}})}
function b64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function sign(payload,secret){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const body=b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body));
  return body+"."+b64url(sig);
}
async function verify(token,secret){
  try{
    const [body,signature]=token.split(".");
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const bytes=Uint8Array.from(atob(signature.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
    if(!await crypto.subtle.verify("HMAC",key,bytes,new TextEncoder().encode(body)))return false;
    const payload=JSON.parse(atob(body.replace(/-/g,"+").replace(/_/g,"/")));
    return payload.exp>Math.floor(Date.now()/1000)?payload:false;
  }catch{return false}
}
async function rateLimitDecision(env,scope,identity,limit,windowSeconds){
  if(!env.DB||!env.SESSION_SECRET)return json({error:"Proteção temporariamente indisponível."},503);
  try{
    const result=await consumeRateLimit({db:env.DB,secret:env.SESSION_SECRET,scope,identity,limit,windowSeconds});
    if(result.allowed)return null;
    return json({error:"Muitas tentativas. Aguarde antes de tentar novamente."},429,{"Retry-After":String(result.retryAfterSeconds)});
  }catch(error){
    console.error("rate_limit_unavailable",String(error?.message||error));
    return json({error:"Proteção temporariamente indisponível."},503);
  }
}
async function readBody(request,maxBytes=32768){
 const declaredLength=Number(request.headers.get("content-length")||0);
 if(declaredLength>maxBytes)return {__bodyError:"payload_too_large"};
 if(!request.body)return {};
 const reader=request.body.getReader(),chunks=[];
 let total=0;
 try{
  while(true){
   const part=await reader.read();if(part.done)break;
   total+=part.value.byteLength;
   if(total>maxBytes){await reader.cancel();return {__bodyError:"payload_too_large"}}
   chunks.push(part.value);
  }
  const bytes=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const parsed=JSON.parse(new TextDecoder().decode(bytes));
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return {__bodyError:"invalid_json"};
  return parsed;
 }catch{return {__bodyError:"invalid_json"}}
}
async function gameIdentity(request,env){
  const header=request.headers.get("Authorization")||"";
  const token=header.startsWith("Bearer ")?header.slice(7):"";
  const p=env.SESSION_SECRET?await verify(token,env.SESSION_SECRET):false;
  if(!p||p.scope!=="game"||!p.sub)return null;
  const account=await env.DB.prepare(
    "SELECT a.session_version FROM player_accounts a JOIN players p ON p.id=a.player_id WHERE p.player_id=?"
  ).bind(String(p.sub)).first();
  // Reinos sem conta continuam com a sessão anônima existente. Depois do vínculo,
  // somente tokens emitidos com a versão de sessão da conta permanecem válidos.
  if(account){
    if(!Number.isInteger(Number(p.av))||Number(p.av)!==Number(account.session_version))return null;
  }else if(p.av!==undefined)return null;
  return String(p.sub);
}
async function ensureKingdom(env,playerId){
  let p=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
  if(!p){
    await env.DB.prepare("INSERT OR IGNORE INTO players(player_id,name,gems) VALUES(?,?,?)").bind(playerId,"Lorde de Eldoria",50).run();
    p=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
  }
  let k=await env.DB.prepare("SELECT id FROM kingdoms WHERE player_id=?").bind(p.id).first();
  if(!k){
    const created=await env.DB.prepare("INSERT INTO kingdoms(player_id,kingdom_name,food,wood,stone,iron,gold,last_production_at) VALUES(?,?,?,?,?,?,?,?)")
      .bind(p.id,"Reino de Eldoria",5000,5000,3000,1000,1000,new Date().toISOString()).run();
    const id=Number(created.meta.last_row_id);
    const mapSlot=id-1;
    const mapX=((mapSlot%20)-10)*5;
    const mapZ=((Math.floor(mapSlot/20)%20)-10)*5;
    const mapRegion=Math.floor(mapSlot/400)+1;
    await env.DB.prepare("UPDATE kingdoms SET map_x=?,map_z=?,map_region=? WHERE id=?").bind(mapX,mapZ,mapRegion,id).run();
    const buildingRows=Object.keys(BUILDINGS).map((key,i)=>env.DB.prepare("INSERT OR IGNORE INTO kingdom_buildings(kingdom_id,building_type,level,position_x,position_z) VALUES(?,?,1,?,?)").bind(id,key,((i%4)-1.5)*7,Math.floor(i/4)*7-7));
    const unitRows=Object.keys(UNITS).map((key)=>env.DB.prepare("INSERT OR IGNORE INTO army_units(kingdom_id,unit_type,tier,quantity) VALUES(?,?,1,?)").bind(id,key,key==="militia"?30:0));
    await env.DB.batch([
      ...buildingRows,...unitRows,
      env.DB.prepare("INSERT OR IGNORE INTO heroes(kingdom_id,hero_key,hero_name,rarity) VALUES(?,?,?,?)").bind(id,"kael_sunwarden","Kael, Guardião do Sol","rare"),
      env.DB.prepare("INSERT OR IGNORE INTO dragons(kingdom_id,dragon_key,dragon_name) VALUES(?,?,?)").bind(id,"ember_wyrm","Brasa"),
      env.DB.prepare("INSERT OR IGNORE INTO kingdom_pets(kingdom_id,pet_id,level,experience,is_active) SELECT ?,'pet_raven',1,0,1 WHERE EXISTS(SELECT 1 FROM pet_catalog WHERE id='pet_raven' AND active=1)").bind(id)
    ]);
    k={id};
  }
  const kingdom=await env.DB.prepare("SELECT id,kingdom_name,castle_level,map_x,map_z FROM kingdoms WHERE id=?").bind(k.id).first();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO world_territories(territory_key,name,terrain,x,z,owner_kingdom_id,level,resource_type,resource_rate,territory_kind) VALUES(?,?,'plains',?,?,?,?,'castle',0,'castle')"
  ).bind("kingdom_castle_"+k.id,"Castelo de "+(kingdom?.kingdom_name||"Eldoria"),kingdom?.map_x||0,kingdom?.map_z||0,k.id,kingdom?.castle_level||1).run();
  await recalculateKingdomStats(env,k.id);
  await recalculateKingdomPower(env,k.id);
  return k.id;
}
async function scaleKingdomQueueDurationSeconds(env,kingdomId,baseSeconds,queueType,valhallaMultipliers){
  const seasonal=scaleValhallaDurationSeconds(baseSeconds,valhallaMultipliers);
  if(queueType!=="construction")return seasonal;
  const buffs=await getValhallaBuffMultipliers(env,kingdomId);
  return Math.max(10,Math.floor(seasonal/Math.max(1,buffs.buildSpeed)));
}
async function recalculateKingdomStats(env,kingdomId){
  const [kingdom,rows]=await Promise.all([
    env.DB.prepare("SELECT food,wood,stone,iron,gold,wall_hp FROM kingdoms WHERE id=?").bind(kingdomId).first(),
    env.DB.prepare("SELECT building_type,level FROM kingdom_buildings WHERE kingdom_id=?").bind(kingdomId).all()
  ]);
  if(!kingdom)return null;
  const levels=Object.fromEntries((rows.results||[]).map(row=>[row.building_type,Math.max(0,Number(row.level)||0)]));
  const warehouse=levels.warehouse||1;
  const capacities={
    food:50000+warehouse*20000+(levels.farm||1)*1500,
    wood:50000+warehouse*20000+(levels.lumber_mill||1)*1500,
    stone:30000+warehouse*12000+(levels.quarry||1)*1000,
    iron:25000+warehouse*12000+(levels.iron_mine||1)*750,
    gold:20000+warehouse*8000+(levels.market||1)*500
  };
  const wallMax=5000+(levels.wall||1)*5000;
  const defense=50+(levels.wall||1)*40+(levels.watchtower||0)*50+(Number((await env.DB.prepare("SELECT castle_level FROM kingdoms WHERE id=?").bind(kingdomId).first())?.castle_level)||1)*10;
  await env.DB.prepare(
    "UPDATE kingdoms SET food_capacity=MAX(?,food),wood_capacity=MAX(?,wood),stone_capacity=MAX(?,stone),iron_capacity=MAX(?,iron),gold_capacity=MAX(?,gold),wall_max_hp=?,wall_hp=MIN(wall_hp,?),defense_power=? WHERE id=?"
  ).bind(capacities.food,capacities.wood,capacities.stone,capacities.iron,capacities.gold,wallMax,wallMax,defense,kingdomId).run();
  return {capacities,wallMax,defense};
}
async function recalculateKingdomPower(env,kingdomId){
  const [buildings,troops,research,heroes,dragon,kingdom]=await Promise.all([
    env.DB.prepare("SELECT building_type,level FROM kingdom_buildings WHERE kingdom_id=?").bind(kingdomId).all(),
    env.DB.prepare("SELECT unit_type,quantity FROM army_units WHERE kingdom_id=?").bind(kingdomId).all(),
    env.DB.prepare("SELECT research_key,level FROM research WHERE kingdom_id=?").bind(kingdomId).all(),
    env.DB.prepare("SELECT level FROM heroes WHERE kingdom_id=?").bind(kingdomId).all(),
    env.DB.prepare("SELECT level FROM dragons WHERE kingdom_id=?").bind(kingdomId).first(),
    env.DB.prepare("SELECT prestige FROM kingdoms WHERE id=?").bind(kingdomId).first()
  ]);
  const weights={castle:100,barracks:30,farm:10,quarry:15,lumber_mill:10,iron_mine:15,market:12,academy:20,wall:50,hospital:15,watchtower:25,stable:30,archery_range:25,siege_workshop:40,embassy:15,warehouse:12};
  let power=0;
  for(const row of buildings.results||[])power+=Math.pow(Number(row.level)||0,2)*(weights[row.building_type]||10);
  for(const row of troops.results||[])power+=(Number(row.quantity)||0)*(Number(UNITS[row.unit_type]?.power)||1);
  for(const row of research.results||[])power+=(Number(row.level)||0)*20;
  for(const row of heroes.results||[])power+=(Number(row.level)||0)*25;
  power+=(Number(dragon?.level)||0)*40;
  power+=Math.max(0,Number(kingdom?.prestige)||0)*100;
  const total=Math.max(0,Math.floor(power));
  await env.DB.prepare("UPDATE kingdoms SET power=? WHERE id=?").bind(total,kingdomId).run();
  return total;
}
async function logKingdomAction(env,kingdomId,playerDbId,actionType,details){
  try{
    await env.DB.prepare("INSERT INTO action_logs(kingdom_id,player_id,action_type,details_json) VALUES(?,?,?,?)")
      .bind(kingdomId,playerDbId||null,actionType,JSON.stringify(details||{})).run();
  }catch(error){
    console.warn("kingdom_action_log_failed",String(error?.message||error));
  }
}
async function applyProduction(env,kingdomId){
  const row=await env.DB.prepare("SELECT * FROM kingdoms WHERE id=?").bind(kingdomId).first();
  if(!row)return;
  const now=Date.now(),last=Date.parse(row.last_production_at||row.updated_at||new Date(now).toISOString());
  const elapsed=Math.max(0,Math.min(7*24*3600,Math.floor((now-(Number.isFinite(last)?last:now))/1000)));
  if(elapsed<1)return;
  const b=await env.DB.prepare("SELECT building_type,level FROM kingdom_buildings WHERE kingdom_id=?").bind(kingdomId).all();
  const levels=Object.fromEntries((b.results||[]).map(x=>[x.building_type,x.level]));
  const perHour={
    wood:8*(levels.lumber_mill||1),
    stone:6*(levels.quarry||1),
    food:12*(levels.farm||1),
    iron:2*(levels.iron_mine||1),
    gold:1.5*(levels.market||1)
  };
  await ensureEquipmentTables(env,kingdomId);
  const activeHero=await env.DB.prepare("SELECT h.id FROM heroes h JOIN hero_inventory hi ON hi.kingdom_id=h.kingdom_id AND hi.hero_key=h.hero_key WHERE h.kingdom_id=? ORDER BY hi.level DESC,hi.stars DESC,h.id LIMIT 1").bind(kingdomId).first();
  const [equippedRows,gearResearchRows]=await Promise.all([
    activeHero?env.DB.prepare("SELECT ke.item_key,ke.level,ke.is_locked FROM kingdom_equipment ke JOIN hero_equipment he ON he.item_key=ke.item_key JOIN heroes h ON h.id=he.hero_id WHERE ke.kingdom_id=? AND he.hero_id=? AND h.kingdom_id=?").bind(kingdomId,activeHero.id,kingdomId).all():Promise.resolve({results:[]}),
    env.DB.prepare("SELECT research_key,level FROM research WHERE kingdom_id=? AND research_key IN ('gear_forging','gear_ward','gear_vitality','gear_logistics')").bind(kingdomId).all()
  ]);
  const equipmentProductionBonus=equipmentBonuses(equippedRows.results||[],gearResearchRows.results||[]).resourcePercent/100;
  const prestigeBonus=(1+Math.max(0,Number(row.prestige||0))*.10)*(1+equipmentProductionBonus);
  const [valhallaMultipliers,valhallaBuffs,petBonuses]=await Promise.all([
    getValhallaMultipliers(env),getValhallaBuffMultipliers(env,kingdomId),getPetBonuses(env,kingdomId)
  ]);
  let previousRemainders={};
  try{const parsed=JSON.parse(row.production_remainders||"{}");if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))previousRemainders=parsed}catch{}
  const gains={},nextRemainders={};
  const capacities={food:Number(row.food_capacity)||50000,wood:Number(row.wood_capacity)||50000,stone:Number(row.stone_capacity)||30000,iron:Number(row.iron_capacity)||25000,gold:Number(row.gold_capacity)||20000};
  for(const [key,rate] of Object.entries(perHour)){
    const accumulated=rate*valhallaMultipliers.resource*valhallaBuffs.resourceProduction*petBonuses.resourceProductionMultiplier*prestigeBonus*elapsed+Math.max(0,Math.min(3599,Number(previousRemainders[key])||0));
    const produced=Math.floor(accumulated/3600);
    const current=Math.max(0,Number(row[key])||0);
    gains[key]=Math.min(produced,Math.max(0,capacities[key]-current));
    nextRemainders[key]=gains[key]<produced?0:accumulated-produced*3600;
  }
  // Guarda as frações de produção: consultas frequentes não descartam os segundos acumulados.
  // Compare-and-set impede duas chamadas simultâneas de creditar o mesmo intervalo.
  const productionTimestamp=new Date(now).toISOString();
  const productionUpdate=env.DB.prepare("UPDATE kingdoms SET food=food+?,wood=wood+?,stone=stone+?,iron=iron+?,gold=gold+?,last_production_at=?,production_remainders=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND COALESCE(last_production_at,'')=COALESCE(?, '')")
    .bind(gains.food,gains.wood,gains.stone,gains.iron,gains.gold,productionTimestamp,JSON.stringify(nextRemainders),kingdomId,row.last_production_at??"");
  const ledgerRows=Object.entries(gains).filter(([,amount])=>amount>0);
  const ledgerInsert=ledgerRows.length?env.DB.prepare("INSERT INTO resource_ledger(kingdom_id,resource,amount,reason) "+ledgerRows.map(()=> "SELECT ?,?,?,? WHERE changes()>0").join(" UNION ALL "))
    .bind(...ledgerRows.flatMap(([resource,amount])=>[kingdomId,resource,amount,"produção automática"])):null;
  // Produção e extrato são confirmados no mesmo lote; chamadas concorrentes não duplicam nenhum dos dois.
  await env.DB.batch(ledgerInsert?[productionUpdate,ledgerInsert]:[productionUpdate]);
}
async function seedWorld(env){
 const nodes=[
  ["forest_east","Bosque Antigo","forest",18,12,"wood"],
  ["forest_west","Bosque Nebuloso","forest",-22,8,"wood"],
  ["golden_fields","Campos Dourados","plains",12,-24,"food"],
  ["fertile_vale","Vale Fértil","plains",-18,-20,"food"],
  ["north_quarry","Pedreira do Norte","mountain",30,18,"stone"],
  ["grey_rock","Rochedo Cinzento","mountain",-32,-14,"stone"],
  ["iron_vein","Veio de Ferro","mountain",34,-25,"iron"],
  ["old_mine","Mina Abandonada","mountain",-35,28,"iron"]
 ];
 await env.DB.batch(nodes.map(n=>env.DB.prepare("INSERT OR IGNORE INTO world_territories(territory_key,name,terrain,x,z,resource_type,resource_rate) VALUES(?,?,?,?,?,?,?)").bind(...n,90)));
}
function jsonObject(value){
  try{const parsed=JSON.parse(value||"{}");return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};}catch{return {};}
}
function distributeLossesByStack(losses,unitRows){
  const remaining=new Map(Object.entries(losses||{}).map(([unit,quantity])=>[
    unit,Math.max(0,Math.floor(Number(quantity)||0))
  ]));
  const byStack={};
  for(const row of unitRows||[]){
    const key=row.unit_type+"_"+Number(row.tier||1);
    const pending=remaining.get(row.unit_type)||0;
    const lost=Math.min(Math.max(0,Math.floor(Number(row.quantity)||0)),pending);
    byStack[key]=lost;
    remaining.set(row.unit_type,pending-lost);
  }
  return byStack;
}
function makeHospitalWounds(lossesByStack,unitRows,hospitalLevel,currentRows=unitRows){
  const currentWounded=(currentRows||[]).reduce((sum,row)=>sum+Math.max(0,Number(row.wounded)||0),0);
  let capacity=Math.max(0,Math.floor(Number(hospitalLevel)||0)*100-currentWounded);
  const wounded={};
  for(const row of unitRows||[]){
    const key=row.unit_type+"_"+Number(row.tier||1);
    const lost=Math.max(0,Math.floor(Number(lossesByStack[key])||0));
    const recoverable=Math.min(capacity,Math.floor(lost*0.5));
    if(recoverable>0){
      wounded[key]=recoverable;
      capacity-=recoverable;
    }
  }
  return wounded;
}
async function restoreCancelledMarch(env,march,kingdomId,units,reason){
  const now=new Date().toISOString(),token=crypto.randomUUID();
  const guard="EXISTS(SELECT 1 FROM marches WHERE id=? AND kingdom_id=? AND status='completed' AND resolution_token=?)";
  const statements=[
    env.DB.prepare("UPDATE marches SET status='completed',resolved_at=?,resolution_token=? WHERE id=? AND kingdom_id=? AND status='marching' AND arrives_at<=?")
      .bind(now,token,march.id,kingdomId,now)
  ];
  for(const [unit,raw] of Object.entries(units||{})){
    const quantity=Math.max(0,Math.floor(Number(raw)||0));
    if(!Object.hasOwn(UNITS,unit)||quantity<1)continue;
    statements.push(env.DB.prepare("INSERT INTO army_units(kingdom_id,unit_type,tier,quantity,wounded) SELECT ?,?,1,?,0 WHERE "+guard+" ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET quantity=quantity+excluded.quantity")
      .bind(kingdomId,unit,quantity,march.id,kingdomId,token));
  }
  statements.push(env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,'march_cancelled',? WHERE "+guard)
    .bind(kingdomId,JSON.stringify({marchId:march.id,reason}),march.id,kingdomId,token));
  await env.DB.batch(statements);
}
async function resolvePvpMarch(env,march,attackerKingdomId,units,target){
  const defenderId=Number(target?.owner_kingdom_id||0);
  if(!defenderId||defenderId===Number(attackerKingdomId)){
    await restoreCancelledMarch(env,march,attackerKingdomId,units,"alvo inválido ou castelo próprio");
    return;
  }
  const [attacker,defender,attackerTroops,defenderTroops,attackerBuildings,defenderBuildings,attackerHero,defenderHero,attackerDragon,defenderDragon,attackerMilitary,defenderMilitary,attackerDefense,defenderDefense]=await Promise.all([
    env.DB.prepare("SELECT id,kingdom_name,castle_level,protection_until,map_region FROM kingdoms WHERE id=?").bind(attackerKingdomId).first(),
    env.DB.prepare("SELECT id,kingdom_name,castle_level,protection_until,map_region,battle_token,wall_hp,wall_max_hp,defense_power FROM kingdoms WHERE id=?").bind(defenderId).first(),
    env.DB.prepare("SELECT unit_type,tier,quantity,wounded FROM army_units WHERE kingdom_id=? ORDER BY tier,unit_type").bind(attackerKingdomId).all(),
    env.DB.prepare("SELECT unit_type,tier,quantity,wounded FROM army_units WHERE kingdom_id=? AND quantity>0 ORDER BY tier,unit_type").bind(defenderId).all(),
    env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type='hospital'").bind(attackerKingdomId).first(),
    env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type='hospital'").bind(defenderId).first(),
    env.DB.prepare("SELECT h.id,h.level FROM heroes h JOIN hero_inventory hi ON hi.kingdom_id=h.kingdom_id AND hi.hero_key=h.hero_key WHERE h.kingdom_id=? ORDER BY hi.level DESC,hi.stars DESC,h.id LIMIT 1").bind(attackerKingdomId).first(),
    env.DB.prepare("SELECT h.id,h.level FROM heroes h JOIN hero_inventory hi ON hi.kingdom_id=h.kingdom_id AND hi.hero_key=h.hero_key WHERE h.kingdom_id=? ORDER BY hi.level DESC,hi.stars DESC,h.id LIMIT 1").bind(defenderId).first(),
    env.DB.prepare("SELECT level FROM dragons WHERE kingdom_id=?").bind(attackerKingdomId).first(),
    env.DB.prepare("SELECT level FROM dragons WHERE kingdom_id=?").bind(defenderId).first(),
    env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='military'").bind(attackerKingdomId).first(),
    env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='military'").bind(defenderId).first(),
    env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='defense'").bind(attackerKingdomId).first(),
    env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='defense'").bind(defenderId).first()
  ]);
  if(!attacker||!defender){
    await restoreCancelledMarch(env,march,attackerKingdomId,units,"reino de destino não encontrado");
    return;
  }
  const now=new Date().toISOString();
  const protectedUntil=Date.parse(String(defender.protection_until||""));
  if(Number.isFinite(protectedUntil)&&protectedUntil>Date.now()){
    await restoreCancelledMarch(env,march,attackerKingdomId,units,"castelo protegido por escudo");
    return;
  }
  const allied=await env.DB.prepare(
    "SELECT 1 AS allied FROM alliance_members a JOIN alliance_members b ON b.alliance_id=a.alliance_id WHERE a.kingdom_id=? AND b.kingdom_id=? LIMIT 1"
  ).bind(attackerKingdomId,defenderId).first();
  if(allied){
    await restoreCancelledMarch(env,march,attackerKingdomId,units,"ataque contra aliado bloqueado");
    return;
  }
  const attackerArmy=Object.entries(units||{}).map(([unit,quantity])=>({
    unit_type:unit,tier:1,quantity:Math.max(0,Math.floor(Number(quantity)||0))
  })).filter(row=>Object.hasOwn(UNITS,row.unit_type)&&row.quantity>0);
  if(!attackerArmy.length){
    await restoreCancelledMarch(env,march,attackerKingdomId,units,"marcha sem tropas válidas");
    return;
  }

  await ensureEquipmentTables(env,attackerKingdomId);
  await ensureEquipmentTables(env,defenderId);
  const activeGearRows=async(kingdomId,hero)=>{
    if(!hero?.id)return {results:[]};
    return env.DB.prepare("SELECT ke.item_key,ke.level,ke.is_locked FROM kingdom_equipment ke JOIN hero_equipment he ON he.item_key=ke.item_key JOIN heroes h ON h.id=he.hero_id WHERE ke.kingdom_id=? AND he.hero_id=? AND h.kingdom_id=?")
      .bind(kingdomId,hero.id,kingdomId).all();
  };
  const researchRows=async kingdomId=>env.DB.prepare(
    "SELECT research_key,level FROM research WHERE kingdom_id=? AND research_key IN ('gear_forging','gear_ward','gear_vitality','gear_logistics')"
  ).bind(kingdomId).all();
  const [
    attackerGearRows,defenderGearRows,attackerGearResearch,defenderGearResearch,
    attackerValhalla,defenderValhalla,attackerPet,defenderPet
  ]=await Promise.all([
    activeGearRows(attackerKingdomId,attackerHero),activeGearRows(defenderId,defenderHero),
    researchRows(attackerKingdomId),researchRows(defenderId),
    getValhallaBuffMultipliers(env,attackerKingdomId),getValhallaBuffMultipliers(env,defenderId),
    getPetBonuses(env,attackerKingdomId),getPetBonuses(env,defenderId)
  ]);
  const attackerGear=equipmentBonuses(attackerGearRows.results||[],attackerGearResearch.results||[]);
  const defenderGear=equipmentBonuses(defenderGearRows.results||[],defenderGearResearch.results||[]);
  const attackerAttackBonus=attackerGear.attackPercent+Math.round((attackerValhalla.attackPower-1)*100);
  const defenderAttackBonus=defenderGear.attackPercent+Math.round((defenderValhalla.attackPower-1)*100);
  const attackerDefenseBonus=Math.min(30,Math.max(0,Number(attackerDefense?.level||0)+attackerGear.defensePercent));
  const defenderDefenseBonus=Math.min(30,Math.max(0,Number(defenderDefense?.level||0)+defenderGear.defensePercent));
  const attackerFlat=Number(attackerHero?.level||1)*1.5+Number(attackerDragon?.level||1)*2+Number(attackerMilitary?.level||0)*2.5;
  const defenderFlat=Number(defenderHero?.level||1)*1.5+Number(defenderDragon?.level||1)*2+Number(defenderMilitary?.level||0)*2.5;
  const criticalSeed=crypto.getRandomValues(new Uint32Array(1))[0];
  const roll=.85+crypto.getRandomValues(new Uint32Array(1))[0]/4294967295*.30;
  const wallHp=Math.max(0,Number(defender.wall_hp)||0);
  const simulation=simulatePvpBattle({
    army:attackerArmy,
    defenderArmy:defenderTroops.results||[],
    attackerCastleLevel:Number(attacker.castle_level||1),
    defenderCastleLevel:Number(defender.castle_level||1),
    attackerDefenseBonusPercent:attackerDefenseBonus,
    defenderDefenseBonusPercent:defenderDefenseBonus,
    attackerAttackBonusPercent:attackerAttackBonus+attackerPet.infantryAttackPercent,
    defenderAttackBonusPercent:defenderAttackBonus+defenderPet.infantryAttackPercent,
    attackerHealthBonusPercent:attackerGear.healthPercent,
    defenderHealthBonusPercent:defenderGear.healthPercent,
    attackerFlatBonus:attackerFlat,
    defenderFlatBonus:defenderFlat+Math.max(0,Number(defender.defense_power)||0)/100,
    wallHp,roll,criticalSeed,
    criticalChancePercent:attackerGear.criticalChancePercent,
    criticalDamageMultiplier:1.5
  });

  const attackerLosses=simulation.losses||{};
  const defenderLosses=simulation.defenderLosses||{};
  const attackerCurrent=attackerTroops.results||[];
  const defenderCurrent=defenderTroops.results||[];
  const attackerLossesByStack=distributeLossesByStack(attackerLosses,attackerArmy);
  const defenderLossesByStack=distributeLossesByStack(defenderLosses,defenderCurrent);
  const attackerWounded=makeHospitalWounds(attackerLossesByStack,attackerArmy,attackerBuildings?.level,attackerCurrent);
  const defenderWounded=makeHospitalWounds(defenderLossesByStack,defenderCurrent,defenderBuildings?.level);
  const attackerWoundedTotal=Object.values(attackerWounded).reduce((sum,value)=>sum+value,0);
  const defenderWoundedTotal=Object.values(defenderWounded).reduce((sum,value)=>sum+value,0);
  const attackerSurvivors=simulation.attackerSurvivors||{};
  const defenderSurvivors=simulation.defenderSurvivors||{};
  const attackerAlive=Object.values(attackerSurvivors).reduce((sum,value)=>sum+Number(value||0),0)>0;
  const defenderAlive=simulation.wallRemainingHp>0||Object.values(defenderSurvivors).reduce((sum,value)=>sum+Number(value||0),0)>0;
  const result=simulation.won?"win":(!attackerAlive?"lose":(!defenderAlive?"win":"draw"));
  const winner=result==="win"?attackerKingdomId:(result==="lose"?defenderId:null);
  const battleToken=crypto.randomUUID(),resolutionToken=crypto.randomUUID(),resolvedAt=new Date().toISOString();
  const defenderSnapshot=Object.fromEntries(defenderCurrent.map(row=>[
    row.unit_type+"_"+Number(row.tier||1),
    {quantity:Number(row.quantity)||0,wounded:Number(row.wounded)||0}
  ]));
  const expectedDefenderRows=defenderCurrent.length;
  const snapshotJson=JSON.stringify(defenderSnapshot);
  const pvpGuard="EXISTS(SELECT 1 FROM marches WHERE id=? AND kingdom_id=? AND status='completed' AND resolution_token=?) AND EXISTS(SELECT 1 FROM kingdoms WHERE id=? AND battle_token=?)";
  const defenderLock=env.DB.prepare(
    "UPDATE kingdoms SET battle_token=? WHERE id=? AND COALESCE(battle_token,'')=COALESCE(?, '') AND wall_hp=? " +
    "AND (protection_until IS NULL OR datetime(protection_until)<=datetime(?)) " +
    "AND (SELECT COUNT(*) FROM army_units WHERE kingdom_id=? AND quantity>0)=? " +
    "AND NOT EXISTS(SELECT 1 FROM json_each(?) expected LEFT JOIN army_units current ON current.kingdom_id=? AND current.unit_type||'_'||current.tier=expected.key " +
      "WHERE current.id IS NULL OR current.quantity<>CAST(json_extract(expected.value,'$.quantity') AS INTEGER) OR current.wounded<>CAST(json_extract(expected.value,'$.wounded') AS INTEGER)) " +
    "AND NOT EXISTS(SELECT 1 FROM alliance_members own JOIN alliance_members other ON own.alliance_id=other.alliance_id WHERE own.kingdom_id=? AND other.kingdom_id=?)"
  ).bind(battleToken,defenderId,defender.battle_token??"",wallHp,now,defenderId,expectedDefenderRows,snapshotJson,defenderId,attackerKingdomId,defenderId);
  const marchClaim=env.DB.prepare(
    "UPDATE marches SET status='completed',resolved_at=?,resolution_token=? WHERE id=? AND kingdom_id=? AND status='marching' AND arrives_at<=? " +
    "AND EXISTS(SELECT 1 FROM kingdoms WHERE id=? AND battle_token=?)"
  ).bind(resolvedAt,resolutionToken,march.id,attackerKingdomId,now,defenderId,battleToken);
  const statements=[defenderLock,marchClaim];
  for(const row of defenderCurrent){
    const key=row.unit_type+"_"+Number(row.tier||1);
    const lost=Math.min(Number(row.quantity)||0,Math.max(0,Number(defenderLossesByStack[key]||0)));
    const wounded=Math.min(lost,Math.max(0,Number(defenderWounded[key]||0)));
    if(lost>0||wounded>0){
      statements.push(env.DB.prepare(
        "UPDATE army_units SET quantity=MAX(0,quantity-?),wounded=wounded+? WHERE kingdom_id=? AND unit_type=? AND tier=? AND quantity=? AND wounded=? AND EXISTS(SELECT 1 FROM kingdoms WHERE id=? AND battle_token=?) AND EXISTS(SELECT 1 FROM marches WHERE id=? AND kingdom_id=? AND status='completed' AND resolution_token=?)"
      ).bind(lost,wounded,defenderId,row.unit_type,row.tier,row.quantity,row.wounded??0,defenderId,battleToken,march.id,attackerKingdomId,resolutionToken));
    }
  }
  if(simulation.wallDamage>0){
    statements.push(env.DB.prepare(
      "UPDATE kingdoms SET wall_hp=MAX(0,wall_hp-?) WHERE id=? AND wall_hp=? AND battle_token=? AND EXISTS(SELECT 1 FROM marches WHERE id=? AND kingdom_id=? AND status='completed' AND resolution_token=?)"
    ).bind(simulation.wallDamage,defenderId,wallHp,battleToken,march.id,attackerKingdomId,resolutionToken));
  }
  for(const [unit,qtyRaw] of Object.entries(attackerSurvivors)){
    const qty=Math.max(0,Math.floor(Number(qtyRaw)||0));
    const wounded=Math.max(0,Math.floor(Number(attackerWounded[unit+"_1"])||0));
    if(qty>0||wounded>0){
      statements.push(env.DB.prepare(
        "INSERT INTO army_units(kingdom_id,unit_type,tier,quantity,wounded) SELECT ?,?,1,?,? WHERE "+pvpGuard+" ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET quantity=quantity+excluded.quantity,wounded=wounded+excluded.wounded"
      ).bind(attackerKingdomId,unit,qty,wounded,march.id,attackerKingdomId,resolutionToken,defenderId,battleToken));
    }
  }
  const lossesJson=JSON.stringify({attacker:attackerLosses,defender:defenderLosses});
  const woundedJson=JSON.stringify({attacker:attackerWounded,defender:defenderWounded});
  const replay=JSON.stringify({
    version:1,mode:"pvp",seed:{criticalSeed,roll},
    participants:{
      attacker:{kingdom_id:attackerKingdomId,kingdom_name:attacker.kingdom_name||null,army:attackerArmy},
      defender:{kingdom_id:defenderId,kingdom_name:defender.kingdom_name||null,army:defenderCurrent,wall_hp:wallHp}
    },
    modifiers:{
      attacker:{attack:attackerAttackBonus,defense:attackerDefenseBonus,health:attackerGear.healthPercent,pet:attackerPet},
      defender:{attack:defenderAttackBonus,defense:defenderDefenseBonus,health:defenderGear.healthPercent,pet:defenderPet}
    },
    outcome:{
      result,rounds:simulation.rounds,attacker_power:simulation.attackerPower,
      defender_power:simulation.defenderPower,losses:JSON.parse(lossesJson),
      wounded:JSON.parse(woundedJson),wall_damage:simulation.wallDamage,
      wall_remaining_hp:simulation.wallRemainingHp
    },
    frames:(simulation.log||[]).map((frame,index)=>({sequence:index+1,...frame}))
  });
  const battleLog=JSON.stringify([
    {event:"pvp_battle_started",attackerKingdomId,defenderKingdomId:defenderId},
    {event:"pvp_combat_result",result,rounds:simulation.rounds,wallDamage:simulation.wallDamage,criticalHits:simulation.criticalHits||0},
    ...(simulation.log||[])
  ]);
  statements.push(env.DB.prepare(
    "INSERT INTO battle_reports(attacker_kingdom_id,defender_kingdom_id,winner_kingdom_id,territory_id,battle_type,attacker_power,defender_power,losses_json,wounded_json,wall_damage,rewards_json,battle_log,replay_json) " +
    "SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE "+pvpGuard
  ).bind(
    attackerKingdomId,defenderId,winner,target.id,"pvp",simulation.attackerPower,
    simulation.defenderPower,lossesJson,woundedJson,simulation.wallDamage,
    JSON.stringify({result,wallRemainingHp:simulation.wallRemainingHp,attackerWounded:attackerWoundedTotal,defenderWounded:defenderWoundedTotal}),
    battleLog,replay,march.id,attackerKingdomId,resolutionToken,defenderId,battleToken
  ));
  statements.push(env.DB.prepare(
    "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,'pvp_battle_attack',? WHERE "+pvpGuard
  ).bind(attackerKingdomId,JSON.stringify({marchId:march.id,defenderKingdomId:defenderId,result,losses:attackerLosses,wounded:attackerWounded,wallDamage:simulation.wallDamage}),march.id,attackerKingdomId,resolutionToken,defenderId,battleToken));
  statements.push(env.DB.prepare(
    "INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,'pvp_battle_defense',? WHERE "+pvpGuard
  ).bind(defenderId,JSON.stringify({marchId:march.id,attackerKingdomId,result,losses:defenderLosses,wounded:defenderWounded,wallDamage:simulation.wallDamage}),march.id,attackerKingdomId,resolutionToken,defenderId,battleToken));
  statements.push(env.DB.prepare(
    "INSERT INTO action_logs(kingdom_id,player_id,action_type,details_json) SELECT ?,NULL,'pvp_battle_resolved',? WHERE "+pvpGuard
  ).bind(attackerKingdomId,JSON.stringify({marchId:march.id,opponentKingdomId:defenderId,result}),march.id,attackerKingdomId,resolutionToken,defenderId,battleToken));
  statements.push(env.DB.prepare(
    "INSERT INTO action_logs(kingdom_id,player_id,action_type,details_json) SELECT ?,NULL,'pvp_battle_received',? WHERE "+pvpGuard
  ).bind(defenderId,JSON.stringify({marchId:march.id,opponentKingdomId:attackerKingdomId,result}),march.id,attackerKingdomId,resolutionToken,defenderId,battleToken));
  const resultBatch=await env.DB.batch(statements);
  if(!resultBatch[0]?.meta?.changes||!resultBatch[1]?.meta?.changes)return;
  await Promise.all([
    recalculateKingdomPower(env,attackerKingdomId),
    recalculateKingdomPower(env,defenderId)
  ]);
}
async function processMarches(env,kingdomId){
 const now=new Date().toISOString();
 const due=await env.DB.prepare("SELECT id,units_json,march_type,target_territory_id,started_at,arrives_at FROM marches WHERE kingdom_id=? AND status='marching' AND arrives_at<=? ORDER BY arrives_at,id LIMIT 50").bind(kingdomId,now).all();
 for(const m of due.results||[]){
  let units={};try{units=JSON.parse(m.units_json||"{}")}catch{}
  const resolvedAt=new Date().toISOString(),resolutionToken=crypto.randomUUID();
  const guard="EXISTS(SELECT 1 FROM marches WHERE id=? AND kingdom_id=? AND status='completed' AND resolution_token=?)";
  const statements=[
   // A resolução inteira é uma transação D1. Se qualquer escrita falhar, o status e todas as recompensas voltam juntos.
   env.DB.prepare("UPDATE marches SET status='completed',resolved_at=?,resolution_token=? WHERE id=? AND kingdom_id=? AND status='marching' AND arrives_at<=?").bind(resolvedAt,resolutionToken,m.id,kingdomId,now)
  ];
  if(m.march_type==="attack"){
   const target=await env.DB.prepare("SELECT id,name,level,owner_kingdom_id,territory_kind FROM world_territories WHERE id=?").bind(m.target_territory_id).first();
   if(target?.territory_kind==="castle"){await resolvePvpMarch(env,m,kingdomId,units,target);continue;}
   const army=Object.entries(units).map(([unit,quantity])=>({unit_type:unit,tier:1,quantity:Math.max(0,Math.floor(Number(quantity)||0))})).filter(u=>Object.hasOwn(UNITS,u.unit_type)&&u.quantity>0);
   let simulatedWin=false,attackerPower=0,defenderPower=0,losses={},battleLog=[],survivors={},replayData={};
   if(target&&!target.owner_kingdom_id&&army.length){
    const [kingdom,hero,dragon,military,defense]=await Promise.all([
     env.DB.prepare("SELECT castle_level FROM kingdoms WHERE id=?").bind(kingdomId).first(),
     env.DB.prepare("SELECT h.id,h.level FROM heroes h JOIN hero_inventory hi ON hi.kingdom_id=h.kingdom_id AND hi.hero_key=h.hero_key WHERE h.kingdom_id=? ORDER BY hi.level DESC,hi.stars DESC,h.id LIMIT 1").bind(kingdomId).first(),
     env.DB.prepare("SELECT level FROM dragons WHERE kingdom_id=?").bind(kingdomId).first(),
     env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='military'").bind(kingdomId).first(),
     env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='defense'").bind(kingdomId).first()
    ]);
    const [equipmentRows,gearResearchRows]=await Promise.all([
     hero?.id?env.DB.prepare("SELECT ke.item_key,ke.level,ke.is_locked FROM kingdom_equipment ke JOIN hero_equipment he ON he.item_key=ke.item_key JOIN heroes h ON h.id=he.hero_id WHERE ke.kingdom_id=? AND he.hero_id=? AND h.kingdom_id=?").bind(kingdomId,hero.id,kingdomId).all():Promise.resolve({results:[]}),
     env.DB.prepare("SELECT research_key,level FROM research WHERE kingdom_id=? AND research_key IN ('gear_forging','gear_ward','gear_vitality','gear_logistics')").bind(kingdomId).all()
    ]);
    const gear=equipmentBonuses(equipmentRows.results||[],gearResearchRows.results||[]);
    const [valhallaBuffs,petBonuses]=await Promise.all([getValhallaBuffMultipliers(env,kingdomId),getPetBonuses(env,kingdomId)]);
    const castleLevel=Number(kingdom?.castle_level||1);
    const criticalSeed=crypto.getRandomValues(new Uint32Array(1))[0];
    const battleRoll=.85+crypto.getRandomValues(new Uint32Array(1))[0]/4294967295*.30;
    const simulation=simulateBattle({
     army,castleLevel,defenderLevel:Math.max(1,Math.min(30,Number(target.level)||1)),
     heroLevel:Number(hero?.level||1),dragonLevel:Number(dragon?.level||1),
     researchLevel:Number(military?.level||0),
     defenseBonusPercent:Math.min(30,Math.max(0,Number(defense?.level||0)+gear.defensePercent)),
     equipmentAttackBonusPercent:gear.attackPercent+Math.round((valhallaBuffs.attackPower-1)*100),
     equipmentHealthBonusPercent:gear.healthPercent,
     infantryAttackBonusPercent:petBonuses.infantryAttackPercent,
     criticalChancePercent:gear.criticalChancePercent,
     criticalDamageMultiplier:1.5,
     criticalSeed,
     castlePowerBonusPercent:Math.min(30,Math.max(0,castleLevel)),
     roll:battleRoll
    });
    simulatedWin=simulation.won;attackerPower=simulation.attackerPower;defenderPower=simulation.defenderPower;
    losses=simulation.losses||{};
    replayData={version:1,mode:"territory_pve",seed:{criticalSeed,roll:battleRoll},participants:{attacker:{kingdom_id:kingdomId,army:army.map(unit=>({...unit}))},defender:{territory_id:target.id,level:Math.max(1,Math.min(30,Number(target.level)||1))}},modifiers:{equipment:{attack:gear.attackPercent,health:gear.healthPercent,defense:gear.defensePercent,critical:gear.criticalChancePercent},pet:{active_pet_id:petBonuses.activePetId,infantry_attack:petBonuses.infantryAttackPercent}},outcome:{won:simulation.won,rounds:simulation.rounds,attacker_power:simulation.attackerPower,defender_power:simulation.defenderPower,losses:simulation.losses||{}},frames:(simulation.log||[]).map((frame,index)=>({sequence:index+1,...frame}))};
    battleLog=[{event:"combat_metadata",criticalSeed,criticalChancePercent:gear.criticalChancePercent,pet:petBonuses,criticalHits:simulation.criticalHits||0},...(simulation.log||[])];
    Object.assign(survivors, applyUnitLosses(army, losses));
   }else{
    for(const u of army)survivors[u.unit_type]=u.quantity;
    battleLog=[{event:"attack_cancelled",reason:target?"territory_already_owned":"territory_missing"}];
   }
   // A captura é condicional e imediatamente seguida pelo relatório, que lê changes() da captura.
   statements.push(env.DB.prepare("UPDATE world_territories SET owner_kingdom_id=? WHERE id=? AND owner_kingdom_id IS NULL AND ?=1 AND "+guard).bind(kingdomId,m.target_territory_id,simulatedWin?1:0,m.id,kingdomId,resolutionToken));
   statements.push(env.DB.prepare("INSERT INTO battle_reports(attacker_kingdom_id,winner_kingdom_id,territory_id,battle_type,attacker_power,defender_power,losses_json,rewards_json,battle_log,replay_json) SELECT ?,CASE WHEN changes()>0 THEN ? ELSE NULL END,?,?,?,?,?,CASE WHEN changes()>0 THEN ? ELSE ? END,?,? WHERE "+guard)
    .bind(kingdomId,kingdomId,m.target_territory_id,"territory_pve",attackerPower,defenderPower,JSON.stringify(losses),JSON.stringify({territoryCaptured:true,criticalHits:simulation.criticalHits||0}),JSON.stringify({territoryCaptured:false,criticalHits:simulation.criticalHits||0}),JSON.stringify(battleLog),JSON.stringify(replayData),m.id,kingdomId,resolutionToken));
   // Uma pequena recompensa de material acompanha cada conquista válida.
   statements.push(env.DB.prepare("INSERT INTO inventory_items(kingdom_id,item_key,quantity) SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM battle_reports WHERE attacker_kingdom_id=? AND territory_id=? AND winner_kingdom_id=? ORDER BY id DESC LIMIT 1) AND "+guard+" ON CONFLICT(kingdom_id,item_key) DO UPDATE SET quantity=quantity+1")
    .bind(kingdomId,"power_crystal",kingdomId,m.target_territory_id,kingdomId,m.id,kingdomId,resolutionToken));
   for(const [unit,qty] of Object.entries(survivors)){
    if(qty>0)statements.push(env.DB.prepare("INSERT INTO army_units(kingdom_id,unit_type,tier,quantity) SELECT ?,?,?,? WHERE "+guard+" ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET quantity=quantity+excluded.quantity").bind(kingdomId,unit,1,qty,m.id,kingdomId,resolutionToken));
   }
   statements.push(env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,CASE WHEN json_extract((SELECT rewards_json FROM battle_reports WHERE attacker_kingdom_id=? AND territory_id=? ORDER BY id DESC LIMIT 1),'$.territoryCaptured')=1 THEN 'territory_captured' ELSE 'territory_attack_resolved' END,json_object('territoryId',?,'won',json_extract((SELECT rewards_json FROM battle_reports WHERE attacker_kingdom_id=? AND territory_id=? ORDER BY id DESC LIMIT 1),'$.territoryCaptured'),'losses',json(?)) WHERE "+guard)
    .bind(kingdomId,kingdomId,m.target_territory_id,m.target_territory_id,kingdomId,m.target_territory_id,JSON.stringify(losses),m.id,kingdomId,resolutionToken));
  }else{
   const marchMaterial=eventMaterialStatement(env,kingdomId,m.march_type==="gather"?"gather":"scout");
   if(marchMaterial){
    statements.push(env.DB.prepare("INSERT INTO inventory_items(kingdom_id,item_key,quantity) SELECT ?,?,1 WHERE "+guard+" ON CONFLICT(kingdom_id,item_key) DO UPDATE SET quantity=quantity+1").bind(kingdomId,m.march_type==="gather"?"power_crystal":"svip_medal",m.id,kingdomId,resolutionToken));
   }
   for(const [unit,raw] of Object.entries(units)){
    const qty=Math.max(0,Math.floor(Number(raw)||0));if(!Object.hasOwn(UNITS,unit)||qty<1)continue;
    statements.push(env.DB.prepare("INSERT INTO army_units(kingdom_id,unit_type,tier,quantity) SELECT ?,?,?,? WHERE "+guard+" ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET quantity=quantity+excluded.quantity").bind(kingdomId,unit,1,qty,m.id,kingdomId,resolutionToken));
   }
   if(m.march_type==="gather"){
    const target=await env.DB.prepare("SELECT resource_type,resource_rate FROM world_territories WHERE id=?").bind(m.target_territory_id).first();
    if(target&&["food","wood","stone","iron"].includes(target.resource_type)){
     const amount=Math.max(1,Number(target.resource_rate)||90);
     statements.push(env.DB.prepare("UPDATE kingdoms SET "+target.resource_type+"="+target.resource_type+"+? WHERE id=? AND "+guard).bind(amount,kingdomId,m.id,kingdomId,resolutionToken));
     statements.push(env.DB.prepare("INSERT INTO resource_ledger(kingdom_id,resource,amount,reason) SELECT ?,?,?,? WHERE "+guard).bind(kingdomId,target.resource_type,amount,"coleta por marcha",m.id,kingdomId,resolutionToken));
    }
   }
  }
  statements.push(env.DB.prepare(
    "INSERT INTO action_logs(kingdom_id,player_id,action_type,details_json) SELECT ?,NULL,'march_resolved',? WHERE EXISTS(SELECT 1 FROM marches WHERE id=? AND kingdom_id=? AND status='completed' AND resolution_token=?)"
  ).bind(kingdomId,JSON.stringify({marchId:m.id,marchType:m.march_type,targetTerritoryId:m.target_territory_id}),m.id,kingdomId,resolutionToken));
  await env.DB.batch(statements);
 }
}
const CASTLE_MATERIALS={
 royal_blueprint:{name:"Projeto Real",description:"Projeto especial para ampliar o Castelo."},
 imperial_seal:{name:"Brasão Imperial",description:"Selo raro exigido nas grandes evoluções."},
 power_crystal:{name:"Cristal de Poder",description:"Cristal usado para fortalecer o Castelo."},
 imperial_crest:{name:"Brasão de Prestígio",description:"Material raro das evoluções avançadas."},
 svip_medal:{name:"Medalha SVIP",description:"Medalha especial obtida em eventos; não é obrigatória para evoluir o Castelo."}
};
function eventMaterialStatement(env,kingdomId,eventKey){
 const rewards={battle:"royal_blueprint",gather:"power_crystal",scout:"svip_medal",upgrade:"imperial_seal",research:"imperial_crest",train:"royal_blueprint"};
 const key=rewards[eventKey];if(!key)return null;
 return env.DB.prepare("INSERT INTO inventory_items(kingdom_id,item_key,quantity) VALUES(?,?,1) ON CONFLICT(kingdom_id,item_key) DO UPDATE SET quantity=quantity+1").bind(kingdomId,key);
}
const EQUIPMENT_CATALOG={
 coroa_izzy:{name:"Coroa de Izzy",slot:"helmet",rarity:"lendario",maxLevel:20,icon:"👑",description:"Relíquia real que amplia a proteção e a produção.",base:{defense:10,resourceBonus:5},growth:{defense:5,resourceBonus:2}},
 manto_real:{name:"Manto Real",slot:"armor",rarity:"epico",maxLevel:15,icon:"🧥",description:"Manto reforçado que aumenta a vitalidade.",base:{health:50},growth:{health:25}},
 anel_poder:{name:"Anel do Poder",slot:"accessory",rarity:"raro",maxLevel:10,icon:"💍",description:"Anel antigo que fortalece o ataque.",base:{attack:20},growth:{attack:8}},
 espada_guerreiro:{name:"Espada do Guerreiro",slot:"weapon",rarity:"raro",maxLevel:30,icon:"⚔️",description:"Espada confiável para os primeiros heróis.",base:{attack:50,health:100},growth:{attack:8,health:25}},
 iron_sword:{name:"Lâmina de Ferro",slot:"weapon",rarity:"comum",maxLevel:20,icon:"⚔️",description:"Arma equilibrada, acessível para novos ferreiros.",base:{attack:12,critical:0.2},growth:{attack:3.5,critical:0.05},craft:{gold:650,iron:35}},
 rune_spear:{name:"Lança das Runas",slot:"weapon",rarity:"epico",maxLevel:20,icon:"🔱",description:"Lança rúnica com maior chance de acerto crítico.",base:{attack:21,critical:0.4},growth:{attack:4.5,critical:0.08},craft:{gold:2400,iron:100},requiredResearch:{gear_forging:2}},
 raven_helm:{name:"Elmo dos Corvos",slot:"helmet",rarity:"raro",maxLevel:20,icon:"🪶",description:"Elmo inspirado nos corvos de Odin.",base:{defense:13,critical:0.25},growth:{defense:3,critical:0.05},craft:{gold:1100,iron:55}},
 warden_plate:{name:"Couraça do Guardião",slot:"armor",rarity:"raro",maxLevel:20,icon:"🛡️",description:"Placas reforçadas para a linha de frente.",base:{defense:20,health:25},growth:{defense:4,health:6},craft:{gold:1500,iron:75},requiredResearch:{gear_ward:2}},
 storm_boots:{name:"Botas da Tempestade",slot:"boots",rarity:"epico",maxLevel:20,icon:"🥾",description:"Botas leves que aceleram as marchas.",base:{march:1,health:10},growth:{march:0.4,health:2},craft:{gold:2200,iron:90},requiredResearch:{gear_logistics:1}},
 frost_ring:{name:"Anel do Inverno",slot:"accessory",rarity:"raro",maxLevel:20,icon:"❄️",description:"Equilibra ataque e defesa com runas de gelo.",base:{attack:6,defense:6},growth:{attack:1.5,defense:1.5},craft:{gold:1300,iron:60},requiredResearch:{gear_ward:1}},
 mjolnir_fragment:{name:"Fragmento de Mjölnir",slot:"weapon",rarity:"lendario",maxLevel:20,icon:"⚡",description:"Relíquia lendária que amplia o poder crítico.",base:{attack:32,critical:0.8},growth:{attack:6,critical:0.12},craft:{gold:6200,iron:220},requiredResearch:{gear_forging:5,gear_ward:3}},
 valkyrie_charm:{name:"Talismã das Valquírias",slot:"accessory",rarity:"lendario",maxLevel:20,icon:"🪽",description:"Bênção de vigor e resistência.",base:{defense:15,health:45},growth:{defense:3,health:10},craft:{gold:5800,iron:200},requiredResearch:{gear_vitality:4}}
};
const STARTER_EQUIPMENT_KEYS=["coroa_izzy","manto_real","anel_poder","espada_guerreiro"];
const EQUIPMENT_RESEARCH={
 gear_forging:{name:"Metalurgia Rúnica",icon:"⚒️",description:"Aumenta o ataque concedido pelos equipamentos.",effect:"Ataque",perLevel:0.75,maxLevel:10,cost:{wood:500,stone:300,iron:60}},
 gear_ward:{name:"Runas de Proteção",icon:"ᛉ",description:"Aprimora a defesa concedida pelas peças.",effect:"Defesa",perLevel:0.75,maxLevel:10,cost:{wood:450,stone:400,iron:70}},
 gear_vitality:{name:"Forja Vital",icon:"❤️",description:"Amplia a vida concedida pelos equipamentos.",effect:"Vida",perLevel:0.5,maxLevel:10,cost:{wood:500,stone:350,iron:60}},
 gear_logistics:{name:"Passos de Asgard",icon:"🌬️",description:"Aumenta a velocidade das marchas do reino.",effect:"Marcha",perLevel:0.5,maxLevel:10,cost:{wood:600,stone:350,iron:100}}
};
async function ensureEquipmentTables(env,kingdomId){
 await env.DB.batch(STARTER_EQUIPMENT_KEYS.map(key=>env.DB.prepare("INSERT OR IGNORE INTO kingdom_equipment(kingdom_id,item_key,level,is_locked) VALUES(?,?,1,0)").bind(kingdomId,key)));
 return (await env.DB.prepare("SELECT item_key,level,is_locked,updated_at FROM kingdom_equipment WHERE kingdom_id=? ORDER BY item_key").bind(kingdomId).all()).results||[];
}
function equipmentBonuses(rows=[],researchRows=[]){
 const totals={attack:0,defense:0,health:0,resourceBonus:0,critical:0,march:0};
 for(const row of rows){const item=equipmentView(row);if(!item)continue;for(const key of Object.keys(totals))totals[key]+=Math.max(0,Number(item.stats?.[key])||0);}
 const levels=Object.fromEntries(researchRows.map(row=>[row.research_key,Math.max(0,Number(row.level)||0)]));
 const forging=Math.min(10,levels.gear_forging||0)*0.75;
 const ward=Math.min(10,levels.gear_ward||0)*0.75;
 const vitality=Math.min(10,levels.gear_vitality||0)*0.5;
 const logistics=Math.min(10,levels.gear_logistics||0)*0.5;
 return {
  attackPercent:Math.min(30,Number((totals.attack/10+forging).toFixed(2))),
  defensePercent:Math.min(30,Number((totals.defense/10+ward).toFixed(2))),
  healthPercent:Math.min(30,Number((totals.health/25+vitality).toFixed(2))),
  resourcePercent:Math.min(50,totals.resourceBonus),
  criticalChancePercent:Math.min(15,totals.critical),
  marchSpeedPercent:Math.min(25,totals.march+logistics)
 };
}

function equipmentView(row){
 const def=EQUIPMENT_CATALOG[row.item_key];if(!def)return null;
 const level=Number(row.level),stats={};
 for(const [key,value] of Object.entries(def.base))stats[key]=value+(def.growth[key]||0)*(level-1);
 const next={};for(const [key,value] of Object.entries(def.base))next[key]=value+(def.growth[key]||0)*level;
 const multiplier=({comum:1,raro:1.1,epico:1.2,lendario:1.5})[def.rarity]||1;
 return {id:row.item_key,name:def.name,slot:def.slot,rarity:def.rarity,icon:def.icon||"⚔️",description:def.description||"",craft:def.craft||null,requiredResearch:def.requiredResearch||{},level,maxLevel:def.maxLevel,isLocked:Boolean(row.is_locked),stats,nextLevelStats:level<def.maxLevel?next:null,upgradeCost:Math.floor(100*Math.pow(1.3,level)*multiplier)};
}

async function syncHeroSystems(env,kingdomId){
  // hero_inventory is canonical for collection progression; heroes is the equipment binding.
  await env.DB.prepare("INSERT OR IGNORE INTO hero_inventory(kingdom_id,hero_key,rarity,level,experience) SELECT kingdom_id,hero_key,CASE rarity WHEN 'common' THEN 'white' WHEN 'rare' THEN 'blue' WHEN 'epic' THEN 'purple' WHEN 'legendary' THEN 'purple' WHEN 'mythic' THEN 'purple' ELSE 'white' END,level,experience FROM heroes WHERE kingdom_id=?").bind(kingdomId).run();
  const inventory=await env.DB.prepare(
    "SELECT hi.hero_key,hi.rarity,hi.level,hi.experience,vhc.hero_name AS seasonal_hero_name,vhc.rarity AS seasonal_hero_rarity " +
    "FROM hero_inventory hi LEFT JOIN valhalla_hero_catalog vhc ON vhc.hero_key=hi.hero_key " +
    "WHERE hi.kingdom_id=? ORDER BY hi.hero_key"
  ).bind(kingdomId).all();
  const statements=(inventory.results||[]).map(hero=>{
    const rarity=hero.seasonal_hero_rarity || (hero.rarity==="white"?"common":hero.rarity==="blue"?"rare":"legendary");
    const name=HERO_TEMPLATES[hero.hero_key]?.name||hero.seasonal_hero_name||hero.hero_key;
    return env.DB.prepare("INSERT INTO heroes(kingdom_id,hero_key,hero_name,level,experience,rarity) VALUES(?,?,?,?,?,?) ON CONFLICT(kingdom_id,hero_key) DO UPDATE SET level=MAX(heroes.level,excluded.level),experience=MAX(heroes.experience,excluded.experience),rarity=excluded.rarity,hero_name=CASE WHEN heroes.hero_name IS NULL OR heroes.hero_name='' THEN excluded.hero_name ELSE heroes.hero_name END WHERE heroes.level<excluded.level OR heroes.experience<excluded.experience OR heroes.rarity<>excluded.rarity OR heroes.hero_name IS NULL OR heroes.hero_name=''")
      .bind(kingdomId,hero.hero_key,name,Math.max(1,Number(hero.level)||1),Math.max(0,Number(hero.experience)||0),rarity);
  });
  if(statements.length)await env.DB.batch(statements);
  await env.DB.prepare("UPDATE hero_inventory SET level=MAX(level,COALESCE((SELECT h.level FROM heroes h WHERE h.kingdom_id=hero_inventory.kingdom_id AND h.hero_key=hero_inventory.hero_key),level)),experience=MAX(experience,COALESCE((SELECT h.experience FROM heroes h WHERE h.kingdom_id=hero_inventory.kingdom_id AND h.hero_key=hero_inventory.hero_key),experience)) WHERE kingdom_id=? AND (level<COALESCE((SELECT h.level FROM heroes h WHERE h.kingdom_id=hero_inventory.kingdom_id AND h.hero_key=hero_inventory.hero_key),level) OR experience<COALESCE((SELECT h.experience FROM heroes h WHERE h.kingdom_id=hero_inventory.kingdom_id AND h.hero_key=hero_inventory.hero_key),experience))").bind(kingdomId).run();
}

async function gameState(env,playerId){

  const p=await env.DB.prepare("SELECT p.id,p.player_id,p.name,p.gems,n.nickname FROM players p LEFT JOIN player_nicknames n ON n.player_id=p.id WHERE p.player_id=?").bind(playerId).first();
  if(!p)return null;
  const kingdom=await env.DB.prepare("SELECT * FROM kingdoms WHERE player_id=?").bind(p.id).first();
  if(!kingdom)return null;
  await syncHeroSystems(env,kingdom.id);
  await applyProduction(env,kingdom.id);
  await seedWorld(env);
  await processMarches(env,kingdom.id);
  await processDueKingdomQueues(env,kingdom.id);
  await recalculateKingdomStats(env,kingdom.id);
  await recalculateKingdomPower(env,kingdom.id);
  const [fresh,buildings,troops,heroes,dragon,research,territories,marches,reports,heroInventory,heroHistory,inventoryItems,recentEvents,queues]=await Promise.all([
    env.DB.prepare("SELECT * FROM kingdoms WHERE id=?").bind(kingdom.id).first(),
    env.DB.prepare("SELECT building_type,level,position_x,position_z FROM kingdom_buildings WHERE kingdom_id=? ORDER BY id").bind(kingdom.id).all(),
    env.DB.prepare("SELECT unit_type,tier,quantity,wounded FROM army_units WHERE kingdom_id=? ORDER BY tier,unit_type").bind(kingdom.id).all(),
    env.DB.prepare("SELECT id,hero_key,hero_name,level,experience,rarity,assigned_to FROM heroes WHERE kingdom_id=? ORDER BY level DESC,id").bind(kingdom.id).all(),
    env.DB.prepare("SELECT dragon_key,dragon_name,level,experience,bond FROM dragons WHERE kingdom_id=?").bind(kingdom.id).first(),
    env.DB.prepare("SELECT research_key,level FROM research WHERE kingdom_id=?").bind(kingdom.id).all(),
    env.DB.prepare(
      "SELECT wt.id,wt.name,wt.terrain,"+
      "CASE WHEN wt.territory_kind='castle' THEN wt.x-? ELSE wt.x END AS x,"+
      "CASE WHEN wt.territory_kind='castle' THEN wt.z-? ELSE wt.z END AS z,"+
      "wt.resource_type,wt.resource_rate,wt.owner_kingdom_id,wt.level,wt.territory_kind,"+
      "owner.id AS kingdom_id,owner.kingdom_name,owner.castle_level,owner.power,"+
      "owner.wall_hp,owner.wall_max_hp,owner.defense_power,owner.protection_until,"+
      "COALESCE(n.nickname,op.name) AS commander_name,"+
      "COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=owner.id),'') AS alliance_tag "+
      "FROM world_territories wt LEFT JOIN kingdoms owner ON owner.id=wt.owner_kingdom_id "+
      "LEFT JOIN players op ON op.id=owner.player_id LEFT JOIN player_nicknames n ON n.player_id=op.id "+
      "WHERE wt.territory_kind='resource' OR (wt.territory_kind='castle' AND owner.map_region=? AND wt.owner_kingdom_id<>? "+
      "AND wt.x BETWEEN ? AND ? AND wt.z BETWEEN ? AND ?) ORDER BY wt.territory_kind,wt.id LIMIT 250"
    ).bind(Number(kingdom.map_x)||0,Number(kingdom.map_z)||0,Number(kingdom.map_region)||1,kingdom.id,
      (Number(kingdom.map_x)||0)-55,(Number(kingdom.map_x)||0)+55,
      (Number(kingdom.map_z)||0)-45,(Number(kingdom.map_z)||0)+45).all(),
    env.DB.prepare("SELECT id,march_type,status,started_at,arrives_at,target_territory_id,units_json FROM marches WHERE kingdom_id=? ORDER BY id DESC LIMIT 20").bind(kingdom.id).all(),
    env.DB.prepare("SELECT id,battle_type,attacker_kingdom_id,defender_kingdom_id,attacker_power,defender_power,winner_kingdom_id,losses_json,wounded_json,wall_damage,rewards_json,created_at,CASE WHEN replay_expires_at>unixepoch() AND replay_json<>'{}' THEN 1 ELSE 0 END AS has_replay FROM battle_reports WHERE attacker_kingdom_id=? OR defender_kingdom_id=? ORDER BY id DESC LIMIT 20").bind(kingdom.id,kingdom.id).all(),
    env.DB.prepare("SELECT * FROM hero_inventory WHERE kingdom_id=? ORDER BY level DESC,stars DESC,hero_key").bind(kingdom.id).all(),
    env.DB.prepare("SELECT hero_key,rarity,result_type,created_at FROM hero_summon_history WHERE kingdom_id=? ORDER BY id DESC LIMIT 20").bind(kingdom.id).all(),
    env.DB.prepare("SELECT item_key,quantity FROM inventory_items WHERE kingdom_id=? AND quantity>0 ORDER BY item_key").bind(kingdom.id).all()
    ,env.DB.prepare("SELECT id,event_type,payload_json FROM kingdom_events WHERE kingdom_id=? AND event_type!='__internal_action_guard' ORDER BY id DESC LIMIT 15").bind(kingdom.id).all(),
    env.DB.prepare("SELECT id,queue_type,queue_slot,target_key,quantity,from_level,to_level,reward_item,status,started_at,completes_at,completed_at FROM kingdom_queues WHERE kingdom_id=? ORDER BY CASE WHEN status='running' THEN 0 ELSE 1 END,queue_type,queue_slot,id DESC LIMIT 20").bind(kingdom.id).all()
  ]);
  const pendingInvites=await env.DB.prepare("SELECT i.id,i.created_at,a.name,a.tag FROM alliance_invites i JOIN alliances a ON a.id=i.alliance_id WHERE i.target_kingdom_id=? ORDER BY i.id DESC").bind(kingdom.id).all();
  const alliance=await env.DB.prepare("SELECT a.id,a.name,a.tag,a.description,a.level,a.xp,a.max_members,a.territory_count,a.shared_food,a.shared_wood,a.shared_stone,a.shared_iron,a.shared_gold,am.role,am.rank,am.contribution,(SELECT COUNT(*) FROM alliance_members x WHERE x.alliance_id=a.id) AS member_count FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=?").bind(kingdom.id).first();
  let allianceDetails=null;
  if(alliance){
    const [members,chat,invites,wars]=await Promise.all([
      env.DB.prepare("SELECT am.kingdom_id,am.rank,am.contribution,k.kingdom_name,k.power FROM alliance_members am JOIN kingdoms k ON k.id=am.kingdom_id WHERE am.alliance_id=? ORDER BY CASE am.rank WHEN 'lider' THEN 4 WHEN 'co_lider' THEN 3 WHEN 'oficial' THEN 2 ELSE 1 END DESC,k.power DESC").bind(alliance.id).all(),
      env.DB.prepare("SELECT c.id,c.message,c.created_at,k.kingdom_name FROM alliance_chat c JOIN kingdoms k ON k.id=c.kingdom_id WHERE c.alliance_id=? ORDER BY c.id DESC LIMIT 50").bind(alliance.id).all(),
      env.DB.prepare("SELECT i.id,i.created_at,a.name,a.tag FROM alliance_invites i JOIN alliances a ON a.id=i.alliance_id WHERE i.target_kingdom_id=? ORDER BY i.id DESC").bind(kingdom.id).all(),
      env.DB.prepare("SELECT w.id,w.alliance_a_id,w.alliance_b_id,w.starts_at,w.ends_at,w.status,w.score_a,w.score_b,aa.name AS alliance_a_name,aa.tag AS alliance_a_tag,ab.name AS alliance_b_name,ab.tag AS alliance_b_tag FROM alliance_wars w JOIN alliances aa ON aa.id=w.alliance_a_id JOIN alliances ab ON ab.id=w.alliance_b_id WHERE (w.alliance_a_id=? OR w.alliance_b_id=?) ORDER BY w.id DESC LIMIT 10").bind(alliance.id,alliance.id).all()
    ]);
    allianceDetails={...alliance,members:members.results||[],chat:(chat.results||[]).reverse(),invites:invites.results||[],wars:wars.results||[]};
  }
  const totalTroops=(troops.results||[]).reduce((n,u)=>n+Number(u.quantity||0),0);
  const barracksLevel=Math.max(1,Number((buildings.results||[]).find(row=>row.building_type==="barracks")?.level||1));
  const troopCapacity=barracksLevel*TROOP_CAPACITY_PER_BARRACKS_LEVEL;
  const fieldTroops=(marches.results||[]).filter(row=>row.status==="marching").reduce((total,row)=>{
    try{return total+Object.values(JSON.parse(row.units_json||"{}")).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value)||0)),0)}catch{return total;}
  },0);
  const queuedTraining=(queues.results||[]).filter(row=>row.queue_type==="training"&&row.status==="running").reduce((sum,row)=>sum+Math.max(0,Number(row.quantity)||0),0);
  const armyCount=totalTroops+fieldTroops+queuedTraining;
  const shop=await getShopState(env,kingdom.id);
  const cosmetics=await getCosmeticState(env,kingdom.id);
  const equipmentRows=await ensureEquipmentTables(env,kingdom.id);
  const heroEquipment=(await env.DB.prepare("SELECT he.hero_id,h.hero_name,he.slot,he.item_key,he.level FROM hero_equipment he JOIN heroes h ON h.id=he.hero_id WHERE h.kingdom_id=? ORDER BY h.level DESC,h.id,he.slot").bind(kingdom.id).all()).results||[];
  const equippedByItem=new Map(heroEquipment.map(item=>[item.item_key,Number(item.hero_id)]));
  const equipment=equipmentRows.map(row=>({...equipmentView(row),equippedHeroId:equippedByItem.get(row.item_key)||null})).filter(Boolean);
  const ownedEquipmentKeys=new Set(equipmentRows.map(row=>row.item_key));
  const equipmentCatalog=Object.entries(EQUIPMENT_CATALOG).map(([id,def])=>({...def,id,owned:ownedEquipmentKeys.has(id)}));
  const researchLevels=new Map((research.results||[]).map(row=>[row.research_key,Number(row.level)||0]));
  const equipmentResearch=Object.entries(EQUIPMENT_RESEARCH).map(([id,def])=>{const level=researchLevels.get(id)||0;return {...def,id,level,nextCost:Object.fromEntries(Object.entries(def.cost).map(([resource,amount])=>[resource,amount*(level+1)]))};});
  const activeHeroKey=(heroInventory.results||[])[0]?.hero_key||(heroes.results||[])[0]?.hero_key;
  const activeHeroId=Number((heroes.results||[]).find(hero=>hero.hero_key===activeHeroKey)?.id||0);
  const activeGearRows=heroEquipment.filter(item=>Number(item.hero_id)===activeHeroId).map(item=>equipmentRows.find(row=>row.item_key===item.item_key)).filter(Boolean);
  const activeGear=equipmentBonuses(activeGearRows,research.results||[]);
  const petState=await getPetsState(env,kingdom.id);
  return {equipment,heroEquipment,equipmentCatalog,equipmentResearch,equipmentBonuses:activeGear,cosmetics,player:{player_id:p.player_id,name:p.name,nickname:p.nickname||null,gems:p.gems},pets:petState.pets,petBonuses:petState.bonuses,petGold:petState.gold,kingdom:fresh,shop,castleMaterials:CASTLE_MATERIALS,recentEvents:recentEvents.results||[],inventoryItems:inventoryItems.results||[],buildings:buildings.results||[],troops:troops.results||[],heroes:heroes.results||[],heroInventory:(heroInventory.results||[]).map(heroView),heroSummonHistory:heroHistory.results||[],dragon,research:research.results||[],researchBonuses:{troopDefensePercent:Math.min(30,Math.max(0,Number((research.results||[]).find(x=>x.research_key==="defense")?.level||0)))},combatBonuses:{castlePowerPercent:Math.min(30,Math.max(0,Number(fresh?.castle_level||1)))},territories:territories.results||[],marches:marches.results||[],battleReports:reports.results||[],alliance:allianceDetails,pendingInvites:pendingInvites.results||[],queues:queues.results||[],totalTroops,fieldTroops,queuedTraining,armyCount,troopCapacity};
}
async function gameAction(env,playerId,body){
  const p=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
  if(!p)return json({error:"Jogador não encontrado."},404);
  const k=await env.DB.prepare("SELECT * FROM kingdoms WHERE player_id=?").bind(p.id).first();
  if(!k)return json({error:"Reino não encontrado."},404);
  await syncHeroSystems(env,k.id);
  await applyProduction(env,k.id);
  const type=String(body.type||"");
  let battleOutcome=null;

  if(type==="set_nickname"){
    const nickname=String(body.nickname||"").normalize("NFKC").trim();
    if(!/^[\p{L}\p{N}_-]{3,20}$/u.test(nickname))return json({error:"Use um nickname de 3 a 20 caracteres: letras, números, _ ou -."},400);
    const nicknameKey=nickname.toLocaleLowerCase("en-US");
    try{
      await env.DB.prepare("INSERT INTO player_nicknames(player_id,nickname,nickname_key) VALUES(?,?,?) ON CONFLICT(player_id) DO UPDATE SET nickname=excluded.nickname,nickname_key=excluded.nickname_key")
        .bind(p.id,nickname,nicknameKey).run();
    }catch(error){
      const conflict=await env.DB.prepare("SELECT player_id FROM player_nicknames WHERE nickname_key=?").bind(nicknameKey).first();
      if(conflict&&Number(conflict.player_id)!==Number(p.id))return json({error:"Este nickname já está em uso. Escolha outro."},409);
      throw error;
    }
  }else if(type==="equipment_craft"){
    const itemKey=String(body.itemId||""),def=EQUIPMENT_CATALOG[itemKey];
    if(!def||!def.craft)return json({error:"Projeto de forja inválido."},400);
    const owned=await ensureEquipmentTables(env,k.id);
    if(owned.some(row=>row.item_key===itemKey))return json({error:"Você já possui este equipamento."},409);
    for(const [researchKey,requiredLevel] of Object.entries(def.requiredResearch||{})){
      const current=await env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key=?").bind(k.id,researchKey).first();
      if(Number(current?.level||0)<requiredLevel)return json({error:"Pesquise "+(EQUIPMENT_RESEARCH[researchKey]?.name||researchKey)+" nível "+requiredLevel+" antes de forjar esta peça."},409);
    }
    const goldCost=Math.max(0,Math.floor(Number(def.craft.gold)||0)),ironCost=Math.max(0,Math.floor(Number(def.craft.iron)||0));
    const actionId=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?)";
    const result=await env.DB.batch([
      env.DB.prepare("UPDATE kingdoms SET gold=gold-?,iron=iron-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND gold>=? AND iron>=? AND NOT EXISTS(SELECT 1 FROM kingdom_equipment WHERE kingdom_id=? AND item_key=?)").bind(goldCost,ironCost,k.id,goldCost,ironCost,k.id,itemKey),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"__internal_action_guard",actionId),
      env.DB.prepare("INSERT INTO kingdom_equipment(kingdom_id,item_key,level,is_locked) SELECT ?,?,1,0 WHERE "+guard).bind(k.id,itemKey,k.id,actionId),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE "+guard).bind(k.id,"equipment_crafted",JSON.stringify({item:itemKey,gold:goldCost,iron:ironCost}),k.id,actionId),
      env.DB.prepare("DELETE FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?").bind(k.id,actionId)
    ]);
    if(!result[0]?.meta?.changes)return json({error:"Ouro ou ferro insuficiente, ou projeto já forjado."},409);
  }else if(type==="equipment_upgrade"){
    const itemKey=String(body.itemId||""),def=EQUIPMENT_CATALOG[itemKey];
    if(!def)return json({error:"Equipamento inválido."},400);
    const rows=await ensureEquipmentTables(env,k.id),row=rows.find(x=>x.item_key===itemKey);
    if(!row)return json({error:"Equipamento não encontrado."},404);
    if(Number(row.is_locked))return json({error:"Destrave o equipamento antes de evoluir."},409);
    const level=Number(row.level);
    if(level>=def.maxLevel)return json({error:"Este equipamento já atingiu o nível máximo."},409);
    const multiplier=({comum:1,raro:1.1,epico:1.2,lendario:1.5})[def.rarity]||1;
    const cost=Math.floor(100*Math.pow(1.3,level)*multiplier);
    const actionId=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?)";
    const statements=[
      env.DB.prepare("UPDATE kingdoms SET gold=gold-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND gold>=? AND EXISTS(SELECT 1 FROM kingdom_equipment WHERE kingdom_id=? AND item_key=? AND level=? AND is_locked=0)").bind(cost,k.id,cost,k.id,itemKey,level),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"__internal_action_guard",actionId),
      env.DB.prepare("UPDATE kingdom_equipment SET level=level+1,updated_at=CURRENT_TIMESTAMP WHERE kingdom_id=? AND item_key=? AND level=? AND is_locked=0 AND "+guard+"").bind(k.id,itemKey,level,k.id,actionId),
      env.DB.prepare("UPDATE hero_equipment SET level=level+1 WHERE item_key=? AND hero_id IN (SELECT id FROM heroes WHERE kingdom_id=?) AND EXISTS(SELECT 1 FROM kingdom_equipment WHERE kingdom_id=? AND item_key=? AND level=?)").bind(itemKey,k.id,k.id,itemKey,level+1),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE "+guard+"").bind(k.id,"equipment_upgraded",JSON.stringify({item:itemKey,from:level,to:level+1,cost}),k.id,actionId),
      env.DB.prepare("DELETE FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?").bind(k.id,actionId)
    ];
    const result=await env.DB.batch(statements);
    if(!result[0]?.meta?.changes||!result[2]?.meta?.changes)return json({error:"Ouro insuficiente ou equipamento alterado. Atualize e tente novamente."},409);
  }else if(type==="equipment_equip"){
    const itemKey=String(body.itemId||""),heroId=Number(body.heroId),def=EQUIPMENT_CATALOG[itemKey];
    if(!def||!Number.isSafeInteger(heroId)||heroId<1)return json({error:"Equipamento ou herói inválido."},400);
    const rows=await ensureEquipmentTables(env,k.id),row=rows.find(x=>x.item_key===itemKey);
    if(!row)return json({error:"Equipamento não encontrado no inventário."},404);
    const hero=await env.DB.prepare("SELECT id FROM heroes WHERE id=? AND kingdom_id=?").bind(heroId,k.id).first();
    if(!hero)return json({error:"Herói não pertence a este reino."},404);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM hero_equipment WHERE item_key=? AND hero_id IN (SELECT id FROM heroes WHERE kingdom_id=?)").bind(itemKey,k.id),
      env.DB.prepare("INSERT INTO hero_equipment(hero_id,slot,item_key,level) VALUES(?,?,?,?) ON CONFLICT(hero_id,slot) DO UPDATE SET item_key=excluded.item_key,level=excluded.level").bind(heroId,def.slot,itemKey,row.level)
    ]);
  }else if(type==="equipment_unequip"){
    const itemKey=String(body.itemId||""),heroId=Number(body.heroId);
    if(!EQUIPMENT_CATALOG[itemKey]||!Number.isSafeInteger(heroId)||heroId<1)return json({error:"Equipamento ou herói inválido."},400);
    const hero=await env.DB.prepare("SELECT id FROM heroes WHERE id=? AND kingdom_id=?").bind(heroId,k.id).first();
    if(!hero)return json({error:"Herói não pertence a este reino."},404);
    const result=await env.DB.prepare("DELETE FROM hero_equipment WHERE hero_id=? AND item_key=?").bind(heroId,itemKey).run();
    if(!result.meta.changes)return json({error:"Este equipamento não está equipado nesse herói."},409);
  }else if(type==="equipment_lock"){
    const itemKey=String(body.itemId||"");
    if(!EQUIPMENT_CATALOG[itemKey])return json({error:"Equipamento inválido."},400);
    const rows=await ensureEquipmentTables(env,k.id),row=rows.find(x=>x.item_key===itemKey);
    if(!row)return json({error:"Equipamento não encontrado."},404);
    await env.DB.prepare("UPDATE kingdom_equipment SET is_locked=?,updated_at=CURRENT_TIMESTAMP WHERE kingdom_id=? AND item_key=?").bind(Number(!Number(row.is_locked)),k.id,itemKey).run();
  }else if(type==="cosmetic_buy"){
    await ensureCosmeticDefaults(env,k.id);
    const id=String(body.skin||""),skin=COSMETIC_SKINS[id];
    if(!skin)return json({error:"Skin inválida."},400);
    const price=Math.max(1,Math.floor(Number(skin.price)||0));
    const result=await env.DB.batch([
      env.DB.prepare("UPDATE players SET gems=gems-? WHERE id=? AND gems>=? AND NOT EXISTS(SELECT 1 FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=?)").bind(price,p.id,price,k.id,id),
      env.DB.prepare("INSERT INTO kingdom_cosmetics(kingdom_id,item_id,kind) SELECT ?,?,'standard' WHERE changes()>0").bind(k.id,id),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"cosmetic_skin_purchased",JSON.stringify({skin:id,price}))
    ]);
    if(!result[0]?.meta?.changes)return json({error:"Diamantes insuficientes ou skin já adquirida."},409);
  }else if(type==="cosmetic_claim"){
    await ensureCosmeticDefaults(env,k.id);
    const collectionId=String(body.collection||""),col=COSMETIC_COLLECTIONS.find(x=>x.id===collectionId);
    if(!col)return json({error:"Coleção inválida."},400);
    const ownedRows=await env.DB.prepare("SELECT item_id FROM kingdom_cosmetics WHERE kingdom_id=?").bind(k.id).all();
    const owned=new Set((ownedRows.results||[]).map(x=>x.item_id));
    const complete=col.special?COSMETIC_COLLECTIONS.filter(x=>!x.special).every(x=>x.skins.every(id=>owned.has(id))):col.skins.every(id=>owned.has(id));
    if(!complete)return json({error:"Ainda faltam skins para completar esta coleção."},409);
    // A chave única da recompensa é o bloqueio de idempotência. Só a requisição
    // que inserir a reivindicação pode creditar gemas, fragmentos e evento.
    const result=await env.DB.batch([
      env.DB.prepare("INSERT INTO kingdom_collection_claims(kingdom_id,collection_id) VALUES(?,?) ON CONFLICT(kingdom_id,collection_id) DO NOTHING").bind(k.id,collectionId),
      env.DB.prepare("UPDATE players SET gems=gems+? WHERE id=? AND changes()>0").bind(col.gems,p.id),
      env.DB.prepare("UPDATE kingdom_cosmetic_wallet SET shards=shards+? WHERE kingdom_id=? AND changes()>0").bind(col.shards,k.id),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"collection_reward",JSON.stringify({collection:collectionId,gems:col.gems,shards:col.shards}))
    ]);
    if(!result[0]?.meta?.changes)return json({error:"Esta recompensa já foi resgatada."},409);
  }else if(type==="seasonal_buy"){
    const id=String(body.skin||""),skin=SEASONAL_COSMETICS.find(x=>x.id===id);
    if(!skin)return json({error:"Skin sazonal inválida."},400);
    if(Date.now()>=Date.parse(SEASON_END))return json({error:"O evento sazonal terminou."},409);
    const exists=await env.DB.prepare("SELECT 1 FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=?").bind(k.id,id).first();
    if(exists)return json({error:"Você já possui esta skin."},409);
    const purchase=await env.DB.batch([
      env.DB.prepare("UPDATE players SET gems=gems-? WHERE id=? AND gems>=? AND NOT EXISTS(SELECT 1 FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=?)").bind(skin.price,p.id,skin.price,k.id,id),
      env.DB.prepare("INSERT INTO kingdom_cosmetics(kingdom_id,item_id,kind) SELECT ?,?,'seasonal' WHERE changes()>0").bind(k.id,id),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"seasonal_skin_purchased",JSON.stringify({skin:id,price:skin.price}))
    ]);
    if(!purchase[0]?.meta?.changes)return json({error:"Diamantes insuficientes ou skin já adquirida."},409);
  }else if(type==="skin_fuse"){
    const inputs=Array.isArray(body.inputs)?body.inputs.map(String):[];
    if(inputs.length!==3||new Set(inputs).size!==3)return json({error:"Selecione três skins diferentes."},400);
    const recipe=SKIN_FUSIONS.find(x=>[...x.inputs].sort().join("|")===[...inputs].sort().join("|"));
    if(!recipe)return json({error:"Essa combinação não possui uma receita de fusão."},400);
    const output=recipe.output;
    const owned=await env.DB.prepare("SELECT item_id FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id IN (?,?,?)").bind(k.id,...inputs).all();
    if((owned.results||[]).length!==3)return json({error:"Você não possui todas as skins selecionadas."},409);
    const fusion=await env.DB.batch([
      env.DB.prepare("UPDATE kingdom_cosmetic_wallet SET shards=shards-50 WHERE kingdom_id=? AND shards>=50 AND (SELECT COUNT(*) FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id IN (?,?,?))=3 AND NOT EXISTS(SELECT 1 FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=?)").bind(k.id,k.id,...inputs,k.id,output.id),
      env.DB.prepare("DELETE FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=? AND changes()>0").bind(k.id,inputs[0]),
      env.DB.prepare("DELETE FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=? AND changes()>0").bind(k.id,inputs[1]),
      env.DB.prepare("DELETE FROM kingdom_cosmetics WHERE kingdom_id=? AND item_id=? AND changes()>0").bind(k.id,inputs[2]),
      env.DB.prepare("INSERT INTO kingdom_cosmetics(kingdom_id,item_id,kind) SELECT ?,?,'fused' WHERE changes()>0").bind(k.id,output.id),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"skin_fused",JSON.stringify({inputs,output:output.id,shards:50}))
    ]);
    if(!fusion[0]?.meta?.changes)return json({error:"Fragmentos insuficientes, skins alteradas ou fusão já realizada."},409);
  }else if(type==="shop_buy"){

    const itemId=String(body.item||""),source=String(body.source||"shop"),item=Object.hasOwn(SHOP_ITEMS,itemId)?SHOP_ITEMS[itemId]:null;
    if(!item||!["shop","merchant"].includes(source))return json({error:"Produto ou origem inválidos."},400);
    let price=item.price,cycle=null,offer=null;
    if(source==="merchant"){
      cycle=merchantCycle();offer=merchantOffers(cycle).find(x=>x.id===itemId);
      if(!offer)return json({error:"Esta oferta não pertence à rotação atual."},409);
      price=offer.price;
      await env.DB.prepare("INSERT OR IGNORE INTO merchant_stock(kingdom_id,cycle_id,item_id,stock) VALUES(?,?,?,?)").bind(k.id,cycle,itemId,offer.stock).run();
      const stock=await env.DB.prepare("UPDATE merchant_stock SET stock=stock-1 WHERE kingdom_id=? AND cycle_id=? AND item_id=? AND stock>0").bind(k.id,cycle,itemId).run();
      if(!stock.meta.changes)return json({error:"Oferta esgotada. O mercador retorna na próxima rotação."},409);
    }else if(source!=="shop")return json({error:"Origem da compra inválida."},400);
    const debit=item.currency==="gems"
      ?await env.DB.prepare("UPDATE players SET gems=gems-? WHERE id=? AND gems>=?").bind(price,p.id,price).run()
      :await env.DB.prepare("UPDATE kingdoms SET gold=gold-? WHERE id=? AND gold>=?").bind(price,k.id,price).run();
    if(!debit.meta.changes){
      if(source==="merchant")await env.DB.prepare("UPDATE merchant_stock SET stock=stock+1 WHERE kingdom_id=? AND cycle_id=? AND item_id=?").bind(k.id,cycle,itemId).run();
      return json({error:item.currency==="gems"?"Diamantes insuficientes.":"Ouro insuficiente."},409);
    }
    const statements=[];
    for(const [key,amount] of Object.entries(item.gives)){
      if(["food","wood","stone","iron","gold"].includes(key))statements.push(env.DB.prepare("UPDATE kingdoms SET "+key+"="+key+"+? WHERE id=?").bind(amount,k.id));
      else statements.push(env.DB.prepare("INSERT INTO shop_inventory(kingdom_id,item_id,quantity) VALUES(?,?,?) ON CONFLICT(kingdom_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity").bind(k.id,key,amount));
    }
    statements.push(env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) VALUES(?,?,?)").bind(k.id,"shop_purchase",JSON.stringify({item:itemId,source,price,currency:item.currency})));
    await env.DB.batch(statements);

  }else if(type==="alliance_create"){
    const name=String(body.name||"").trim().slice(0,32);
    const tag=String(body.tag||name.replace(/[^a-z0-9]/gi,"").slice(0,4)).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5);
    if(name.length<3||tag.length<2)return json({error:"Informe nome com 3 caracteres e sigla com 2 a 5 letras."},400);
    const existing=await env.DB.prepare("SELECT alliance_id FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    if(existing)return json({error:"Seu reino já pertence a uma aliança."},409);
    try{
      const made=await env.DB.prepare("INSERT INTO alliances(name,tag,leader_kingdom_id,description) VALUES(?,?,?,'Aliança de Eldoria')").bind(name,tag,k.id).run();
      await env.DB.prepare("INSERT INTO alliance_members(alliance_id,kingdom_id,role) VALUES(?,?,'leader')").bind(made.meta.last_row_id,k.id).run();
      await env.DB.prepare("UPDATE alliance_members SET rank='lider' WHERE alliance_id=? AND kingdom_id=?").bind(made.meta.last_row_id,k.id).run();
    }catch(e){return json({error:"Nome ou sigla já estão em uso."},409)}
  }else if(type==="alliance_join"){
    const tag=String(body.tag||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5);
    if(!tag)return json({error:"Informe a sigla da aliança."},400);
    const existing=await env.DB.prepare("SELECT alliance_id FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    if(existing)return json({error:"Seu reino já pertence a uma aliança."},409);
    const alliance=await env.DB.prepare("SELECT id,max_members FROM alliances WHERE tag=?").bind(tag).first();
    if(!alliance)return json({error:"Aliança não encontrada."},404);
    const joined=await env.DB.prepare("INSERT INTO alliance_members(alliance_id,kingdom_id,role) SELECT ?,?,'member' WHERE (SELECT COUNT(*) FROM alliance_members WHERE alliance_id=?) < ?")
      .bind(alliance.id,k.id,alliance.id,alliance.max_members).run();
    if(!joined.meta.changes)return json({error:"A aliança atingiu o limite de membros."},409);
  }else if(type==="alliance_invite"){
    const member=await env.DB.prepare("SELECT alliance_id,rank FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    if(!member||!["lider","co_lider","oficial"].includes(member.rank))return json({error:"Seu cargo não permite convidar jogadores."},403);
    const targetName=String(body.targetName||"").trim().slice(0,32);
    const target=await env.DB.prepare("SELECT id FROM kingdoms WHERE kingdom_name=?").bind(targetName).first();
    if(!target)return json({error:"Reino não encontrado. Confira o nome exato."},404);
    if(target.id===k.id)return json({error:"Você já está nesta aliança."},409);
    const already=await env.DB.prepare("SELECT 1 FROM alliance_members WHERE kingdom_id=?").bind(target.id).first();
    if(already)return json({error:"Este reino já pertence a uma aliança."},409);
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM alliance_members WHERE alliance_id=?").bind(member.alliance_id).first();
    const cap=await env.DB.prepare("SELECT max_members FROM alliances WHERE id=?").bind(member.alliance_id).first();
    if(count.n>=cap.max_members)return json({error:"Aliança atingiu o limite de membros."},409);
    await env.DB.prepare("INSERT OR IGNORE INTO alliance_invites(alliance_id,target_kingdom_id,invited_by_kingdom_id) VALUES(?,?,?)").bind(member.alliance_id,target.id,k.id).run();
  }else if(type==="alliance_accept_invite"){
    const inviteId=Number(body.inviteId);
    const invite=await env.DB.prepare("SELECT i.alliance_id,a.max_members FROM alliance_invites i JOIN alliances a ON a.id=i.alliance_id WHERE i.id=? AND i.target_kingdom_id=?").bind(inviteId,k.id).first();
    if(!invite)return json({error:"Convite não encontrado."},404);
    const current=await env.DB.prepare("SELECT 1 FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    if(current)return json({error:"Seu reino já pertence a uma aliança."},409);
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM alliance_members WHERE alliance_id=?").bind(invite.alliance_id).first();
    if(count.n>=invite.max_members)return json({error:"A aliança está cheia."},409);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO alliance_members(alliance_id,kingdom_id,role,rank) VALUES(?,?,'member','membro')").bind(invite.alliance_id,k.id),
      env.DB.prepare("DELETE FROM alliance_invites WHERE id=?").bind(inviteId)
    ]);
  }else if(type==="alliance_promote"){
    const member=await env.DB.prepare("SELECT alliance_id,rank FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    const targetId=Number(body.targetKingdomId),newRank=String(body.rank||"");
    const ranks={membro:1,oficial:2,co_lider:3,lider:4};
    if(!member||!Object.hasOwn(ranks,newRank))return json({error:"Cargo ou aliança inválidos."},400);
    const target=await env.DB.prepare("SELECT rank FROM alliance_members WHERE alliance_id=? AND kingdom_id=?").bind(member.alliance_id,targetId).first();
    if(!target)return json({error:"Membro não encontrado."},404);
    if(member.rank!=="lider"&&!(member.rank==="co_lider"&&newRank==="oficial"&&target.rank==="membro"))return json({error:"Somente o líder pode atribuir esse cargo."},403);
    if(newRank==="lider")return json({error:"Transfira a liderança pelo painel de gestão."},400);
    if(ranks[newRank]>=ranks[member.rank]||ranks[target.rank]>=ranks[member.rank])return json({error:"Você não pode alterar um cargo igual ou superior ao seu."},403);
    await env.DB.prepare("UPDATE alliance_members SET rank=?,role=? WHERE alliance_id=? AND kingdom_id=?").bind(newRank,newRank==="lider"?"leader":newRank==="membro"?"member":"officer",member.alliance_id,targetId).run();
  }else if(type==="alliance_kick"){
    const member=await env.DB.prepare("SELECT alliance_id,rank FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    const targetId=Number(body.targetKingdomId);
    if(!member)return json({error:"Você não pertence a uma aliança."},409);
    const target=await env.DB.prepare("SELECT rank FROM alliance_members WHERE alliance_id=? AND kingdom_id=?").bind(member.alliance_id,targetId).first();
    if(!target)return json({error:"Membro não encontrado."},404);
    const ranks={membro:1,oficial:2,co_lider:3,lider:4};
    if(ranks[member.rank]<=ranks[target.rank]||member.rank==="oficial")return json({error:"Seu cargo não permite expulsar esse membro."},403);
    await env.DB.prepare("DELETE FROM alliance_members WHERE alliance_id=? AND kingdom_id=?").bind(member.alliance_id,targetId).run();
  }else if(type==="alliance_donate"){
    const member=await env.DB.prepare("SELECT alliance_id FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    const resource=String(body.resource||""),amount=Number(body.amount);
    const allowed={food:"shared_food",wood:"shared_wood",stone:"shared_stone",iron:"shared_iron",gold:"shared_gold"};
    if(!member||!Object.hasOwn(allowed,resource)||!Number.isSafeInteger(amount)||amount<100||amount>1000000)return json({error:"Doação inválida. Mínimo de 100 recursos."},400);
    const debit=await env.DB.prepare("UPDATE kingdoms SET "+resource+"="+resource+"-? WHERE id=? AND "+resource+">=?").bind(amount,k.id,amount).run();
    if(!debit.meta.changes)return json({error:"Recursos insuficientes."},409);
    const xp=Math.floor(amount/100);
    await env.DB.batch([
      env.DB.prepare("UPDATE alliances SET "+allowed[resource]+"="+allowed[resource]+"+?,xp=xp+? WHERE id=?").bind(amount,xp,member.alliance_id),
      env.DB.prepare("UPDATE alliance_members SET contribution=contribution+? WHERE alliance_id=? AND kingdom_id=?").bind(xp,member.alliance_id,k.id),
      env.DB.prepare("INSERT INTO resource_ledger(kingdom_id,resource,amount,reason) VALUES(?,?,?,?)").bind(k.id,resource,-amount,"doação para aliança")
    ]);
    let a=await env.DB.prepare("SELECT level,xp,max_members FROM alliances WHERE id=?").bind(member.alliance_id).first();
    while(a.xp>=a.level*1000){
      const need=a.level*1000;
      await env.DB.prepare("UPDATE alliances SET xp=xp-?,level=level+1,max_members=max_members+10 WHERE id=? AND level=?").bind(need,member.alliance_id,a.level).run();
      a=await env.DB.prepare("SELECT level,xp,max_members FROM alliances WHERE id=?").bind(member.alliance_id).first();
    }
  }else if(type==="alliance_help"){
    const member=await env.DB.prepare("SELECT alliance_id,help_count,help_reset_at FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    const targetId=Number(body.targetKingdomId);
    const target=await env.DB.prepare("SELECT kingdom_name FROM alliance_members am JOIN kingdoms k ON k.id=am.kingdom_id WHERE am.alliance_id=? AND am.kingdom_id=?").bind(member?.alliance_id,targetId).first();
    if(!member||!target)return json({error:"Membro não encontrado nesta aliança."},404);
    const today=new Date().toISOString().slice(0,10),used=member.help_reset_at===today?member.help_count:0;
    const alliance=await env.DB.prepare("SELECT level FROM alliances WHERE id=?").bind(member.alliance_id).first();
    if(used>=5+alliance.level*2)return json({error:"Você atingiu o limite diário de ajudas."},409);
    await env.DB.prepare("UPDATE alliance_members SET help_count=?,help_reset_at=? WHERE alliance_id=? AND kingdom_id=?").bind(used+1,today,member.alliance_id,k.id).run();
    await env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) VALUES(?,?,?)").bind(targetId,"alliance_help",JSON.stringify({from:k.id,fromName:k.kingdom_name||"Aliado"})).run();
  }else if(type==="alliance_chat"){
    const member=await env.DB.prepare("SELECT alliance_id FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    const message=String(body.message||"").trim().slice(0,300);
    if(!member)return json({error:"Você não pertence a uma aliança."},409);
    if(!message)return json({error:"Digite uma mensagem."},400);
    await env.DB.prepare("INSERT INTO alliance_chat(alliance_id,kingdom_id,message) VALUES(?,?,?)").bind(member.alliance_id,k.id,message).run();
    await env.DB.prepare("DELETE FROM alliance_chat WHERE alliance_id=? AND id NOT IN (SELECT id FROM alliance_chat WHERE alliance_id=? ORDER BY id DESC LIMIT 50)").bind(member.alliance_id,member.alliance_id).run();
  }else if(type==="alliance_war_declare"){
    const member=await env.DB.prepare("SELECT alliance_id,rank FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    const targetTag=String(body.targetTag||"").trim().toUpperCase();
    if(!member||!["lider","co_lider","oficial"].includes(member.rank))return json({error:"Seu cargo não pode declarar guerra."},403);
    const enemy=await env.DB.prepare("SELECT id FROM alliances WHERE tag=?").bind(targetTag).first();
    if(!enemy||enemy.id===member.alliance_id)return json({error:"Aliança adversária inválida."},404);
    const active=await env.DB.prepare("SELECT id FROM alliance_wars WHERE status='active' AND ends_at>? AND ((alliance_a_id=? AND alliance_b_id=?) OR (alliance_a_id=? AND alliance_b_id=?))").bind(new Date().toISOString(),member.alliance_id,enemy.id,enemy.id,member.alliance_id).first();
    if(active)return json({error:"Já existe uma guerra ativa entre essas alianças."},409);
    const start=new Date(),end=new Date(start.getTime()+24*60*60*1000);
    await env.DB.prepare("INSERT INTO alliance_wars(alliance_a_id,alliance_b_id,starts_at,ends_at) VALUES(?,?,?,?)").bind(member.alliance_id,enemy.id,start.toISOString(),end.toISOString()).run();
  }else if(type==="alliance_claim_territory"){
    const member=await env.DB.prepare("SELECT alliance_id,rank FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    const territoryId=Number(body.territoryId);
    if(!member||!["lider","co_lider","oficial"].includes(member.rank))return json({error:"Seu cargo não pode reivindicar território."},403);
    const t=await env.DB.prepare("SELECT id,alliance_id,owner_kingdom_id FROM world_territories WHERE id=?").bind(territoryId).first();
    if(!t)return json({error:"Território não encontrado."},404);
    if(t.alliance_id&&t.alliance_id!==member.alliance_id)return json({error:"Território controlado por outra aliança."},409);
    const cost=await env.DB.prepare("UPDATE alliances SET shared_food=shared_food-1000,shared_wood=shared_wood-1000 WHERE id=? AND shared_food>=1000 AND shared_wood>=1000").bind(member.alliance_id).run();
    if(!cost.meta.changes)return json({error:"A aliança precisa de 1.000 comida e 1.000 madeira no depósito."},409);
    if(!t.alliance_id){
      await env.DB.prepare("UPDATE world_territories SET alliance_id=? WHERE id=? AND alliance_id IS NULL").bind(member.alliance_id,territoryId).run();
      await env.DB.prepare("UPDATE alliances SET territory_count=territory_count+1 WHERE id=?").bind(member.alliance_id).run();
    }
  }else if(type==="alliance_leave"){
    const membership=await env.DB.prepare("SELECT alliance_id,role FROM alliance_members WHERE kingdom_id=?").bind(k.id).first();
    if(!membership)return json({error:"Seu reino não pertence a uma aliança."},409);
    if(membership.role==="leader"){
      const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM alliance_members WHERE alliance_id=?").bind(membership.alliance_id).first();
      if(count.total>1)return json({error:"O líder deve transferir a liderança antes de sair."},409);
      await env.DB.prepare("DELETE FROM alliances WHERE id=?").bind(membership.alliance_id).run();
    }else await env.DB.prepare("DELETE FROM alliance_members WHERE kingdom_id=?").bind(k.id).run();
  }else if(type==="dragon_upgrade"){
    const dragon=await env.DB.prepare("SELECT level,experience,bond FROM dragons WHERE kingdom_id=?").bind(k.id).first();
    if(!dragon)return json({error:"Dragão não encontrado."},404);
    if(dragon.level>=100)return json({error:"Dragão já atingiu o nível máximo."},409);
    const level=dragon.level,cost={food:250*level,wood:150*level,stone:100*level,iron:25*level};
    const debit=await env.DB.prepare("UPDATE kingdoms SET food=food-?,wood=wood-?,stone=stone-?,iron=iron-? WHERE id=? AND food>=? AND wood>=? AND stone>=? AND iron>=?").bind(cost.food,cost.wood,cost.stone,cost.iron,k.id,cost.food,cost.wood,cost.stone,cost.iron).run();
    if(!debit.meta.changes)return json({error:"Recursos insuficientes para evoluir o dragão."},409);
    await env.DB.prepare("UPDATE dragons SET level=level+1,experience=experience+100,bond=MIN(100,bond+2) WHERE kingdom_id=?").bind(k.id).run();
    await env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) VALUES(?,?,?)").bind(k.id,"dragon_evolved",JSON.stringify({level:level+1,cost})).run();
  }else if(type==="hero_summon"){
    const quantity=Number(body.quantity)===10?10:1,cost=quantity===10?900:100;
    const ownedRows=await env.DB.prepare("SELECT hero_key FROM hero_inventory WHERE kingdom_id=?").bind(k.id).all();
    const owned=new Set((ownedRows.results||[]).map(row=>row.hero_key));
    const results=[],statements=[],actionId=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?)";
    statements.push(env.DB.prepare("UPDATE players SET gems=gems-? WHERE id=? AND gems>=?").bind(cost,p.id,cost));
    statements.push(env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"__internal_action_guard",actionId));
    for(let i=0;i<quantity;i++){
      const rarity=rollHeroRarity(),pool=Object.entries(HERO_TEMPLATES).filter(([,hero])=>hero.rarity===rarity);
      if(!pool.length)throw new Error("Nenhum herói disponível para a raridade sorteada.");
      const pick=Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]/4294967296*pool.length),heroKey=pool[pick][0];
      const duplicate=owned.has(heroKey),fragmentGain=HERO_RARITY[rarity].fragments;
      if(duplicate){
        statements.push(env.DB.prepare("UPDATE hero_inventory SET fragments=fragments+? WHERE kingdom_id=? AND hero_key=? AND "+guard).bind(fragmentGain,k.id,heroKey,k.id,actionId));
      }else{
        statements.push(env.DB.prepare("INSERT INTO hero_inventory(kingdom_id,hero_key,rarity,level,experience,stars,skill_level,fragments) SELECT ?,?,?,1,0,1,1,0 WHERE "+guard+" ON CONFLICT(kingdom_id,hero_key) DO UPDATE SET fragments=hero_inventory.fragments+?").bind(k.id,heroKey,rarity,k.id,actionId,fragmentGain));
        owned.add(heroKey);
      }
      const tableRarity=rarity==="white"?"common":rarity==="blue"?"rare":"legendary";
      statements.push(env.DB.prepare("INSERT INTO heroes(kingdom_id,hero_key,hero_name,level,experience,rarity) SELECT ?,?,?,1,0,? WHERE "+guard+" ON CONFLICT(kingdom_id,hero_key) DO UPDATE SET rarity=excluded.rarity,hero_name=CASE WHEN heroes.hero_name IS NULL OR heroes.hero_name='' THEN excluded.hero_name ELSE heroes.hero_name END").bind(k.id,heroKey,HERO_TEMPLATES[heroKey].name,tableRarity,k.id,actionId));
      statements.push(env.DB.prepare("INSERT INTO hero_summon_history(kingdom_id,hero_key,rarity,result_type) SELECT ?,?,?,? WHERE "+guard).bind(k.id,heroKey,rarity,duplicate?"duplicate":"new",k.id,actionId));
      results.push({hero_key:heroKey,name:HERO_TEMPLATES[heroKey].name,rarity,result_type:duplicate?"duplicate":"new",fragments:duplicate?fragmentGain:0});
    }
    statements.push(env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE "+guard).bind(k.id,"hero_summoned",JSON.stringify({quantity,cost,summons:results}),k.id,actionId));
    statements.push(env.DB.prepare("DELETE FROM hero_summon_history WHERE kingdom_id=? AND id NOT IN (SELECT id FROM hero_summon_history WHERE kingdom_id=? ORDER BY id DESC LIMIT 100) AND "+guard).bind(k.id,k.id,k.id,actionId));
    statements.push(env.DB.prepare("DELETE FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?").bind(k.id,actionId));
    const batch=await env.DB.batch(statements);
    if(!batch[0]?.meta?.changes)return json({error:"Gemas insuficientes para invocar."},409);
    battleOutcome={summons:results,cost};
  }else if(type==="hero_evolve"){
    const heroKey=String(body.hero||""),hero=await env.DB.prepare("SELECT rarity,stars,fragments FROM hero_inventory WHERE kingdom_id=? AND hero_key=?").bind(k.id,heroKey).first();
    if(!hero||(!HERO_TEMPLATES[heroKey]&&heroKey!=="kael_sunwarden"))return json({error:"Herói não encontrado na coleção."},404);
    const rarity=HERO_RARITY[hero.rarity],next=hero.stars+1,needed=HERO_STAR_COST[next];
    if(hero.stars>=rarity.maxStars||!needed)return json({error:"Herói já atingiu o máximo de estrelas."},409);
    if(hero.fragments<needed)return json({error:"Fragmentos insuficientes. Necessário: "+needed+"."},409);
    await env.DB.prepare("UPDATE hero_inventory SET stars=stars+1,fragments=fragments-? WHERE kingdom_id=? AND hero_key=? AND fragments>=?").bind(needed,k.id,heroKey,needed).run();
  }else if(type==="hero_train"){
    const key=String(body.hero||"kael_sunwarden");
    const [hero,inventoryHero]=await Promise.all([
      env.DB.prepare("SELECT id,level,experience FROM heroes WHERE kingdom_id=? AND hero_key=?").bind(k.id,key).first(),
      env.DB.prepare("SELECT level,experience,rarity FROM hero_inventory WHERE kingdom_id=? AND hero_key=?").bind(k.id,key).first()
    ]);
    if(!hero||!inventoryHero)return json({error:"Herói não encontrado na coleção."},404);
    const maxLevel=HERO_RARITY[inventoryHero.rarity]?.maxLevel||100,level=Math.max(Number(hero.level)||1,Number(inventoryHero.level)||1);
    if(level>=maxLevel)return json({error:"Herói já atingiu o nível máximo da raridade."},409);
    const cost={food:200*level,wood:100*level,gold:75*level},actionId=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?)";
    const result=await env.DB.batch([
      env.DB.prepare("UPDATE kingdoms SET food=food-?,wood=wood-?,gold=gold-? WHERE id=? AND food>=? AND wood>=? AND gold>=? AND EXISTS(SELECT 1 FROM heroes WHERE id=? AND level=?) AND EXISTS(SELECT 1 FROM hero_inventory WHERE kingdom_id=? AND hero_key=? AND level=?)").bind(cost.food,cost.wood,cost.gold,k.id,cost.food,cost.wood,cost.gold,hero.id,level,k.id,key,level),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"__internal_action_guard",actionId),
      env.DB.prepare("UPDATE hero_inventory SET level=level+1,experience=experience+100 WHERE kingdom_id=? AND hero_key=? AND level=? AND "+guard).bind(k.id,key,level,k.id,actionId),
      env.DB.prepare("UPDATE heroes SET level=level+1,experience=experience+100 WHERE id=? AND level=? AND "+guard+" AND changes()>0").bind(hero.id,level,k.id,actionId),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE "+guard+" AND changes()>0").bind(k.id,"hero_trained",JSON.stringify({hero:key,level:level+1,cost}),k.id,actionId),
      env.DB.prepare("DELETE FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?").bind(k.id,actionId)
    ]);
    if(!result[0]?.meta?.changes)return json({error:"Recursos insuficientes ou herói alterado por outra ação."},409);
    if(!result[2]?.meta?.changes||!result[3]?.meta?.changes)return json({error:"Não foi possível sincronizar o treinamento do herói."},409);
  }else if(type==="prestige"){
    const current=Number(k.prestige||0),castle=await env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type='castle'").bind(k.id).first();
    if(!castle||Number(castle.level)<30||Number(k.castle_level)<30)return json({error:"Seu castelo precisa atingir o nível 30."},409);
    if(current>=7)return json({error:"Prestígio máximo atingido."},409);
    const costs=[1000,2500,5000,10000,20000,40000,80000],cost=costs[current];
    const debit=await env.DB.prepare("UPDATE players SET gems=gems-? WHERE id=? AND gems>=?").bind(cost,p.id,cost).run();
    if(!debit.meta.changes)return json({error:"Gemas insuficientes para prestigiar."},409);
    await env.DB.batch([
      env.DB.prepare("UPDATE kingdoms SET prestige=prestige+1,castle_level=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(k.id),
      env.DB.prepare("UPDATE kingdom_buildings SET level=1,upgraded_at=CURRENT_TIMESTAMP WHERE kingdom_id=? AND building_type='castle'").bind(k.id),
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) VALUES(?,?,?)").bind(k.id,"castle_prestige",JSON.stringify({prestige:current+1,cost,resourceBonus:(current+1)*10}))
    ]);
  }else if(type==="upgrade"){
    const key=String(body.building||"");
    if(!Object.hasOwn(BUILDINGS,key))return json({error:"Edifício inválido."},400);
    const b=await env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type=?").bind(k.id,key).first();
    if(!b)return json({error:"Edifício não encontrado."},404);
    if(b.level>=30)return json({error:"Edifício já está no nível máximo."},409);
    if(key!=="castle"){
      const castle=await env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type='castle'").bind(k.id).first();
      if(!castle||b.level>=castle.level)return json({error:"O nível do edifício não pode superar o castelo."},409);
    }
    const sameBuildingQueue=await env.DB.prepare("SELECT id FROM kingdom_queues WHERE kingdom_id=? AND queue_type='construction' AND target_key=? AND status='running'").bind(k.id,key).first();
    if(sameBuildingQueue)return json({error:"Este edifício já está em uma fila de melhoria."},409);
    const runningBuilds=await env.DB.prepare("SELECT queue_slot FROM kingdom_queues WHERE kingdom_id=? AND queue_type='construction' AND status='running'").bind(k.id).all();
    const occupiedBuildSlots=new Set((runningBuilds.results||[]).map(row=>Number(row.queue_slot)||1));
    const queueSlot=!occupiedBuildSlots.has(1)?1:!occupiedBuildSlots.has(2)?2:0;
    if(!queueSlot)return json({error:"As duas filas de construção estão ocupadas."},409);
    const factor=b.level;
    const base=BUILDINGS[key];
    const materialNeeds=key==="castle"?(b.level>=25?{imperial_crest:2,power_crystal:2}:b.level>=20?{imperial_crest:1,power_crystal:2}:b.level>=15?{power_crystal:2,imperial_seal:1}:b.level>=10?{imperial_seal:2,royal_blueprint:1}:b.level>=5?{royal_blueprint:2}:{}):{};
    for(const [item,quantity] of Object.entries(materialNeeds)){const owned=await env.DB.prepare("SELECT quantity FROM inventory_items WHERE kingdom_id=? AND item_key=?").bind(k.id,item).first();if(!owned||owned.quantity<quantity)return json({error:"Materiais insuficientes: "+CASTLE_MATERIALS[item].name+" ("+quantity+" necessários)."},409);}
    const cost={wood:Math.ceil(base.wood*factor),stone:Math.ceil(base.stone*factor),food:Math.ceil(base.food*factor),iron:Math.ceil(base.iron*factor)};
    const castle=await env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type='castle'").bind(k.id).first();
    if(!castle)return json({error:"Castelo não encontrado."},409);
    const constructionResearch=await env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='construction'").bind(k.id).first();
    const valhallaMultipliers=await getValhallaMultipliers(env);
    const durationSeconds=await scaleKingdomQueueDurationSeconds(env,k.id,calculateQueueDurationSeconds("construction",{level:b.level,facilityLevel:Number(castle.level||1),researchLevel:Number(constructionResearch?.level||0)}),"construction",valhallaMultipliers);
    const startedAt=new Date().toISOString(),completesAt=new Date(Date.now()+durationSeconds*1000).toISOString();
    const actionId=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?)";
    const materialChecks=Object.entries(materialNeeds).map(()=> " AND EXISTS(SELECT 1 FROM inventory_items WHERE kingdom_id=? AND item_key=? AND quantity>=?)").join("");
    const materialBindings=Object.entries(materialNeeds).flatMap(([item,quantity])=>[k.id,item,quantity]);
    const debit=env.DB.prepare("UPDATE kingdoms SET wood=wood-?,stone=stone-?,food=food-?,iron=iron-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND wood>=? AND stone>=? AND food>=? AND iron>=? AND EXISTS(SELECT 1 FROM kingdom_buildings WHERE kingdom_id=? AND building_type=? AND level=?) AND (?='castle' OR EXISTS(SELECT 1 FROM kingdom_buildings WHERE kingdom_id=? AND building_type='castle' AND level>?))"+materialChecks+" AND NOT EXISTS(SELECT 1 FROM kingdom_queues WHERE kingdom_id=? AND queue_type='construction' AND target_key=? AND status='running') AND NOT EXISTS(SELECT 1 FROM kingdom_queues WHERE kingdom_id=? AND queue_type='construction' AND queue_slot=? AND status='running')")
      .bind(cost.wood,cost.stone,cost.food,cost.iron,k.id,cost.wood,cost.stone,cost.food,cost.iron,k.id,key,b.level,key,k.id,b.level,...materialBindings,k.id,key,k.id,queueSlot);
    const statements=[debit,
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"__internal_action_guard",actionId)
    ];
    for(const [item,quantity] of Object.entries(materialNeeds)){
      statements.push(env.DB.prepare("UPDATE inventory_items SET quantity=quantity-? WHERE kingdom_id=? AND item_key=? AND "+guard).bind(quantity,k.id,item,k.id,actionId));
    }
    statements.push(env.DB.prepare("INSERT INTO kingdom_queues(kingdom_id,queue_type,queue_slot,target_key,quantity,from_level,to_level,reward_item,status,started_at,completes_at) SELECT ?,?,?,?,?,?,?,?,'running',?,? WHERE "+guard)
      .bind(k.id,"construction",queueSlot,key,1,b.level,b.level+1,"imperial_seal",startedAt,completesAt,k.id,actionId));
    statements.push(env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE "+guard)
      .bind(k.id,"construction_started",JSON.stringify({building:key,queueSlot,level:b.level+1,cost,durationSeconds,completesAt}),k.id,actionId));
    statements.push(env.DB.prepare("INSERT INTO action_logs(kingdom_id,player_id,action_type,details_json) SELECT ?,?,?,? WHERE "+guard)
      .bind(k.id,p.id,"construction_started",JSON.stringify({building:key,queueSlot,level:b.level+1,cost,durationSeconds}),k.id,actionId));
    statements.push(env.DB.prepare("DELETE FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?").bind(k.id,actionId));
    const result=await env.DB.batch(statements);
    if(!result[1]?.meta?.changes)return json({error:"Recursos ou materiais insuficientes, ou fila de construção ocupada. Atualize e tente novamente."},409);
  }else if(type==="train"){
    const unit=String(body.unit||"militia"),quantity=Math.max(1,Math.min(100,Math.floor(Number(body.quantity)||10)));
    const spec=Object.hasOwn(UNITS,unit)?UNITS[unit]:null;if(!spec)return json({error:"Tipo de tropa inválido."},400);
    const requiredBuilding={militia:"barracks",swordsman:"barracks",spearman:"barracks",archer:"archery_range",crossbowman:"archery_range",cavalry:"stable",knight:"stable",mage:"academy",catapult:"siege_workshop",ram:"siege_workshop",trebuchet:"siege_workshop"}[unit];
    const trainingHall=await env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type=?").bind(k.id,requiredBuilding).first();
    if(!trainingHall||trainingHall.level<1)return json({error:"Construa o edifício de treinamento exigido."},409);
    const barracks=await env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type='barracks'").bind(k.id).first();
    if(!barracks)return json({error:"Construa o quartel antes de treinar tropas."},409);
    const troopCapacity=Math.max(1,Number(barracks.level)||1)*TROOP_CAPACITY_PER_BARRACKS_LEVEL;
    const [ownedArmy,fieldArmy,pendingArmy]=await Promise.all([
      env.DB.prepare("SELECT COALESCE(SUM(quantity),0) AS total FROM army_units WHERE kingdom_id=?").bind(k.id).first(),
      env.DB.prepare("SELECT COALESCE(SUM(CAST(j.value AS INTEGER)),0) AS total FROM marches m,json_each(m.units_json) j WHERE m.kingdom_id=? AND m.status='marching'").bind(k.id).first(),
      env.DB.prepare("SELECT COALESCE(SUM(quantity),0) AS total FROM kingdom_queues WHERE kingdom_id=? AND queue_type='training' AND status='running'").bind(k.id).first()
    ]);
    const usedCapacity=Number(ownedArmy?.total||0)+Number(fieldArmy?.total||0)+Number(pendingArmy?.total||0);
    if(usedCapacity+quantity>troopCapacity)return json({error:"Capacidade do exército excedida. Quartel nível "+barracks.level+" permite "+troopCapacity+" tropas; já ocupadas: "+usedCapacity+".",capacity:troopCapacity,used:usedCapacity,available:Math.max(0,troopCapacity-usedCapacity)},409);
    const activeTraining=await env.DB.prepare("SELECT queue_slot FROM kingdom_queues WHERE kingdom_id=? AND queue_type='training' AND status='running'").bind(k.id).all();
    const occupiedTrainingSlots=new Set((activeTraining.results||[]).map(row=>Number(row.queue_slot)||1));
    const queueSlot=!occupiedTrainingSlots.has(1)?1:!occupiedTrainingSlots.has(2)?2:0;
    if(!queueSlot)return json({error:"As duas filas de treinamento estão ocupadas. Aguarde uma delas terminar."},409);
    const cost={food:spec.food*quantity,wood:spec.wood*quantity,iron:spec.iron*quantity};
    const valhallaMultipliers=await getValhallaMultipliers(env);
    const durationSeconds=await scaleKingdomQueueDurationSeconds(env,k.id,calculateQueueDurationSeconds("training",{targetKey:unit,quantity,facilityLevel:Number(trainingHall.level||1)}),"training",valhallaMultipliers);
    const startedAt=new Date().toISOString(),completesAt=new Date(Date.now()+durationSeconds*1000).toISOString();
    const actionId=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?)";
    const debit=env.DB.prepare("UPDATE kingdoms SET food=food-?,wood=wood-?,iron=iron-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND food>=? AND wood>=? AND iron>=? AND EXISTS(SELECT 1 FROM kingdom_buildings WHERE kingdom_id=? AND building_type=? AND level>=1) AND NOT EXISTS(SELECT 1 FROM kingdom_queues WHERE kingdom_id=? AND queue_type='training' AND queue_slot=? AND status='running')"+
      " AND ((SELECT COALESCE(SUM(quantity),0) FROM army_units WHERE kingdom_id=?)"+
      "+(SELECT COALESCE(SUM(CAST(j.value AS INTEGER)),0) FROM marches m,json_each(m.units_json) j WHERE m.kingdom_id=? AND m.status='marching')"+
      "+(SELECT COALESCE(SUM(quantity),0) FROM kingdom_queues WHERE kingdom_id=? AND queue_type='training' AND status='running')+?)<= "+
      "(SELECT level*? FROM kingdom_buildings WHERE kingdom_id=? AND building_type='barracks')")
      .bind(cost.food,cost.wood,cost.iron,k.id,cost.food,cost.wood,cost.iron,k.id,requiredBuilding,k.id,queueSlot,k.id,k.id,k.id,quantity,TROOP_CAPACITY_PER_BARRACKS_LEVEL,k.id);
    const statements=[debit,env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"__internal_action_guard",actionId)];
    statements.push(env.DB.prepare("INSERT INTO kingdom_queues(kingdom_id,queue_type,queue_slot,target_key,quantity,from_level,to_level,reward_item,status,started_at,completes_at) SELECT ?,?,?,?,?,?,?,?,'running',?,? WHERE "+guard)
      .bind(k.id,"training",queueSlot,unit,quantity,0,0,"royal_blueprint",startedAt,completesAt,k.id,actionId));
    statements.push(env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE "+guard)
      .bind(k.id,"troop_training_started",JSON.stringify({unit,quantity,queueSlot,cost,durationSeconds,completesAt}),k.id,actionId));
    statements.push(env.DB.prepare("INSERT INTO action_logs(kingdom_id,player_id,action_type,details_json) SELECT ?,?,?,? WHERE "+guard)
      .bind(k.id,p.id,"training_started",JSON.stringify({unit,quantity,queueSlot,cost,durationSeconds}),k.id,actionId));
    statements.push(env.DB.prepare("DELETE FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?").bind(k.id,actionId));
    const result=await env.DB.batch(statements);
    if(!result[1]?.meta?.changes)return json({error:"Recursos insuficientes ou fila de treinamento ocupada. Atualize e tente novamente."},409);
  }else if(type==="research"){
    const key=String(body.research||"economy");
    const allowed={economy:{wood:250,stone:120,iron:0},military:{wood:300,stone:180,iron:40},construction:{wood:350,stone:250,iron:0},defense:{wood:220,stone:300,iron:25},gear_forging:{wood:500,stone:300,iron:60},gear_ward:{wood:450,stone:400,iron:70},gear_vitality:{wood:500,stone:350,iron:60},gear_logistics:{wood:600,stone:350,iron:100}};
    if(!Object.hasOwn(allowed,key))return json({error:"Pesquisa inválida."},400);
    const current=await env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key=?").bind(k.id,key).first();
    const level=current?.level||0,maxLevel=key.startsWith("gear_")?(EQUIPMENT_RESEARCH[key]?.maxLevel||10):30;
    if(level>=maxLevel)return json({error:"Pesquisa no nível máximo."},409);
    const center=await env.DB.prepare("SELECT level FROM kingdom_buildings WHERE kingdom_id=? AND building_type='academy'").bind(k.id).first();
    const centerLevel=Number(center?.level||0);
    if((key==="defense"||key.startsWith("gear_"))&&centerLevel<1)return json({error:"Construa o Centro de Pesquisa Militar primeiro."},409);
    if((key==="defense"||key.startsWith("gear_"))&&level>=Math.min(maxLevel,centerLevel*3))return json({error:"Melhore o Centro de Pesquisa Militar para desbloquear mais níveis desta ciência."},409);
    const activeQueue=await env.DB.prepare("SELECT id FROM kingdom_queues WHERE kingdom_id=? AND queue_type='research' AND status='running'").bind(k.id).first();
    if(activeQueue)return json({error:"Sua fila de pesquisa já está ocupada. Aguarde a tecnologia atual."},409);
    const c=allowed[key],factor=level+1,cost={wood:c.wood*factor,stone:c.stone*factor,iron:c.iron*factor};
    const valhallaMultipliers=await getValhallaMultipliers(env);
    const durationSeconds=await scaleKingdomQueueDurationSeconds(env,k.id,calculateQueueDurationSeconds("research",{level:level+1,facilityLevel:Math.max(1,centerLevel)}),"research",valhallaMultipliers);
    const startedAt=new Date().toISOString(),completesAt=new Date(Date.now()+durationSeconds*1000).toISOString();
    const actionId=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?)";
    const debit=env.DB.prepare("UPDATE kingdoms SET wood=wood-?,stone=stone-?,iron=iron-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND wood>=? AND stone>=? AND iron>=? AND COALESCE((SELECT level FROM research WHERE kingdom_id=? AND research_key=?),0)=? AND (? NOT IN ('defense','gear_forging','gear_ward','gear_vitality','gear_logistics') OR EXISTS(SELECT 1 FROM kingdom_buildings WHERE kingdom_id=? AND building_type='academy' AND level>=?)) AND NOT EXISTS(SELECT 1 FROM kingdom_queues WHERE kingdom_id=? AND queue_type='research' AND status='running')")
      .bind(cost.wood,cost.stone,cost.iron,k.id,cost.wood,cost.stone,cost.iron,k.id,key,level,key,k.id,Math.ceil((level+1)/3),k.id);
    const statements=[debit,env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()>0").bind(k.id,"__internal_action_guard",actionId)];
    statements.push(env.DB.prepare("INSERT INTO kingdom_queues(kingdom_id,queue_type,target_key,quantity,from_level,to_level,reward_item,status,started_at,completes_at) SELECT ?,?,?,?,?,?,?,'running',?,? WHERE "+guard)
      .bind(k.id,"research",key,1,level,level+1,"imperial_crest",startedAt,completesAt,k.id,actionId));
    statements.push(env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE "+guard)
      .bind(k.id,"research_started",JSON.stringify({research:key,level:level+1,cost,durationSeconds,completesAt}),k.id,actionId));
    statements.push(env.DB.prepare("DELETE FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?").bind(k.id,actionId));
    const result=await env.DB.batch(statements);
    if(!result[1]?.meta?.changes)return json({error:"Recursos insuficientes, pesquisa alterada ou fila de pesquisa ocupada. Atualize e tente novamente."},409);
  }else if(type==="march"){
    const targetId=Number(body.targetId);
    if(!Number.isSafeInteger(targetId)||targetId<1)return json({error:"Território inválido."},400);
    const target=await env.DB.prepare("SELECT id,resource_type,owner_kingdom_id,territory_kind FROM world_territories WHERE id=?").bind(targetId).first();
    if(!target)return json({error:"Território não encontrado."},404);
    const marchType=String(body.marchType||"gather");
    if(!["gather","scout","attack"].includes(marchType))return json({error:"Tipo de marcha inválido."},400);
    if(marchType==="attack"){
      if(target.territory_kind==="castle"){
        const defenderId=Number(target.owner_kingdom_id||0);
        if(!defenderId||defenderId===Number(k.id))return json({error:"Escolha um castelo inimigo válido."},409);
        if(Date.parse(String(k.protection_until||""))>Date.now())return json({error:"Seu escudo de proteção impede iniciar ataques."},403);
        const defender=await env.DB.prepare("SELECT id,protection_until FROM kingdoms WHERE id=?").bind(defenderId).first();
        if(!defender)return json({error:"Reino defensor não encontrado."},404);
        if(Date.parse(String(defender.protection_until||""))>Date.now())return json({error:"Este castelo está protegido por escudo."},409);
        const allied=await env.DB.prepare("SELECT 1 AS allied FROM alliance_members a JOIN alliance_members b ON b.alliance_id=a.alliance_id WHERE a.kingdom_id=? AND b.kingdom_id=? LIMIT 1").bind(k.id,defenderId).first();
        if(allied)return json({error:"Ataques contra membros da sua aliança são bloqueados."},403);
      }else if(target.owner_kingdom_id){
        return json({error:"Ataques a territórios de outro reino exigem selecionar o castelo do comandante."},409);
      }
    }else{
      if(target.territory_kind==="castle")return json({error:"Castelos de jogadores só aceitam ordens de ataque."},409);
      if(target.owner_kingdom_id&&Number(target.owner_kingdom_id)!==Number(k.id))return json({error:"Este território pertence a outro reino."},409);
    }
    const requested=body.units&&typeof body.units==="object"&&!Array.isArray(body.units)?body.units:{militia:5};
    const selected={};
    for(const [unit,raw] of Object.entries(requested)){
      if(!Object.hasOwn(UNITS,unit))continue;
      const qty=Math.max(0,Math.min(10000,Math.floor(Number(raw)||0)));
      if(qty>0)selected[unit]=qty;
    }
    const unitTypes=Object.keys(selected);
    if(!unitTypes.length)return json({error:"Selecione pelo menos uma tropa válida."},400);
    const unitsJson=JSON.stringify(selected);
    const baseSeconds=marchType==="scout"?15:marchType==="attack"?120:60;
    await ensureEquipmentTables(env,k.id);
    const activeHero=await env.DB.prepare("SELECT h.id FROM heroes h JOIN hero_inventory hi ON hi.kingdom_id=h.kingdom_id AND hi.hero_key=h.hero_key WHERE h.kingdom_id=? ORDER BY hi.level DESC,hi.stars DESC,h.id LIMIT 1").bind(k.id).first();
    const [equippedRows,gearResearchRows]=await Promise.all([
      activeHero?env.DB.prepare("SELECT ke.item_key,ke.level,ke.is_locked FROM kingdom_equipment ke JOIN hero_equipment he ON he.item_key=ke.item_key WHERE ke.kingdom_id=? AND he.hero_id=?").bind(k.id,activeHero.id).all():Promise.resolve({results:[]}),
      env.DB.prepare("SELECT research_key,level FROM research WHERE kingdom_id=? AND research_key IN ('gear_forging','gear_ward','gear_vitality','gear_logistics')").bind(k.id).all()
    ]);
    const equipmentMarchBonus=equipmentBonuses(equippedRows.results||[],gearResearchRows.results||[]).marchSpeedPercent;
    const petBonuses=await getPetBonuses(env,k.id);
    const marchBonus=equipmentMarchBonus+petBonuses.marchSpeedPercent;
    const seconds=calculateMarchDuration(baseSeconds,marchBonus);
    const arrival=new Date(Date.now()+seconds*1000).toISOString();
    // Debita todas as tropas em uma única atualização condicional. A marcha só é criada
    // se todas as quantidades estiverem disponíveis; D1 confirma ou reverte o lote inteiro.
    const debit=env.DB.prepare("UPDATE army_units SET quantity=quantity-CAST((SELECT value FROM json_each(?) WHERE key=army_units.unit_type) AS INTEGER) WHERE kingdom_id=? AND tier=1 AND unit_type IN (SELECT key FROM json_each(?)) AND (SELECT COUNT(*) FROM json_each(?) AS requested JOIN army_units AS available ON available.kingdom_id=? AND available.tier=1 AND available.unit_type=requested.key WHERE available.quantity>=CAST(requested.value AS INTEGER))=?")
      .bind(unitsJson,k.id,unitsJson,unitsJson,k.id,unitTypes.length);
    const createMarch=env.DB.prepare("INSERT INTO marches(kingdom_id,target_territory_id,march_type,units_json,status,arrives_at) SELECT ?,?,?,?,?,? WHERE changes()=?")
      .bind(k.id,target.id,marchType,unitsJson,"marching",arrival,unitTypes.length);
    const result=await env.DB.batch([
      debit,
      createMarch,
      env.DB.prepare("INSERT INTO action_logs(kingdom_id,player_id,action_type,details_json) SELECT ?,?,?,? WHERE changes()>0")
        .bind(k.id,p.id,"march_started",JSON.stringify({targetId,marchType,units:selected}))
    ]);
    if(!result[1]?.meta?.changes)return json({error:"Tropas insuficientes ou exército alterado por outra marcha. Atualize o reino e tente novamente."},409);
  }else if(type==="battle"){
    const units=await env.DB.prepare("SELECT unit_type,tier,quantity FROM army_units WHERE kingdom_id=? AND quantity>0 ORDER BY unit_type,tier").bind(k.id).all();
    const armyRows=units.results||[];
    const total=armyRows.reduce((n,u)=>n+u.quantity,0);
    if(total<1)return json({error:"Treine tropas antes de iniciar uma batalha."},409);
    const [hero,dragon,tech,defenseTech,battleState,activeHero]=await Promise.all([
      env.DB.prepare("SELECT level FROM heroes WHERE kingdom_id=? ORDER BY level DESC LIMIT 1").bind(k.id).first(),
      env.DB.prepare("SELECT level FROM dragons WHERE kingdom_id=?").bind(k.id).first(),
      env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='military'").bind(k.id).first(),
      env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='defense'").bind(k.id).first(),
      env.DB.prepare("SELECT battle_token FROM kingdoms WHERE id=?").bind(k.id).first(),
      env.DB.prepare("SELECT hero_key,rarity,level,experience FROM hero_inventory WHERE kingdom_id=? ORDER BY level DESC,stars DESC LIMIT 1").bind(k.id).first(),
    ]);
    const gearHero=activeHero?.hero_key?await env.DB.prepare("SELECT id FROM heroes WHERE kingdom_id=? AND hero_key=?").bind(k.id,activeHero.hero_key).first():null;
    await ensureEquipmentTables(env,k.id);
    const [equippedRows,gearResearchRows]=await Promise.all([
      gearHero?env.DB.prepare("SELECT ke.item_key,ke.level,ke.is_locked FROM kingdom_equipment ke JOIN hero_equipment he ON he.item_key=ke.item_key WHERE ke.kingdom_id=? AND he.hero_id=?").bind(k.id,gearHero.id).all():Promise.resolve({results:[]}),
      env.DB.prepare("SELECT research_key,level FROM research WHERE kingdom_id=? AND research_key IN ('gear_forging','gear_ward','gear_vitality','gear_logistics')").bind(k.id).all()
    ]);
    const gear=equipmentBonuses(equippedRows.results||[],gearResearchRows.results||[]);
    const [valhallaBuffs,petBonuses]=await Promise.all([getValhallaBuffMultipliers(env,k.id),getPetBonuses(env,k.id)]);
    const defenseBonusPercent=Math.min(30,Math.max(0,Number(defenseTech?.level||0)+gear.defensePercent));
    const roll=.85+crypto.getRandomValues(new Uint32Array(1))[0]/4294967295*.30;
    const criticalSeed=crypto.getRandomValues(new Uint32Array(1))[0];
    const simulation=simulateBattle({
      army:armyRows,castleLevel:Number(k.castle_level||1),
      heroLevel:Number(hero?.level||1),dragonLevel:Number(dragon?.level||1),
      researchLevel:Number(tech?.level||0),defenseBonusPercent,
      equipmentAttackBonusPercent:gear.attackPercent+Math.round((valhallaBuffs.attackPower-1)*100),equipmentHealthBonusPercent:gear.healthPercent,
      infantryAttackBonusPercent:petBonuses.infantryAttackPercent,
      criticalChancePercent:gear.criticalChancePercent,criticalDamageMultiplier:1.5,
      criticalSeed,
      castlePowerBonusPercent:Math.min(30,Math.max(0,Number(k.castle_level||1))),roll
    });
    const won=simulation.won,attackerPower=simulation.attackerPower,defenderPower=simulation.defenderPower;
    const losses={},remainingLosses={...simulation.losses},snapshot={};
    for(const unit of armyRows){
      const lost=Math.min(unit.quantity,Math.max(0,Number(remainingLosses[unit.unit_type]||0)));
      remainingLosses[unit.unit_type]=Math.max(0,Number(remainingLosses[unit.unit_type]||0)-lost);
      losses[unit.unit_type]=(losses[unit.unit_type]||0)+lost;
      snapshot[unit.unit_type+"_"+unit.tier]={quantity:unit.quantity,loss:lost};
    }
    const snapshotJson=JSON.stringify(snapshot),expectedRows=armyRows.length;
    const replayData={version:1,mode:"pve",seed:{criticalSeed,roll},participants:{attacker:{kingdom_id:k.id,army:armyRows.map(unit=>({...unit}))},defender:{type:"pve",castle_level:Number(k.castle_level||1)}},modifiers:{equipment:{attack:gear.attackPercent,health:gear.healthPercent,defense:gear.defensePercent,critical:gear.criticalChancePercent},valhalla:{attack_power:valhallaBuffs.attackPower},pet:{active_pet_id:petBonuses.activePetId,infantry_attack:petBonuses.infantryAttackPercent}},outcome:{won,rounds:simulation.rounds,attacker_power:attackerPower,defender_power:defenderPower,losses},frames:(simulation.log||[]).map((frame,index)=>({sequence:index+1,...frame}))};
    const previousBattleToken=battleState?.battle_token??"",battleToken=crypto.randomUUID(),actionId=crypto.randomUUID();
    const guard="EXISTS(SELECT 1 FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?)";
    const battleLock=env.DB.prepare("UPDATE kingdoms SET battle_token=? WHERE id=? AND COALESCE(battle_token,'')=COALESCE(?, '')").bind(battleToken,k.id,previousBattleToken);
    const troopUpdate=env.DB.prepare("UPDATE army_units SET quantity=quantity WHERE kingdom_id=? AND quantity>0 AND (SELECT COUNT(*) FROM json_each(?) AS requested JOIN army_units AS current ON current.kingdom_id=? AND current.unit_type||'_'||current.tier=requested.key AND current.quantity=CAST(json_extract(requested.value,'$.quantity') AS INTEGER))=? AND (SELECT COUNT(*) FROM army_units WHERE kingdom_id=? AND quantity>0)=? AND EXISTS(SELECT 1 FROM kingdoms WHERE id=? AND battle_token=?)")
      .bind(k.id,snapshotJson,k.id,expectedRows,k.id,expectedRows,k.id,battleToken);
    const statements=[battleLock,troopUpdate,
      env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE changes()=? AND EXISTS(SELECT 1 FROM kingdoms WHERE id=? AND battle_token=?)")
        .bind(k.id,"__internal_action_guard",actionId,expectedRows,k.id,battleToken)
    ];
    const rewards=won?{food:500,wood:300,stone:200,gold:100}:{food:0,wood:0,stone:0,gold:0};
    if(won){
      statements.push(env.DB.prepare("UPDATE kingdoms SET food=food+500,wood=wood+300,stone=stone+200,gold=gold+100 WHERE id=? AND "+guard).bind(k.id,k.id,actionId));
      statements.push(env.DB.prepare("INSERT INTO inventory_items(kingdom_id,item_key,quantity) SELECT ?,?,1 WHERE "+guard+" ON CONFLICT(kingdom_id,item_key) DO UPDATE SET quantity=quantity+1").bind(k.id,"royal_blueprint",k.id,actionId));
    }
    const battleReportIndex=statements.length;
    statements.push(env.DB.prepare("INSERT INTO battle_reports(attacker_kingdom_id,winner_kingdom_id,battle_type,attacker_power,defender_power,losses_json,rewards_json,battle_log,replay_json) SELECT ?,?,?,?,?,?,?,?,? WHERE "+guard)
      .bind(k.id,won?k.id:null,"pve",attackerPower,defenderPower,JSON.stringify(losses),JSON.stringify(rewards),JSON.stringify([{event:"battle_started"},{event:"combat_metadata",criticalSeed,criticalChancePercent:gear.criticalChancePercent,pet:petBonuses},{event:"combat_simulated",rounds:simulation.rounds,criticalHits:simulation.criticalHits||0,log:simulation.log},{event:won?"victory":"defeat"},{attackerPower,defenderPower}]),JSON.stringify(replayData),k.id,actionId));
    if(won){
      const ledgerRows=Object.entries(rewards).filter(([,amount])=>amount>0);
      if(ledgerRows.length)statements.push(env.DB.prepare("INSERT INTO resource_ledger(kingdom_id,resource,amount,reason) "+ledgerRows.map(()=> "SELECT ?,?,?,? WHERE "+guard).join(" UNION ALL "))
        .bind(...ledgerRows.flatMap(([resource,amount])=>[k.id,resource,amount,"recompensa de batalha PvE",k.id,actionId])));
    }
    let heroUpdateIndex=-1,heroProgress=null;
    if(activeHero){
      const cap=HERO_RARITY[activeHero.rarity]?.maxLevel||30;
      let level=activeHero.level,xp=activeHero.experience+(won?100:40);
      while(level<cap&&xp>=level*50){xp-=level*50;level++;}
      heroProgress={hero:activeHero.hero_key,level,experience:xp,gained:won?100:40};
      heroUpdateIndex=statements.length;
      statements.push(env.DB.prepare("UPDATE hero_inventory SET level=?,experience=? WHERE kingdom_id=? AND hero_key=? AND level=? AND experience=? AND "+guard)
        .bind(level,xp,k.id,activeHero.hero_key,activeHero.level,activeHero.experience,k.id,actionId));
    }
    statements.push(env.DB.prepare("DELETE FROM kingdom_events WHERE kingdom_id=? AND event_type='__internal_action_guard' AND payload_json=?").bind(k.id,actionId));
    const result=await env.DB.batch(statements);
    if(!result[2]?.meta?.changes)return json({error:"O exército mudou ou outra batalha foi processada. Atualize o reino e tente novamente."},409);
    battleOutcome={battle_id:Number(result[battleReportIndex]?.meta?.last_row_id||0)||null,won,attackerPower,defenderPower,losses,rewards,message:won?"Vitória! O reino recebeu recursos. As tropas foram preservadas.":"Derrota! As tropas foram preservadas; reorganize o exército e tente novamente."};
    if(heroProgress&&result[heroUpdateIndex]?.meta?.changes)battleOutcome.heroProgress=heroProgress;
   }else if(type==="rename"){
    const name=String(body.name||"").trim().slice(0,32);if(name.length<3)return json({error:"O nome deve ter de 3 a 32 caracteres."},400);
    await env.DB.batch([
      env.DB.prepare("UPDATE kingdoms SET kingdom_name=? WHERE id=?").bind(name,k.id),
      env.DB.prepare("UPDATE world_territories SET name=? WHERE territory_key=? AND territory_kind='castle'").bind("Castelo de "+name,"kingdom_castle_"+k.id)
    ]);
  }else{return json({error:"Ação de jogo desconhecida."},400)}
  return json({success:true,state:await gameState(env,playerId),...(battleOutcome?{battle:battleOutcome}:{})});
}

async function ensureAngelDeathWeekend(env,now=new Date()){
  let window=getAngelDeathWeekendWindow(now);
  const instant=now.toISOString();
  const current=await env.DB.prepare("SELECT id FROM world_events WHERE event_key=? AND starts_at=?").bind(ANGEL_DEATH_EVENT.key,window.startsAt).first();
  if(!current&&now.getTime()-Date.parse(window.startsAt)>15*60*1000&&now.getTime()<Date.parse(window.endsAt)){
    const history=await env.DB.prepare("SELECT id FROM world_events WHERE event_key=? ORDER BY starts_at DESC LIMIT 1").bind(ANGEL_DEATH_EVENT.key).first();
    if(!history)window=getAngelDeathWeekendWindow(new Date(Date.parse(window.startsAt)+7*86400000));
  }
  await env.DB.prepare("INSERT OR IGNORE INTO world_events(event_key,starts_at,ends_at,status,boss_hp_total,boss_hp_remaining) VALUES(?,?,?,?,?,?)")
    .bind(ANGEL_DEATH_EVENT.key,window.startsAt,window.endsAt,Date.parse(window.startsAt)<=now.getTime()?"active":"scheduled",ANGEL_DEATH_EVENT.bossHp,ANGEL_DEATH_EVENT.bossHp).run();
  await env.DB.prepare("UPDATE world_events SET status='active' WHERE event_key=? AND starts_at<=? AND ends_at>? AND status='scheduled'")
    .bind(ANGEL_DEATH_EVENT.key,instant,instant).run();
  return window;
}

async function angelDeathEventState(env,playerId){
  const now=new Date();
  await ensureAngelDeathWeekend(env,now);
  const event=await env.DB.prepare("SELECT id,event_key,starts_at,ends_at,status,boss_hp_total,boss_hp_remaining,boss_defeated_at,rewards_distributed_at FROM world_events WHERE event_key=? AND ends_at>? ORDER BY starts_at LIMIT 1")
    .bind(ANGEL_DEATH_EVENT.key,now.toISOString()).first();
  if(!event)return {event:null,participant:null,leaderboard:[]};
  const player=await env.DB.prepare("SELECT k.id FROM players p JOIN kingdoms k ON k.player_id=p.id WHERE p.player_id=?").bind(playerId).first();
  let participant=null;
  if(player){
    participant=await env.DB.prepare("SELECT score,damage,attacks,troops_lost,last_attack_at FROM world_event_participants WHERE event_id=? AND kingdom_id=?").bind(event.id,player.id).first();
    if(participant){
      const rank=await env.DB.prepare("SELECT COUNT(*)+1 AS rank FROM world_event_participants WHERE event_id=? AND (score>? OR (score=? AND damage>?) OR (score=? AND damage=? AND last_attack_at<?) OR (score=? AND damage=? AND last_attack_at=? AND kingdom_id<?))")
        .bind(event.id,participant.score,participant.score,participant.damage,participant.score,participant.damage,participant.last_attack_at,participant.score,participant.damage,participant.last_attack_at,player.id).first();
      participant={...participant,rank:Number(rank?.rank||1)};
    }else participant={score:0,damage:0,attacks:0,troops_lost:0,rank:null,last_attack_at:null};
  }
  const rows=await env.DB.prepare("SELECT COALESCE(n.nickname,NULLIF(p.name,'Jogador'),k.kingdom_name) AS display_name,k.kingdom_name,ep.score,ep.damage,ep.attacks,ep.troops_lost FROM world_event_participants ep JOIN kingdoms k ON k.id=ep.kingdom_id JOIN players p ON p.id=k.player_id LEFT JOIN player_nicknames n ON n.player_id=p.id WHERE ep.event_id=? AND ep.score>0 ORDER BY ep.score DESC,ep.damage DESC,ep.last_attack_at ASC,ep.kingdom_id ASC LIMIT 10")
    .bind(event.id).all();
  return {event:{...event,boss_name:ANGEL_DEATH_EVENT.name,boss_epithet:ANGEL_DEATH_EVENT.epithet,boss_level:ANGEL_DEATH_EVENT.level,timezone:ANGEL_DEATH_EVENT.timezone,schedule:ANGEL_DEATH_EVENT.schedule},participant,leaderboard:rows.results||[]};
}

async function angelDeathEventAttack(env,playerId,body,now=new Date()){
  const requestId=String(body.requestId||"").trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))return json({error:"Identificador de ataque inválido. Atualize a página e tente novamente."},400);
  const player=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
  if(!player)return json({error:"Jogador não encontrado."},404);
  const kingdom=await env.DB.prepare("SELECT * FROM kingdoms WHERE player_id=?").bind(player.id).first();
  if(!kingdom)return json({error:"Reino não encontrado."},404);
  const instant=now.toISOString();
  const event=await env.DB.prepare("SELECT id,boss_hp_remaining,status FROM world_events WHERE event_key=? AND status='active' AND starts_at<=? AND ends_at>? ORDER BY starts_at DESC LIMIT 1")
    .bind(ANGEL_DEATH_EVENT.key,instant,instant).first();
  if(!event)return json({error:"O Anjo da Morte não está ativo. O evento acontece automaticamente no fim de semana."},409);
  const duplicate=await env.DB.prepare("SELECT damage,score,troop_losses_json FROM world_event_attacks WHERE event_id=? AND kingdom_id=? AND request_id=?")
    .bind(event.id,kingdom.id,requestId).first();
  if(duplicate){
    const snapshot=JSON.parse(duplicate.troop_losses_json||"{}");
    const losses=Object.fromEntries(Object.entries(snapshot).map(([key,value])=>[key,Number(value?.loss||0)]));
    return json({success:true,duplicate:true,damage:Number(duplicate.damage||0),score:Number(duplicate.score||0),losses,troopsLost:Object.values(losses).reduce((sum,value)=>sum+value,0)});
  }
  if(Number(event.boss_hp_remaining)<=0)return json({error:"O Anjo da Morte já foi derrotado. A classificação será fechada no fim de semana."},409);
  const requested=body.units;
  if(!requested||typeof requested!=="object"||Array.isArray(requested))return json({error:"Selecione as tropas que participarão do ataque."},400);
  const availableRows=await env.DB.prepare("SELECT unit_type,tier,quantity FROM army_units WHERE kingdom_id=? AND quantity>0 ORDER BY unit_type,tier").bind(kingdom.id).all();
  const available=new Map((availableRows.results||[]).map(row=>[row.unit_type+"_"+row.tier,row]));
  const selected=[];
  let total=0;
  for(const [key,raw] of Object.entries(requested)){
    if(!/^(militia|swordsman|spearman|archer|crossbowman|cavalry|knight|catapult|ram|trebuchet)_(?:[1-9]|10)$/.test(key))return json({error:"Tipo de tropa inválido."},400);
    const quantity=Number(raw);
    if(!Number.isSafeInteger(quantity)||quantity<0||quantity>50000)return json({error:"Quantidade de tropas inválida."},400);
    if(quantity===0)continue;
    const row=available.get(key);
    if(!row||quantity>Number(row.quantity))return json({error:"Seu exército mudou. Atualize a página antes de atacar."},409);
    selected.push({...row,quantity});
    total+=quantity;
  }
  if(!selected.length)return json({error:"Selecione pelo menos uma tropa."},400);
  if(total>50000)return json({error:"O limite por ataque é de 50.000 tropas."},400);
  const [hero,dragon,tech,battleState]=await Promise.all([
    env.DB.prepare("SELECT level FROM heroes WHERE kingdom_id=? ORDER BY level DESC LIMIT 1").bind(kingdom.id).first(),
    env.DB.prepare("SELECT level FROM dragons WHERE kingdom_id=?").bind(kingdom.id).first(),
    env.DB.prepare("SELECT level FROM research WHERE kingdom_id=? AND research_key='military'").bind(kingdom.id).first(),
    env.DB.prepare("SELECT battle_token FROM kingdoms WHERE id=?").bind(kingdom.id).first()
  ]);
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  const simulation=simulateAngelDeathAttack({army:selected,castleLevel:kingdom.castle_level,heroLevel:hero?.level||1,dragonLevel:dragon?.level||1,militaryLevel:tech?.level||0,seed});
  const snapshot={};
  for(const row of selected){
    const key=row.unit_type+"_"+row.tier;
    snapshot[key]={quantity:row.quantity,loss:Number(simulation.losses[key]||0)};
  }
  const snapshotJson=JSON.stringify(snapshot),expectedRows=selected.length;
  const previousBattleToken=battleState?.battle_token??"",battleToken=crypto.randomUUID();
  const troopUpdate=env.DB.prepare("UPDATE army_units SET quantity=quantity-CAST(json_extract((SELECT value FROM json_each(?) WHERE key=army_units.unit_type||'_'||army_units.tier),'$.loss') AS INTEGER) WHERE kingdom_id=? AND quantity>0 AND EXISTS(SELECT 1 FROM json_each(?) AS selected WHERE selected.key=army_units.unit_type||'_'||army_units.tier) AND (SELECT COUNT(*) FROM json_each(?) AS requested JOIN army_units AS current ON current.kingdom_id=? AND current.unit_type||'_'||current.tier=requested.key AND current.quantity=CAST(json_extract(requested.value,'$.quantity') AS INTEGER))=? AND EXISTS(SELECT 1 FROM kingdoms WHERE id=? AND battle_token=?) AND EXISTS(SELECT 1 FROM world_events WHERE id=? AND status='active' AND boss_hp_remaining>0 AND starts_at<=? AND ends_at>?)")
    .bind(snapshotJson,kingdom.id,snapshotJson,snapshotJson,kingdom.id,expectedRows,kingdom.id,battleToken,event.id,instant,instant);
  const statements=[
    env.DB.prepare("UPDATE kingdoms SET battle_token=? WHERE id=? AND COALESCE(battle_token,'')=COALESCE(?, '')").bind(battleToken,kingdom.id,previousBattleToken),
    troopUpdate,
    env.DB.prepare("INSERT INTO world_event_attacks(event_id,kingdom_id,request_id,damage,score,troop_losses_json) SELECT ?,?,?,MIN(?,boss_hp_remaining),MIN(?,boss_hp_remaining),? FROM world_events WHERE id=? AND status='active' AND boss_hp_remaining>0 AND starts_at<=? AND ends_at>? AND changes()=? AND EXISTS(SELECT 1 FROM kingdoms WHERE id=? AND battle_token=?)")
      .bind(event.id,kingdom.id,requestId,simulation.damage,simulation.damage,snapshotJson,event.id,instant,instant,expectedRows,kingdom.id,battleToken),
    env.DB.prepare("UPDATE world_events SET boss_hp_remaining=MAX(0,boss_hp_remaining-(SELECT damage FROM world_event_attacks WHERE event_id=? AND kingdom_id=? AND request_id=?)),boss_defeated_at=CASE WHEN boss_hp_remaining<=(SELECT damage FROM world_event_attacks WHERE event_id=? AND kingdom_id=? AND request_id=?) THEN COALESCE(boss_defeated_at,?) ELSE boss_defeated_at END WHERE id=? AND EXISTS(SELECT 1 FROM world_event_attacks WHERE event_id=? AND kingdom_id=? AND request_id=?)")
      .bind(event.id,kingdom.id,requestId,event.id,kingdom.id,requestId,instant,event.id,event.id,kingdom.id,requestId),
    env.DB.prepare("INSERT OR IGNORE INTO world_event_participants(event_id,kingdom_id,first_attack_at,last_attack_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM world_event_attacks WHERE event_id=? AND kingdom_id=? AND request_id=?)")
      .bind(event.id,kingdom.id,instant,instant,event.id,kingdom.id,requestId),
    env.DB.prepare("UPDATE world_event_participants SET score=score+(SELECT score FROM world_event_attacks WHERE event_id=? AND kingdom_id=? AND request_id=?),damage=damage+(SELECT damage FROM world_event_attacks WHERE event_id=? AND kingdom_id=? AND request_id=?),attacks=attacks+1,troops_lost=troops_lost+?,last_attack_at=? WHERE event_id=? AND kingdom_id=? AND EXISTS(SELECT 1 FROM world_event_attacks WHERE event_id=? AND kingdom_id=? AND request_id=?)")
      .bind(event.id,kingdom.id,requestId,event.id,kingdom.id,requestId,simulation.troopsLost,instant,event.id,kingdom.id,event.id,kingdom.id,requestId)
  ];
  const result=await env.DB.batch(statements);
  if(!result[2]?.meta?.changes)return json({error:"O exército mudou, o chefe foi derrotado ou outro ataque foi processado. Atualize e tente novamente."},409);
  const [updated,attackRecord]=await Promise.all([
    env.DB.prepare("SELECT boss_hp_remaining FROM world_events WHERE id=?").bind(event.id).first(),
    env.DB.prepare("SELECT damage,score FROM world_event_attacks WHERE event_id=? AND kingdom_id=? AND request_id=?").bind(event.id,kingdom.id,requestId).first()
  ]);
  return json({success:true,damage:Number(attackRecord?.damage||0),score:Number(attackRecord?.score||0),losses:simulation.losses,troopsLost:simulation.troopsLost,lossRatePercent:Math.round(simulation.lossRate*100),bossHpRemaining:Number(updated?.boss_hp_remaining||0),message:"Ataque registrado. As baixas foram aplicadas permanentemente ao exército deste evento."});
}

async function distributeAngelDeathRewards(env,eventId,now=new Date()){
  const participants=await env.DB.prepare("SELECT ep.kingdom_id,k.player_id,ep.score FROM world_event_participants ep JOIN kingdoms k ON k.id=ep.kingdom_id WHERE ep.event_id=? AND ep.score>0 ORDER BY ep.score DESC,ep.damage DESC,ep.last_attack_at ASC,ep.kingdom_id ASC")
    .bind(eventId).all();
  const rows=participants.results||[];
  for(let offset=0;offset<rows.length;offset+=15){
    const statements=[];
    for(let index=offset;index<Math.min(rows.length,offset+15);index++){
      const participant=rows[index],rank=index+1,reward=angelDeathRewardForRank(rank),rewardJson=JSON.stringify(reward);
      statements.push(env.DB.prepare("INSERT OR IGNORE INTO world_event_rewards(event_id,kingdom_id,rank,score,reward_json) VALUES(?,?,?,?,?)").bind(eventId,participant.kingdom_id,rank,participant.score,rewardJson));
      statements.push(env.DB.prepare("UPDATE kingdoms SET food=food+?,wood=wood+?,stone=stone+?,iron=iron+?,gold=gold+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()>0").bind(reward.food,reward.wood,reward.stone,reward.iron,reward.gold,participant.kingdom_id));
      statements.push(env.DB.prepare("UPDATE players SET gems=gems+? WHERE id=? AND changes()>0").bind(reward.gems,participant.player_id));
      statements.push(env.DB.prepare("INSERT INTO inventory_items(kingdom_id,item_key,quantity) SELECT ?, 'death_essence', ? WHERE changes()>0 ON CONFLICT(kingdom_id,item_key) DO UPDATE SET quantity=quantity+excluded.quantity").bind(participant.kingdom_id,reward.deathEssence));
      statements.push(env.DB.prepare("UPDATE world_event_rewards SET paid_at=? WHERE event_id=? AND kingdom_id=? AND paid_at IS NULL AND changes()>0").bind(now.toISOString(),eventId,participant.kingdom_id));
    }
    await env.DB.batch(statements);
  }
  await env.DB.prepare("UPDATE world_events SET status='completed',rewards_distributed_at=? WHERE id=? AND ends_at<=? AND NOT EXISTS(SELECT 1 FROM world_event_participants ep LEFT JOIN world_event_rewards wr ON wr.event_id=ep.event_id AND wr.kingdom_id=ep.kingdom_id WHERE ep.event_id=? AND ep.score>0 AND (wr.id IS NULL OR wr.paid_at IS NULL))")
    .bind(now.toISOString(),eventId,now.toISOString(),eventId).run();
}

async function processAngelDeathEventLifecycle(env,now=new Date()){
  if(!env.DB)return;
  await ensureAngelDeathWeekend(env,now);
  const due=await env.DB.prepare("SELECT id FROM world_events WHERE event_key=? AND status IN ('scheduled','active') AND ends_at<=? ORDER BY ends_at LIMIT 10")
    .bind(ANGEL_DEATH_EVENT.key,now.toISOString()).all();
  for(const row of due.results||[]){
    try{await distributeAngelDeathRewards(env,row.id,now);}
    catch(error){console.error("angel_death_reward_distribution_failed",row.id,String(error?.message||error));}
  }
}

async function processDueKingdomQueues(env,kingdomId=null){
  if(!env.DB)return;
  const now=new Date().toISOString();
  const query=kingdomId
    ? env.DB.prepare("SELECT * FROM kingdom_queues WHERE kingdom_id=? AND status='running' AND completes_at<=? ORDER BY completes_at,id LIMIT 25").bind(kingdomId,now)
    : env.DB.prepare("SELECT * FROM kingdom_queues WHERE status='running' AND completes_at<=? ORDER BY completes_at,id LIMIT 200").bind(now);
  const due=await query.all();
  for(const queue of due.results||[]){
    const completionToken=crypto.randomUUID(),completedAt=new Date().toISOString();
    const eligible="((queue_type='construction' AND EXISTS(SELECT 1 FROM kingdom_buildings b WHERE b.kingdom_id=kingdom_queues.kingdom_id AND b.building_type=kingdom_queues.target_key AND b.level=kingdom_queues.from_level)) OR (queue_type='research' AND COALESCE((SELECT r.level FROM research r WHERE r.kingdom_id=kingdom_queues.kingdom_id AND r.research_key=kingdom_queues.target_key),0)=kingdom_queues.from_level) OR queue_type='training')";
    const statements=[env.DB.prepare("UPDATE kingdom_queues SET status='completed',completed_at=?,completion_token=? WHERE id=? AND status='running' AND completes_at<=? AND "+eligible)
      .bind(completedAt,completionToken,queue.id,now)];
    const guard="EXISTS(SELECT 1 FROM kingdom_queues WHERE id=? AND status='completed' AND completion_token=?)";
    if(queue.queue_type==="construction"){
      statements.push(env.DB.prepare("UPDATE kingdom_buildings SET level=?,upgraded_at=? WHERE kingdom_id=? AND building_type=? AND level=? AND "+guard)
        .bind(queue.to_level,completedAt,queue.kingdom_id,queue.target_key,queue.from_level,queue.id,completionToken));
      if(queue.target_key==="castle"){
        statements.push(env.DB.prepare("UPDATE kingdoms SET castle_level=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND "+guard)
          .bind(queue.to_level,queue.kingdom_id,queue.id,completionToken));
        statements.push(env.DB.prepare("UPDATE world_territories SET level=?,name=(SELECT 'Castelo de '||kingdom_name FROM kingdoms WHERE id=?) WHERE territory_key=? AND "+guard)
          .bind(queue.to_level,queue.kingdom_id,"kingdom_castle_"+queue.kingdom_id,queue.id,completionToken));
      }
    }else if(queue.queue_type==="training"){
      statements.push(env.DB.prepare("INSERT INTO army_units(kingdom_id,unit_type,tier,quantity) SELECT ?,?,1,? WHERE "+guard+" ON CONFLICT(kingdom_id,unit_type,tier) DO UPDATE SET quantity=quantity+excluded.quantity")
        .bind(queue.kingdom_id,queue.target_key,queue.quantity,queue.id,completionToken));
    }else if(queue.queue_type==="research"){
      statements.push(env.DB.prepare("INSERT INTO research(kingdom_id,research_key,level,completed_at) SELECT ?,?,?,? WHERE "+guard+" ON CONFLICT(kingdom_id,research_key) DO UPDATE SET level=excluded.level,completed_at=excluded.completed_at")
        .bind(queue.kingdom_id,queue.target_key,queue.to_level,completedAt,queue.id,completionToken));
    }
    if(queue.reward_item){
      statements.push(env.DB.prepare("INSERT INTO inventory_items(kingdom_id,item_key,quantity) SELECT ?,?,1 WHERE "+guard+" ON CONFLICT(kingdom_id,item_key) DO UPDATE SET quantity=quantity+1")
        .bind(queue.kingdom_id,queue.reward_item,queue.id,completionToken));
    }
    const eventType=queue.queue_type==="construction"?"building_upgraded":queue.queue_type==="training"?"troops_trained":"research_upgraded";
    const eventPayload=queue.queue_type==="construction"
      ? {building:queue.target_key,level:queue.to_level,queueId:queue.id}
      : queue.queue_type==="training"
        ? {unit:queue.target_key,quantity:queue.quantity,queueId:queue.id}
        : {research:queue.target_key,level:queue.to_level,queueId:queue.id};
    statements.push(env.DB.prepare("INSERT INTO kingdom_events(kingdom_id,event_type,payload_json) SELECT ?,?,? WHERE "+guard)
      .bind(queue.kingdom_id,eventType,JSON.stringify(eventPayload),queue.id,completionToken));
    statements.push(env.DB.prepare("INSERT INTO action_logs(kingdom_id,player_id,action_type,details_json) SELECT ?,NULL,?,? WHERE "+guard)
      .bind(queue.kingdom_id,queue.queue_type+"_completed",JSON.stringify(eventPayload),queue.id,completionToken));
    try{
      await env.DB.batch(statements);
      if(queue.queue_type==="construction")await recalculateKingdomStats(env,queue.kingdom_id);
      await recalculateKingdomPower(env,queue.kingdom_id);
    }catch(error){
      console.error("kingdom_queue_completion_failed",queue.id,String(error?.message||error));
    }
  }
}

async function processDueMarches(env){
  if(!env.DB)return;
  const now=new Date().toISOString();
  const dueKingdoms=await env.DB.prepare(
    "SELECT DISTINCT kingdom_id FROM marches WHERE status='marching' AND arrives_at<=? ORDER BY kingdom_id LIMIT 100"
  ).bind(now).all();
  for(const row of dueKingdoms.results||[]){
    try{
      await processMarches(env,row.kingdom_id);
    }catch(error){
      // Uma falha num reino não impede a resolução das marchas dos demais.
      console.error("scheduled_march_resolution_failed",row.kingdom_id,String(error?.message||error));
    }
  }
}

export default {
 async scheduled(controller,env){
  try{await processDueKingdomQueues(env);}
  catch(error){console.error("scheduled_kingdom_queue_resolution_failed",String(error?.message||error));}
  try{
    const scheduledAt=controller?.scheduledTime?new Date(controller.scheduledTime):new Date();
    const rewardResult=await distributeValhallaDailyRunes(env,scheduledAt);
    if(rewardResult.granted>0)console.log("valhalla_daily_runes_distributed",rewardResult);
  }catch(error){console.error("scheduled_valhalla_runes_failed",String(error?.message||error));}
  await processDueMarches(env);
  try{await processDueRallies(env);}
  catch(error){console.error("scheduled_rally_resolution_failed",String(error?.message||error));}
  try{await processAngelDeathEventLifecycle(env);}
  catch(error){console.error("angel_death_event_scheduler_failed",String(error?.message||error));}
  try{await env.DB.prepare("DELETE FROM api_rate_limits WHERE expires_at<=?").bind(Math.floor(Date.now()/1000)).run();}
  catch(error){console.error("scheduled_rate_limit_cleanup_failed",String(error?.message||error));}
  try{await env.DB.prepare("UPDATE battle_reports SET replay_json='{}',battle_log='[]' WHERE replay_expires_at>0 AND replay_expires_at<=? AND (replay_json<>'{}' OR battle_log<>'[]')").bind(Math.floor(Date.now()/1000)).run();}
  catch(error){console.error("scheduled_battle_replay_expiry_failed",String(error?.message||error));}
  try{await processEmailQueue(env,10);}
  catch(error){console.error("scheduled_email_queue_failed",String(error?.message||error));}
 },
 async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{status:204});
  const url=new URL(request.url);
  if(url.pathname==="/api/email/verify"&&request.method==="GET")return await verifyEmailToken(env,url.searchParams.get("token"));
  if(!url.pathname.startsWith("/api/"))return env.ASSETS.fetch(request);
  if(url.pathname==="/api/admin/health"&&request.method==="GET")return json({hasDB:Boolean(env.DB),hasADMIN_EMAIL:Boolean(env.ADMIN_EMAIL),hasADMIN_PASSWORD:Boolean(env.ADMIN_PASSWORD),hasSESSION_SECRET:Boolean(env.SESSION_SECRET),hasMP_ACCESS_TOKEN:Boolean(env.MP_ACCESS_TOKEN),hasMP_WEBHOOK_SECRET:Boolean(env.MP_WEBHOOK_SECRET),hasMercadoPagoAutomaticCheckout:Boolean(env.MP_ACCESS_TOKEN&&env.MP_WEBHOOK_SECRET),hasEmailProvider:Boolean(env.RESEND_API_KEY&&env.EMAIL_FROM&&env.FRONTEND_URL),hasResendApiKey:Boolean(env.RESEND_API_KEY),hasEmailFrom:Boolean(env.EMAIL_FROM),hasFrontendUrl:Boolean(env.FRONTEND_URL)});
  if(url.pathname==="/api/health"&&request.method==="GET"){
    const checks={database:false,session:Boolean(env.SESSION_SECRET),schema:false};
    const requiredTables=["players","player_accounts","mercadopago_orders","kingdoms","kingdom_buildings","army_units","heroes","dragons","resource_ledger","world_territories","marches","research","battle_reports","inventory_items","kingdom_events","alliances","alliance_members","alliance_invites","alliance_chat","alliance_wars","kingdom_equipment","api_rate_limits","purchase_requests","game_search_documents","game_search_fts","game_search_substring_fts","player_nicknames","game_player_search_fts","game_player_substring_fts","world_events","world_event_participants","world_event_attacks","world_event_rewards","kingdom_queues","email_templates","player_email_contacts","email_queue","email_history","analytics_events","feedback","beta_signups","referral_tracking","game_config","valhalla_troop_catalog","valhalla_hero_catalog","valhalla_catalog","valhalla_troops","valhalla_rune_ledger","valhalla_purchases","valhalla_buffs","valhalla_daily_rewards","valhalla_wild_hunt","valhalla_wild_hunt_attacks","valhalla_leaderboard","valhalla_rewards_claimed","resource_nodes","rallies","rally_reinforcements","kingdom_tech","tech_catalog","pet_catalog","kingdom_pets","kingdom_pet_feed_requests"];
    let missingTables=[...requiredTables];
    if(env.DB){
      try{
        await env.DB.prepare("SELECT 1 AS ready").first();
        checks.database=true;
        const rows=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const existing=new Set((rows.results||[]).map(row=>row.name));
        missingTables=requiredTables.filter(name=>!existing.has(name));
        checks.schema=missingTables.length===0;
      }catch(error){
        console.error("health_check_failed",String(error?.message||error));
      }
    }
    const ready=checks.database&&checks.session&&checks.schema;
    return json({ok:ready,status:ready?"ready":"not_ready",checks,missingTables},ready?200:503);
  }
  if(!env.DB)return json({error:"Banco D1 não vinculado ao Worker."},503);
  if(url.pathname.startsWith("/api/account/"))return await handlePlayerAccountRoute(request,env,{json,readBody,gameIdentity,rateLimitDecision});
  const mpRouteResponse=await handleMercadoPagoRoute(request,env,{json,readBody,gameIdentity,rateLimitDecision});
  if(mpRouteResponse)return mpRouteResponse;
  if(url.pathname==="/api/config/valhalla"&&request.method==="GET")return await handleValhallaConfig(request,env);
  if(url.pathname==="/api/beta/signup"&&request.method==="POST"){
    const ip=request.headers.get("CF-Connecting-IP")||"unknown";
    const limited=await rateLimitDecision(env,"beta-signup-ip",ip,5,3600);
    if(limited)return limited;
    const body=await readBody(request,4096);
    if(body.__bodyError)return json({error:"Inscrição inválida."},body.__bodyError==="payload_too_large"?413:400);
    const email=String(body.email||"").trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)||email.length>254)return json({error:"Informe um e-mail válido."},400);
    if(body.consent!==true)return json({error:"É necessário consentir com o recebimento de convites e atualizações do beta."},400);
    try{
      const inserted=await env.DB.prepare("INSERT INTO beta_signups(email,consent_at,consent_version) VALUES(?,CURRENT_TIMESTAMP,'beta-2026-11')")
        .bind(email).run();
      if(!inserted.meta?.changes)return json({error:"Este e-mail já está inscrito."},409);
      return json({success:true,message:"Inscrição confirmada. Você receberá atualizações sobre o beta."},201);
    }catch(error){
      if(String(error?.message||error).includes("UNIQUE"))return json({error:"Este e-mail já está inscrito."},409);
      console.error("beta_signup_failed",String(error?.message||error));
      return json({error:"Não foi possível concluir a inscrição."},500);
    }
  }
  if(url.pathname==="/api/store/catalog"&&request.method==="GET"){
    try{
      const ip=request.headers.get("CF-Connecting-IP")||"unknown";
      const limited=await rateLimitDecision(env,"store-catalog-ip",ip,60,60);
      if(limited)return limited;
      const [skins,packages]=await Promise.all([
        env.DB.prepare("SELECT id,name,price_brl FROM skins ORDER BY price_brl,name").all(),
        env.DB.prepare("SELECT id,name,price_brl,gems FROM vip_packages ORDER BY price_brl,name").all()
      ]);
      return json({skins:skins.results||[],packages:packages.results||[],whatsapp:"+5547996531437"});
    }catch(e){return json({error:"Catálogo indisponível no momento."},503)}
  }
  if(url.pathname==="/api/game/start"&&request.method==="POST"){
    if(!env.SESSION_SECRET)return json({error:"SESSION_SECRET não configurado no Worker."},503);
    try{
      const ip=request.headers.get("CF-Connecting-IP")||"unknown";
      const limited=await rateLimitDecision(env,"game-start-ip",ip,20,3600);
      if(limited)return limited;
      const startBody=await readBody(request,4096);
      if(startBody.__bodyError)return json({error:"Solicitação de criação de reino inválida."},startBody.__bodyError==="payload_too_large"?413:400);
      const playerId="izzy_"+crypto.randomUUID().replace(/-/g,"");
      await ensureKingdom(env,playerId);
      let referralRecorded=false;
      const referrerCode=String(startBody.referrer_code||"").trim();
      if(/^izzy_[a-f0-9]{32}$/.test(referrerCode)&&referrerCode!==playerId){
        try{
          const tracked=await env.DB.prepare(
            "INSERT OR IGNORE INTO referral_tracking(referrer_player_id,referred_player_id) " +
            "SELECT referrer.id,referred.id FROM players referrer " +
            "JOIN players referred ON referred.player_id=? " +
            "WHERE referrer.player_id=? AND referrer.id<>referred.id"
          ).bind(playerId,referrerCode).run();
          referralRecorded=Number(tracked.meta?.changes||0)>0;
        }catch(error){
          console.error("referral_tracking_failed",String(error?.message||error));
        }
      }
      const token=await sign({sub:playerId,scope:"game",exp:Math.floor(Date.now()/1000)+60*60*24*365},env.SESSION_SECRET);
      return json({token,state:await gameState(env,playerId),referral_recorded:referralRecorded},201);
    }catch(e){console.error("game_start_failed",String(e?.message||e));return json({error:"Não foi possível fundar o reino. Verifique a configuração e as migrações do banco."},503)}
  }
  if(url.pathname==="/api/store/purchase-request"&&request.method==="POST"){
    if(!env.SESSION_SECRET)return json({error:"Sessão indisponível."},503);
    const playerId=await gameIdentity(request,env);
    if(!playerId)return json({error:"Sessão do jogador inválida."},401);
    const limited=await rateLimitDecision(env,"purchase-request-player",playerId,5,3600);
    if(limited)return limited;
    const body=await readBody(request,8192);
    if(body.__bodyError)return json({error:"Solicitação inválida."},400);
    const kind=String(body.kind||""),itemId=Number(body.itemId),requestKey=String(body.requestKey||"").slice(0,64);
    if(!Number.isSafeInteger(itemId)||itemId<1||!requestKey||!/^[a-zA-Z0-9_-]{12,64}$/.test(requestKey)||!["vip_package","skin"].includes(kind))return json({error:"Pacote ou solicitação inválida."},400);
    const requestedPaymentMethod=String(body.paymentMethod||"mercadopago_link");
    if(requestedPaymentMethod!=="mercadopago_link")return json({error:"Pagamento disponível somente pelo Mercado Pago."},400);
    const paymentMethod="mercadopago_link";
    const paymentReference=String(body.paymentReference||"").trim().slice(0,120)||null;
    const player=await env.DB.prepare("SELECT id,name,player_id FROM players WHERE player_id=?").bind(playerId).first();
    if(!player)return json({error:"Jogador não encontrado."},404);
    const kingdom=await env.DB.prepare("SELECT id,kingdom_name FROM kingdoms WHERE player_id=?").bind(player.id).first();
    if(!kingdom)return json({error:"Reino não encontrado."},404);
    const item=kind==="vip_package"
      ?await env.DB.prepare("SELECT id,name,price_brl,gems FROM vip_packages WHERE id=?").bind(itemId).first()
      :await env.DB.prepare("SELECT id,name,price_brl FROM skins WHERE id=?").bind(itemId).first();
    if(!item)return json({error:"Produto não encontrado no catálogo."},404);
    if(kind==="skin"){
      const owned=await env.DB.prepare("SELECT 1 FROM player_skins WHERE player_id=? AND skin_id=?").bind(player.id,item.id).first();
      if(owned)return json({error:"Você já possui esta skin."},409);
    }
    const pending=await env.DB.prepare("SELECT id,status,product_name FROM purchase_requests WHERE player_id=? AND product_kind=? AND product_id=? AND status='pending'").bind(player.id,kind,item.id).first();
    if(pending)return json({success:true,request:pending,reused:true,message:"Você já possui um pedido aguardando análise."},200);
    try{
      await env.DB.prepare("INSERT INTO purchase_requests(player_id,kingdom_id,product_kind,product_id,product_name,price_brl,currency,gems_amount,payment_method,payment_reference,request_key) VALUES(?,?,?,?,?,?,'BRL',?,?,?,?)")
        .bind(player.id,kingdom.id,kind,item.id,item.name,item.price_brl,kind==="vip_package"?Number(item.gems||0):0,paymentMethod,paymentReference,requestKey).run();
    }catch(error){
      const existing=await env.DB.prepare("SELECT id,status,product_name FROM purchase_requests WHERE player_id=? AND request_key=?").bind(player.id,requestKey).first();
      if(existing)return json({success:true,request:existing,reused:true},200);
      const duplicate=await env.DB.prepare("SELECT id,status,product_name FROM purchase_requests WHERE player_id=? AND product_kind=? AND product_id=? AND status='pending'").bind(player.id,kind,item.id).first();
      if(duplicate)return json({success:true,request:duplicate,reused:true,message:"Você já possui um pedido aguardando análise."},200);
      throw error;
    }
    const created=await env.DB.prepare("SELECT id,status,product_name,price_brl,currency,payment_method,payment_reference,created_at FROM purchase_requests WHERE player_id=? AND request_key=?").bind(player.id,requestKey).first();
    return json({success:true,request:created,message:"Pedido enviado ao painel Master. A liberação acontece após a confirmação do pagamento."},201);
  }
  const isGamePath=url.pathname.startsWith("/api/game/");
  if(isGamePath){
    const playerId=await gameIdentity(request,env);
    if(!playerId)return json({error:"Sessão do jogador inválida."},401);
    try{
      if(url.pathname==="/api/game/referral/link"&&request.method==="GET"){
        const limited=await rateLimitDecision(env,"referral-link-player",playerId,15,60);
        if(limited)return limited;
        const player=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
        if(!player)return json({error:"Jogador não encontrado."},404);
        const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM referral_tracking WHERE referrer_player_id=?").bind(player.id).first();
        const invite=new URL("/kingdom.html",url.origin);
        invite.searchParams.set("ref",playerId);
        return json({referral_code:playerId,referral_url:invite.href,referral_count:Number(count?.total||0)});
      }
      if(url.pathname==="/api/game/pets"||url.pathname.startsWith("/api/game/pets/")){
        const petPath=url.pathname==="/api/game/pets"?"catalog":url.pathname.slice("/api/game/pets/".length);
        const isRead=request.method==="GET"&&petPath==="catalog";
        const isWrite=request.method==="POST"&&["unlock","feed","activate"].includes(petPath);
        if(!isRead&&!isWrite)return json({error:"Rota ou método de mascotes inválido."},request.method==="GET"||request.method==="POST"?404:405);
        const limited=await rateLimitDecision(env,isWrite?"pet-write-player":"pet-read-player",playerId,isWrite?20:60,60);
        if(limited)return limited;
        let petBody={};
        if(isWrite){petBody=await readBody(request,4096);if(petBody.__bodyError)return json({error:"Solicitação de mascote inválida."},petBody.__bodyError==="payload_too_large"?413:400);}
        return await handlePetsRoute(request,env,playerId,petPath,petBody);
      }
      if(url.pathname==="/api/game/battle/replay"){
        if(request.method!=="GET")return json({error:"Método não permitido."},405);
        const limited=await rateLimitDecision(env,"battle-replay-player",playerId,30,60);
        if(limited)return limited;
        return await getBattleReplay(env,playerId,url.searchParams.get("battle_id"));
      }
      if(url.pathname.startsWith("/api/game/valhalla-shop/")){
        const method=request.method;
        if(!["GET","POST"].includes(method))return json({error:"Método não permitido."},405);
        if(method==="POST"&&url.pathname!=="/api/game/valhalla-shop/buy")return json({error:"Rota da loja inválida."},404);
        if(method==="GET"&&!["/api/game/valhalla-shop/catalog","/api/game/valhalla-shop/history"].includes(url.pathname))return json({error:"Rota da loja inválida."},404);
        const limited=await rateLimitDecision(
          env,
          method==="POST"?"valhalla-shop-buy-player":"valhalla-shop-read-player",
          playerId,
          method==="POST"?12:60,
          60
        );
        if(limited)return limited;
        let body={};
        if(method==="POST"){
          body=await readBody(request,4096);
          if(body.__bodyError)return json({error:"Solicitação de compra inválida."},body.__bodyError==="payload_too_large"?413:400);
        }
        return await handleValhallaShop(request,env,playerId,body);
      }
      if(url.pathname==="/api/game/email/verification"&&request.method==="POST"){
        const limited=await rateLimitDecision(env,"email-verification-player",playerId,3,3600);
        if(limited)return limited;
        const networkLimit=await rateLimitDecision(env,"email-verification-network",request.headers.get("CF-Connecting-IP")||"unknown",10,3600);
        if(networkLimit)return networkLimit;
        const body=await readBody(request,4096);
        if(body.__bodyError)return json({error:"Solicitação de confirmação inválida."},400);
        return await requestEmailVerification(env,playerId,body.email);
      }
      if(url.pathname==="/api/game/email/preferences"&&request.method==="GET")return await getEmailPreferences(env,playerId);
      if(url.pathname==="/api/game/email/preferences"&&request.method==="PUT"){
        const body=await readBody(request,4096);
        if(body.__bodyError)return json({error:"Preferências inválidas."},400);
        return await updateEmailPreferences(env,playerId,body);
      }
      if(url.pathname==="/api/game/email/history"&&request.method==="GET")return await getEmailHistory(env,playerId);
      if(url.pathname==="/api/game/analytics"&&request.method==="POST"){
        const limited=await rateLimitDecision(env,"game-analytics-player",playerId,120,60);
        if(limited)return limited;
        const body=await readBody(request,8192);
        if(body.__bodyError)return json({error:"Evento de analytics inválido."},body.__bodyError==="payload_too_large"?413:400);
        const event=String(body.event||"").trim().toLowerCase();
        if(!/^[a-z][a-z0-9_.:-]{1,79}$/.test(event))return json({error:"Nome de evento inválido."},400);
        let sessionId=null;
        if(body.sessionId!==undefined&&body.sessionId!==null&&body.sessionId!==""){
          sessionId=String(body.sessionId);
          if(!/^[a-zA-Z0-9_-]{1,80}$/.test(sessionId))return json({error:"ID de sessão inválido."},400);
        }
        let dataJson=null;
        if(body.data!==undefined&&body.data!==null){
          if(typeof body.data!=="object"||Array.isArray(body.data))return json({error:"Dados de analytics devem ser um objeto."},400);
          const safeData={};
          for(const [key,value] of Object.entries(body.data).slice(0,20)){
            if(!["screen","source","action","result","castle_level","rating","duration_ms","count","mode","platform","phase"].includes(key))continue;
            if(typeof value==="string")safeData[key]=value.slice(0,120);
            else if(typeof value==="number"&&Number.isFinite(value))safeData[key]=value;
            else if(typeof value==="boolean")safeData[key]=value;
          }
          dataJson=JSON.stringify(safeData);
          if(dataJson.length>4096)return json({error:"Dados de analytics excedem o limite permitido."},413);
        }
        const player=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
        if(!player)return json({error:"Jogador não encontrado."},404);
        await env.DB.prepare("INSERT INTO analytics_events(player_id,event,session_id,data_json) VALUES(?,?,?,?)")
          .bind(player.id,event,sessionId,dataJson).run();
        return json({success:true},201);
      }
      if(url.pathname==="/api/game/feedback"&&request.method==="POST"){
        const limited=await rateLimitDecision(env,"game-feedback-player",playerId,3,3600);
        if(limited)return limited;
        const body=await readBody(request,4096);
        if(body.__bodyError)return json({error:"Feedback inválido."},body.__bodyError==="payload_too_large"?413:400);
        const rating=Number(body.rating);
        if(!Number.isSafeInteger(rating)||rating<1||rating>5)return json({error:"A avaliação deve ser de 1 a 5."},400);
        if(body.text!==undefined&&typeof body.text!=="string")return json({error:"O comentário deve ser texto."},400);
        const feedbackText=String(body.text||"").trim();
        if(feedbackText.length>2000)return json({error:"O comentário excede 2.000 caracteres."},400);
        const player=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(playerId).first();
        if(!player)return json({error:"Jogador não encontrado."},404);
        await env.DB.prepare("INSERT INTO feedback(player_id,rating,text) VALUES(?,?,?)")
          .bind(player.id,rating,feedbackText||null).run();
        return json({success:true,message:"Feedback recebido. Obrigado por ajudar a melhorar o Clash of Izzy."},201);
      }
      if(url.pathname==="/api/game/state"&&request.method==="GET"){
        const limited=await rateLimitDecision(env,"game-state-player",playerId,120,60);
        if(limited)return limited;
      }
      if(url.pathname==="/api/game/event"&&request.method==="GET"){
        const limited=await rateLimitDecision(env,"angel-death-state-player",playerId,30,60);
        if(limited)return limited;
        return json(await angelDeathEventState(env,playerId));
      }
      if(url.pathname==="/api/game/event/attack"&&request.method==="POST"){
        const limited=await rateLimitDecision(env,"angel-death-attack-player",playerId,6,60);
        if(limited)return limited;
        const networkLimit=await rateLimitDecision(env,"angel-death-attack-network",request.headers.get("CF-Connecting-IP")||"unknown",60,60);
        if(networkLimit)return networkLimit;
        const body=await readBody(request,8192);
        if(body.__bodyError)return json({error:"Solicitação de ataque inválida."},body.__bodyError==="payload_too_large"?413:400);
        return await angelDeathEventAttack(env,playerId,body);
      }
      if(url.pathname==="/api/game/players/search"&&request.method==="GET"){
        const limited=await rateLimitDecision(env,"player-search-player",playerId,20,60);
        if(limited)return limited;
        const networkLimit=await rateLimitDecision(env,"player-search-network",request.headers.get("CF-Connecting-IP")||"unknown",120,60);
        if(networkLimit)return networkLimit;
        const rawQuery=String(url.searchParams.get("q")||"").normalize("NFKC").trim();
        if(!/^[\p{L}\p{N}_-]{3,20}$/u.test(rawQuery))return json({error:"Digite ao menos 3 caracteres válidos para pesquisar jogadores.",players:[]},400);
        const queryKey=rawQuery.toLocaleLowerCase("en-US");
        const escaped=queryKey.replace(/[!%_]/g,ch=>"!"+ch);
        const limit=Math.min(10,Math.max(1,Math.floor(Number(url.searchParams.get("limit"))||8)));
        const rows=await env.DB.prepare(
          "SELECT n.nickname,k.kingdom_name,k.castle_level,k.power,COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=k.id),'') AS alliance_tag FROM player_nicknames n JOIN kingdoms k ON k.player_id=n.player_id WHERE n.player_id<>(SELECT id FROM players WHERE player_id=?) AND n.nickname_key LIKE ? ESCAPE '!' ORDER BY CASE WHEN n.nickname_key=? THEN 0 ELSE 1 END,k.power DESC,n.nickname_key LIMIT ?"
        ).bind(playerId,escaped+"%",queryKey,limit).all();
        const players=(rows.results||[]).map(row=>({nickname:row.nickname,kingdom_name:row.kingdom_name,castle_level:Number(row.castle_level||1),power:Number(row.power||0)}));
        return json({query:rawQuery,players,count:players.length});
      }
      if(url.pathname==="/api/game/search"&&request.method==="GET"){
        const limited=await rateLimitDecision(env,"game-search-player",playerId,30,60);
        if(limited)return limited;
        const networkLimit=await rateLimitDecision(env,"game-search-network",request.headers.get("CF-Connecting-IP")||"unknown",180,60);
        if(networkLimit)return networkLimit;
        const rawQuery=String(url.searchParams.get("q")||"").normalize("NFKC").trim();
        const queryLength=Array.from(rawQuery).length;
        const containsCjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(rawQuery);
        const needsShortUnicodeFallback=queryLength<3;
        if(queryLength<(containsCjk?1:2))return json({error:"Digite pelo menos 2 caracteres (ou 1 caractere CJK).",results:[]},400);
        if(queryLength>48)return json({error:"A busca aceita até 48 caracteres.",results:[]},400);
        const kind=String(url.searchParams.get("type")||"all").toLowerCase();
        if(!["all","players","kingdoms","alliances","territories","skins"].includes(kind))return json({error:"Categoria de busca inválida.",results:[]},400);
        const entityType=({kingdoms:"kingdom",alliances:"alliance",territories:"territory",skins:"skin"})[kind]||"";
        const tokens=(rawQuery.match(/[\p{L}\p{N}_]+/gu)||[]).slice(0,8);
        if(!tokens.length)return json({error:"Digite um nome ou termo válido.",results:[]},400);
        const tokenVariants=token=>{
          const normalized=token.normalize("NFKD").replace(/[\p{M}]/gu,"").toLocaleLowerCase("pt-BR");
          const variants=new Set([normalized]);
          if(normalized.length>4){
            if(normalized.endsWith("oes"))variants.add(normalized.slice(0,-3)+"ao");
            else if(normalized.endsWith("aes"))variants.add(normalized.slice(0,-3)+"ao");
            else if(normalized.endsWith("ais"))variants.add(normalized.slice(0,-3)+"al");
            else if(normalized.endsWith("eis"))variants.add(normalized.slice(0,-3)+"el");
            else if(normalized.endsWith("ao")){variants.add(normalized.slice(0,-2)+"oes");variants.add(normalized.slice(0,-2)+"aes");}
            else if(normalized.endsWith("al"))variants.add(normalized.slice(0,-2)+"ais");
            else if(normalized.endsWith("el"))variants.add(normalized.slice(0,-2)+"eis");
            else if(normalized.endsWith("il"))variants.add(normalized.slice(0,-2)+"is");
            else if(normalized.endsWith("es"))variants.add(normalized.slice(0,-2));
            else if(normalized.endsWith("s"))variants.add(normalized.slice(0,-1));
          }
          return [...variants];
        };
        const ftsQuery=tokens.map(token=>"("+tokenVariants(token).map(variant=>'"'+variant.replace(/"/g,'""')+'"*').join(" OR ")+")").join(" AND ");
        const playerFtsQuery=tokens.map(token=>'"'+token.replace(/"/g,'""')+'"*').join(" AND ");
        const substringQuery='"'+rawQuery.replace(/"/g,'""')+'"';
        const fuzzyQuery=buildTrigramSearchQuery(tokens);
        const escaped=rawQuery.toLocaleLowerCase("en-US").replace(/[!%_]/g,ch=>"!"+ch);
        const pattern="%"+escaped+"%";
        const prefixPattern=escaped+"%";
        const limit=Math.min(20,Math.max(1,Math.floor(Number(url.searchParams.get("limit"))||10)));
        const normalized=value=>String(value||"").normalize("NFKD").replace(/[\p{M}]/gu,"").toLocaleLowerCase("pt-BR").trim();
        const queryKey=normalized(rawQuery);
        const resultMap=new Map();
        let usedFts=false;
        const addResult=(item,rank=0,requireFuzzy=false)=>{
          const name=item.nickname||item.name||"";
          const candidate=normalized(name);
          const searchableFields=[item.nickname,item.name,item.tag,item.description,item.kingdom_name,item.terrain]
            .map(normalized).filter(Boolean);
          const exactMatch=searchableFields.some(value=>value===queryKey);
          const prefixMatch=searchableFields.some(value=>value.startsWith(queryKey));
          const phraseMatch=searchableFields.some(value=>value.includes(queryKey));
          const coveredTokens=tokens.filter(token=>{
            const normalizedToken=normalized(token);
            return searchableFields.some(value=>value.includes(normalizedToken));
          }).length;
          const typoCount=fuzzyTokenDistance(tokens,searchableFields);
          if(requireFuzzy&&typoCount===null)return;
          const priority=exactMatch?0:prefixMatch?1:phraseMatch?2:coveredTokens===tokens.length?3:typoCount!==null?4:5;
          const key=item.type+"|"+candidate;
          const existing=resultMap.get(key);
          if(!existing||priority<existing._priority||(priority===existing._priority&&(typoCount??99)<existing._typos)||(priority===existing._priority&&(typoCount??99)===existing._typos&&Number(rank)<existing._rank))
            resultMap.set(key,{...item,_priority:priority,_typos:typoCount??99,_rank:Number(rank)||0});
        };
        const wantsEntities=kind!=="players";
        const wantsPlayers=kind==="all"||kind==="players";
        let entitySubstringAvailable=queryLength<3;
        let playerSubstringAvailable=queryLength<3;
        if(wantsEntities){
          try{
            const indexed=await env.DB.prepare(
              "SELECT d.entity_type,d.entity_key,d.title,d.subtitle,COALESCE((SELECT tag FROM alliances WHERE id=CAST(d.entity_key AS INTEGER)), '') AS alliance_tag,COALESCE((SELECT terrain FROM world_territories WHERE id=CAST(d.entity_key AS INTEGER)), '') AS territory_terrain,COALESCE((SELECT power FROM kingdoms WHERE id=CAST(d.entity_key AS INTEGER)),0) AS power,COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=CAST(d.entity_key AS INTEGER)), '') AS kingdom_alliance_tag,COALESCE((SELECT level FROM alliances WHERE id=CAST(d.entity_key AS INTEGER)),1) AS alliance_level,COALESCE((SELECT COUNT(*) FROM alliance_members WHERE alliance_id=CAST(d.entity_key AS INTEGER)),0) AS member_count,COALESCE((SELECT territory_count FROM alliances WHERE id=CAST(d.entity_key AS INTEGER)),0) AS territory_count,f.rank AS search_rank FROM game_search_fts f JOIN game_search_documents d ON d.id=f.rowid WHERE game_search_fts MATCH ? AND (?='all' OR d.entity_type=?) AND (d.entity_type<>'kingdom' OR (CAST(d.entity_key AS INTEGER)<>COALESCE((SELECT k.id FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id=?),-1))) ORDER BY f.rank LIMIT ?"
            ).bind(ftsQuery,kind,entityType,playerId,limit*4).all();
            if((indexed.results||[]).length)usedFts=true;
            for(const row of indexed.results||[]){
              if(row.entity_type==="kingdom")addResult({type:"kingdom",name:row.title,power:Number(row.power||0),allianceTag:row.kingdom_alliance_tag||""},row.search_rank);
              else if(row.entity_type==="alliance")addResult({type:"alliance",name:row.title,tag:row.alliance_tag,description:row.subtitle,level:Number(row.alliance_level||1),members:Number(row.member_count||0),territories:Number(row.territory_count||0)},row.search_rank);
              else if(row.entity_type==="territory")addResult({type:"territory",name:row.title,terrain:row.territory_terrain},row.search_rank);
              else if(row.entity_type==="skin")addResult({type:"skin",name:row.title,description:row.subtitle},row.search_rank);
            }
          }catch(error){console.warn("game_search_fts_unavailable",String(error?.message||error));}
          if(queryLength>=3){
            try{
              const partial=await env.DB.prepare(
                "SELECT d.entity_type,d.entity_key,d.title,d.subtitle,COALESCE((SELECT tag FROM alliances WHERE id=CAST(d.entity_key AS INTEGER)), '') AS alliance_tag,COALESCE((SELECT terrain FROM world_territories WHERE id=CAST(d.entity_key AS INTEGER)), '') AS territory_terrain,COALESCE((SELECT power FROM kingdoms WHERE id=CAST(d.entity_key AS INTEGER)),0) AS power,COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=CAST(d.entity_key AS INTEGER)), '') AS kingdom_alliance_tag,COALESCE((SELECT level FROM alliances WHERE id=CAST(d.entity_key AS INTEGER)),1) AS alliance_level,COALESCE((SELECT COUNT(*) FROM alliance_members WHERE alliance_id=CAST(d.entity_key AS INTEGER)),0) AS member_count,COALESCE((SELECT territory_count FROM alliances WHERE id=CAST(d.entity_key AS INTEGER)),0) AS territory_count,s.rank AS search_rank FROM game_search_substring_fts s JOIN game_search_documents d ON d.id=s.rowid WHERE game_search_substring_fts MATCH ? AND (?='all' OR d.entity_type=?) AND (d.entity_type<>'kingdom' OR (CAST(d.entity_key AS INTEGER)<>COALESCE((SELECT k.id FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id=?),-1))) ORDER BY s.rank LIMIT ?"
              ).bind(substringQuery,kind,entityType,playerId,limit*4).all();
              entitySubstringAvailable=true;
              if((partial.results||[]).length)usedFts=true;
              for(const row of partial.results||[]){
                if(row.entity_type==="kingdom")addResult({type:"kingdom",name:row.title,power:Number(row.power||0),allianceTag:row.kingdom_alliance_tag||""},row.search_rank);
                else if(row.entity_type==="alliance")addResult({type:"alliance",name:row.title,tag:row.alliance_tag,description:row.subtitle,level:Number(row.alliance_level||1),members:Number(row.member_count||0),territories:Number(row.territory_count||0)},row.search_rank);
                else if(row.entity_type==="territory")addResult({type:"territory",name:row.title,terrain:row.territory_terrain},row.search_rank);
                else if(row.entity_type==="skin")addResult({type:"skin",name:row.title,description:row.subtitle},row.search_rank);
              }
            }catch(error){entitySubstringAvailable=false;console.warn("game_search_substring_unavailable",String(error?.message||error));}
          }
          // Typo candidates are fetched only from the indexed trigram FTS table,
          // then strictly verified with bounded Damerau–Levenshtein distance.
          if(fuzzyQuery){
            try{
              const fuzzy=await env.DB.prepare(
                "SELECT d.entity_type,d.entity_key,d.title,d.subtitle,COALESCE((SELECT tag FROM alliances WHERE id=CAST(d.entity_key AS INTEGER)), '') AS alliance_tag,COALESCE((SELECT terrain FROM world_territories WHERE id=CAST(d.entity_key AS INTEGER)), '') AS territory_terrain,COALESCE((SELECT power FROM kingdoms WHERE id=CAST(d.entity_key AS INTEGER)),0) AS power,COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=CAST(d.entity_key AS INTEGER)), '') AS kingdom_alliance_tag,COALESCE((SELECT level FROM alliances WHERE id=CAST(d.entity_key AS INTEGER)),1) AS alliance_level,COALESCE((SELECT COUNT(*) FROM alliance_members WHERE alliance_id=CAST(d.entity_key AS INTEGER)),0) AS member_count,COALESCE((SELECT territory_count FROM alliances WHERE id=CAST(d.entity_key AS INTEGER)),0) AS territory_count,s.rank AS search_rank FROM game_search_substring_fts s JOIN game_search_documents d ON d.id=s.rowid WHERE game_search_substring_fts MATCH ? AND (?='all' OR d.entity_type=?) AND (d.entity_type<>'kingdom' OR (CAST(d.entity_key AS INTEGER)<>COALESCE((SELECT k.id FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id=?),-1))) ORDER BY s.rank LIMIT ?"
              ).bind(fuzzyQuery,kind,entityType,playerId,Math.min(160,limit*8)).all();
              if((fuzzy.results||[]).length)usedFts=true;
              for(const row of fuzzy.results||[]){
                if(row.entity_type==="kingdom")addResult({type:"kingdom",name:row.title,power:Number(row.power||0),allianceTag:row.kingdom_alliance_tag||""},row.search_rank,true);
                else if(row.entity_type==="alliance")addResult({type:"alliance",name:row.title,tag:row.alliance_tag,description:row.subtitle,level:Number(row.alliance_level||1),members:Number(row.member_count||0),territories:Number(row.territory_count||0)},row.search_rank,true);
                else if(row.entity_type==="territory")addResult({type:"territory",name:row.title,terrain:row.territory_terrain},row.search_rank,true);
                else if(row.entity_type==="skin")addResult({type:"skin",name:row.title,description:row.subtitle},row.search_rank,true);
              }
            }catch(error){console.warn("game_search_typo_candidates_unavailable",String(error?.message||error));}
          }
          const hasType=type=>[...resultMap.values()].some(item=>item.type===type);
          const categoryLimit=kind==="all"?Math.max(1,Math.ceil(limit/5)):limit;
          if((kind==="all"||kind==="kingdoms")&&(!hasType("kingdom")||!entitySubstringAvailable||needsShortUnicodeFallback)){
              const current=await env.DB.prepare("SELECT k.id FROM kingdoms k JOIN players p ON p.id=k.player_id WHERE p.player_id=?").bind(playerId).first();
              const rows=await env.DB.prepare("SELECT k.kingdom_name,k.power,COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=k.id),'') AS alliance_tag FROM kingdoms k WHERE k.id<>? AND k.kingdom_name LIKE ? ESCAPE '!' COLLATE NOCASE ORDER BY CASE WHEN lower(k.kingdom_name)=? THEN 0 WHEN lower(k.kingdom_name) LIKE ? ESCAPE '!' THEN 1 ELSE 2 END,k.power DESC,k.kingdom_name LIMIT ?").bind(current?.id||-1,pattern,queryKey,prefixPattern,categoryLimit).all();
              for(const row of rows.results||[])addResult({type:"kingdom",name:row.kingdom_name,power:Number(row.power||0),allianceTag:row.alliance_tag||""});
            }
          if((kind==="all"||kind==="alliances")&&(!hasType("alliance")||!entitySubstringAvailable||needsShortUnicodeFallback)){
              const rows=await env.DB.prepare("SELECT a.name,a.tag,a.level,a.territory_count,COUNT(am.kingdom_id) AS member_count FROM alliances a LEFT JOIN alliance_members am ON am.alliance_id=a.id WHERE (a.name LIKE ? ESCAPE '!' COLLATE NOCASE OR a.tag LIKE ? ESCAPE '!' COLLATE NOCASE) GROUP BY a.id ORDER BY CASE WHEN lower(a.tag)=? THEN 0 WHEN lower(a.name)=? THEN 1 WHEN lower(a.tag) LIKE ? ESCAPE '!' THEN 2 ELSE 3 END,a.level DESC,a.name LIMIT ?").bind(pattern,pattern,queryKey,queryKey,prefixPattern,categoryLimit).all();
              for(const row of rows.results||[])addResult({type:"alliance",name:row.name,tag:row.tag,level:Number(row.level||1),members:Number(row.member_count||0),territories:Number(row.territory_count||0)});
            }
          if((kind==="all"||kind==="territories")&&(!hasType("territory")||!entitySubstringAvailable||needsShortUnicodeFallback)){
              const rows=await env.DB.prepare("SELECT name,terrain FROM world_territories WHERE (name LIKE ? ESCAPE '!' COLLATE NOCASE OR terrain LIKE ? ESCAPE '!' COLLATE NOCASE) ORDER BY level DESC,name LIMIT ?").bind(pattern,pattern,categoryLimit).all();
              for(const row of rows.results||[])addResult({type:"territory",name:row.name,terrain:row.terrain});
            }
          if((kind==="all"||kind==="skins")&&(!hasType("skin")||!entitySubstringAvailable||needsShortUnicodeFallback)){
              const rows=await env.DB.prepare("SELECT name FROM skins WHERE name LIKE ? ESCAPE '!' COLLATE NOCASE ORDER BY name LIMIT ?").bind(pattern,categoryLimit).all();
              for(const row of rows.results||[])addResult({type:"skin",name:row.name,description:"Skin cosmética"});
            }
        }
        if(wantsPlayers){
          try{
            const players=await env.DB.prepare(
              "SELECT n.nickname,k.kingdom_name,k.castle_level,k.power,COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=k.id),'') AS alliance_tag,f.rank AS search_rank FROM game_player_search_fts f JOIN player_nicknames n ON n.player_id=f.rowid JOIN kingdoms k ON k.player_id=n.player_id WHERE game_player_search_fts MATCH ? AND n.player_id<>(SELECT id FROM players WHERE player_id=?) ORDER BY f.rank LIMIT ?"
            ).bind(playerFtsQuery,playerId,limit*2).all();
            if((players.results||[]).length)usedFts=true;
            for(const row of players.results||[])addResult({type:"player",name:row.nickname,nickname:row.nickname,kingdom_name:row.kingdom_name,castle_level:Number(row.castle_level||1),power:Number(row.power||0),allianceTag:row.alliance_tag||""},row.search_rank);
          }catch(error){console.warn("game_player_search_fts_unavailable",String(error?.message||error));}
          if(queryLength>=3){
            try{
              const players=await env.DB.prepare(
                "SELECT n.nickname,k.kingdom_name,k.castle_level,k.power,COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=k.id),'') AS alliance_tag,f.rank AS search_rank FROM game_player_substring_fts f JOIN player_nicknames n ON n.player_id=f.rowid JOIN kingdoms k ON k.player_id=n.player_id WHERE game_player_substring_fts MATCH ? AND n.player_id<>(SELECT id FROM players WHERE player_id=?) ORDER BY f.rank LIMIT ?"
              ).bind(substringQuery,playerId,limit*2).all();
              playerSubstringAvailable=true;
              if((players.results||[]).length)usedFts=true;
              for(const row of players.results||[])addResult({type:"player",name:row.nickname,nickname:row.nickname,kingdom_name:row.kingdom_name,castle_level:Number(row.castle_level||1),power:Number(row.power||0),allianceTag:row.alliance_tag||""},row.search_rank);
            }catch(error){playerSubstringAvailable=false;console.warn("game_player_substring_unavailable",String(error?.message||error));}
          }
          // Player nickname typos use their dedicated trigram index and exclude self.
          if(fuzzyQuery){
            try{
              const fuzzyPlayers=await env.DB.prepare(
                "SELECT n.nickname,k.kingdom_name,k.castle_level,k.power,COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=k.id),'') AS alliance_tag,s.rank AS search_rank FROM game_player_substring_fts s JOIN player_nicknames n ON n.player_id=s.rowid JOIN kingdoms k ON k.player_id=n.player_id WHERE game_player_substring_fts MATCH ? AND n.player_id<>(SELECT id FROM players WHERE player_id=?) ORDER BY s.rank LIMIT ?"
              ).bind(fuzzyQuery,playerId,Math.min(160,limit*8)).all();
              if((fuzzyPlayers.results||[]).length)usedFts=true;
              for(const row of fuzzyPlayers.results||[])addResult({type:"player",name:row.nickname,nickname:row.nickname,kingdom_name:row.kingdom_name,castle_level:Number(row.castle_level||1),power:Number(row.power||0),allianceTag:row.alliance_tag||""},row.search_rank,true);
            }catch(error){console.warn("game_player_typo_candidates_unavailable",String(error?.message||error));}
          }
          const hasPlayers=[...resultMap.values()].some(item=>item.type==="player");
          if(!hasPlayers||!playerSubstringAvailable||needsShortUnicodeFallback){
            const players=await env.DB.prepare("SELECT n.nickname,k.kingdom_name,k.castle_level,k.power,COALESCE((SELECT a.tag FROM alliance_members am JOIN alliances a ON a.id=am.alliance_id WHERE am.kingdom_id=k.id),'') AS alliance_tag FROM player_nicknames n JOIN kingdoms k ON k.player_id=n.player_id WHERE n.player_id<>(SELECT id FROM players WHERE player_id=?) AND n.nickname_key LIKE ? ESCAPE '!' ORDER BY CASE WHEN n.nickname_key=? THEN 0 WHEN n.nickname_key LIKE ? ESCAPE '!' THEN 1 ELSE 2 END,k.power DESC,n.nickname_key LIMIT ?").bind(playerId,pattern,queryKey,prefixPattern,limit).all();
            for(const row of players.results||[])addResult({type:"player",name:row.nickname,nickname:row.nickname,kingdom_name:row.kingdom_name,castle_level:Number(row.castle_level||1),power:Number(row.power||0),allianceTag:row.alliance_tag||""});
          }
        }
        const results=[...resultMap.values()].sort((a,b)=>a._priority-b._priority||a._typos-b._typos||a._rank-b._rank||Number(b.power||0)-Number(a.power||0)||String(a.name).localeCompare(String(b.name),"pt-BR")).slice(0,limit).map(({_priority,_typos,_rank,...item})=>item);
        return json({query:rawQuery,results,count:results.length,engine:usedFts?"fts5+trigram":"like-fallback"});
      }
      if(url.pathname==="/api/game/action"&&request.method==="POST"){
        const playerLimit=await rateLimitDecision(env,"game-action-player",playerId,120,60);
        if(playerLimit)return playerLimit;
        const ip=request.headers.get("CF-Connecting-IP")||"unknown";
        const networkLimit=await rateLimitDecision(env,"game-action-network",ip,600,60);
        if(networkLimit)return networkLimit;
      }
      if(url.pathname.startsWith("/api/game/rally/")){
        const rallyPath=url.pathname.slice("/api/game/rally/".length);
        if(!["active","nodes","create","join","occupy","collect","recall"].includes(rallyPath))return json({error:"Rota de guerra não encontrada."},404);
        const isWrite=request.method==="POST";
        if(!isWrite&&request.method!=="GET")return json({error:"Método não permitido."},405);
        const playerLimit=await rateLimitDecision(env,isWrite?"rally-write-player":"rally-read-player",playerId,isWrite?20:120,60);
        if(playerLimit)return playerLimit;
        if(isWrite){
          const networkLimit=await rateLimitDecision(env,"rally-write-network",request.headers.get("CF-Connecting-IP")||"unknown",120,60);
          if(networkLimit)return networkLimit;
        }
        const rallyBody=isWrite?await readBody(request,8192):{};
        if(rallyBody.__bodyError)return json({error:"Solicitação de guerra inválida."},rallyBody.__bodyError==="payload_too_large"?413:400);
        return await handleRally(request,env,playerId,rallyPath,rallyBody);
      }
      if(url.pathname==="/api/game/state"&&request.method==="GET"){
        const state=await gameState(env,playerId);return state?json({state}):json({error:"Reino não encontrado."},404);
      }
      if(url.pathname==="/api/game/action"&&request.method==="POST"){const body=await readBody(request);if(body.__bodyError)return json({error:body.__bodyError==="payload_too_large"?"Requisição muito grande.":"JSON inválido."},body.__bodyError==="payload_too_large"?413:400);return await gameAction(env,playerId,body);}
      return json({error:"Rota de jogo não encontrada."},404);
    }catch(e){console.error("game_request_failed",String(e?.message||e));return json({error:"Falha ao processar o jogo. Tente novamente."},500)}
  }
  const valhallaAdminPath=url.pathname.startsWith("/api/valhalla-admin/");
  if(request.method!=="POST"&&!(request.method==="GET"&&valhallaAdminPath))return json({error:"Método não permitido."},405);
  const body=request.method==="POST"?await readBody(request):{};if(body.__bodyError)return json({error:body.__bodyError==="payload_too_large"?"Requisição muito grande.":"JSON inválido."},body.__bodyError==="payload_too_large"?413:400);
  if(url.pathname==="/api/admin/login"){
    if(!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return json({error:"Configure ADMIN_EMAIL, ADMIN_PASSWORD e SESSION_SECRET nos segredos do Worker."},503);
    const ip=request.headers.get("CF-Connecting-IP")||"unknown";
    const email=String(body.email||"").trim().toLowerCase().slice(0,254)||"empty";
    const ipLimit=await rateLimitDecision(env,"admin-login-ip",ip,10,900);
    if(ipLimit)return ipLimit;
    const accountLimit=await rateLimitDecision(env,"admin-login-account",email,5,900);
    if(accountLimit)return accountLimit;
    if(email!==String(env.ADMIN_EMAIL).trim().toLowerCase()||body.password!==env.ADMIN_PASSWORD)return json({error:"E-mail ou senha incorretos."},401);
    const token=await sign({sub:"admin",scope:"admin",exp:Math.floor(Date.now()/1000)+28800},env.SESSION_SECRET);return json({token,expiresIn:28800});
  }
  const auth=request.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
  const payload=env.SESSION_SECRET?await verify(token,env.SESSION_SECRET):false;
  if(!payload||payload.scope!=="admin")return json({error:"Sessão administrativa inválida ou expirada."},401);
  try{
    if(valhallaAdminPath){
      const scope=request.method==="GET"?"valhalla-admin-read":"valhalla-admin-write";
      const limited=await rateLimitDecision(env,scope,"master",request.method==="GET"?120:30,60);
      if(limited)return limited;
      return await handleValhallaAdmin(request,env,body);
    }
    if(url.pathname==="/api/admin/purchase-requests"){
      const rows=await env.DB.prepare("SELECT r.id,r.product_kind,r.product_name,r.price_brl,r.currency,r.gems_amount,r.payment_method,r.payment_reference,r.status,r.created_at,p.player_id,p.name AS player_name,k.kingdom_name FROM purchase_requests r JOIN players p ON p.id=r.player_id JOIN kingdoms k ON k.id=r.kingdom_id WHERE r.status='pending' ORDER BY r.created_at ASC LIMIT 100").all();
      return json({requests:rows.results||[]});
    }
    if(url.pathname==="/api/admin/purchase-requests/review"){
      const id=Number(body.requestId),decision=String(body.decision||"");
      if(!Number.isSafeInteger(id)||id<1||!["approve","reject"].includes(decision))return json({error:"Pedido ou decisão inválidos."},400);
      const pending=await env.DB.prepare("SELECT id,product_kind,product_id,product_name,player_id,gems_amount FROM purchase_requests WHERE id=? AND status='pending'").bind(id).first();
      if(!pending)return json({error:"Pedido já processado ou não encontrado."},409);
      let result;
      if(decision==="reject"){
        result=await env.DB.prepare("UPDATE purchase_requests SET status='rejected',reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin' WHERE id=? AND status='pending'").bind(id).run();
      }else if(pending.product_kind==="vip_package"){
        result=await env.DB.batch([
          env.DB.prepare("UPDATE purchase_requests SET status='approved',reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin' WHERE id=? AND status='pending' AND product_kind='vip_package'").bind(id),
          env.DB.prepare("UPDATE players SET gems=gems+? WHERE id=? AND changes()=1 AND EXISTS(SELECT 1 FROM purchase_requests WHERE id=? AND status='approved')").bind(pending.gems_amount,pending.player_id,id)
        ]);
        if(!result[0]?.meta?.changes)return json({error:"Pedido já processado."},409);
      }else{
        result=await env.DB.batch([
          env.DB.prepare("UPDATE purchase_requests SET status='approved',reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin' WHERE id=? AND status='pending' AND product_kind='skin'").bind(id),
          env.DB.prepare("INSERT OR IGNORE INTO player_skins(player_id,skin_id) SELECT player_id,product_id FROM purchase_requests WHERE id=? AND status='approved'").bind(id)
        ]);
        if(!result[0]?.meta?.changes)return json({error:"Pedido já processado."},409);
      }
      if(decision==="reject"&&!result.meta?.changes)return json({error:"Pedido já processado."},409);
      if(decision==="approve"){
        try{
          await queueEmailForInternalPlayer(env,pending.player_id,"purchase_confirmation",{
            request_id:id,product_name:pending.product_name,gems_amount:Number(pending.gems_amount||0)
          },{category:"transactional",idempotencyKey:"purchase:"+id});
        }catch(error){console.error("purchase_confirmation_email_queue_failed",id,String(error?.message||error));}
      }
      return json({success:true,message:decision==="approve"?"Pedido aprovado e pacote liberado.":"Pedido recusado."});
    }
    if(url.pathname==="/api/admin/player-search"){
      const query=String(body.query||body.playerId||"").trim().slice(0,64);
      if(!query)return json({error:"Informe o nickname ou ID do jogador."},400);
      const exact=await env.DB.prepare("SELECT id,player_id,name,gems,created_at FROM players WHERE player_id=? COLLATE NOCASE").bind(query).first();
      const players=exact?[exact]:(await env.DB.prepare("SELECT id,player_id,name,gems,created_at FROM players WHERE name LIKE ? COLLATE NOCASE OR player_id LIKE ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 20").bind("%"+query+"%","%"+query+"%").all()).results||[];
      return json({players,player:players[0]||null});
    }
    if(url.pathname==="/api/admin/gems"){
      const id=String(body.playerId||"").trim(),amount=Number(body.amount);
      if(!id||!Number.isSafeInteger(amount)||amount<=0||amount>100000000)return json({error:"ID ou quantidade de gemas inválida."},400);
      const result=await env.DB.prepare("UPDATE players SET gems=gems+? WHERE player_id=?").bind(amount,id).run();
      if(!result.meta.changes)return json({error:"Jogador não encontrado."},404);
      const player=await env.DB.prepare("SELECT player_id,gems FROM players WHERE player_id=?").bind(id).first();return json({success:true,player});
    }
    if(url.pathname==="/api/admin/unlock-skin"){
      const id=String(body.playerId||"").trim(),name=String(body.skin||"").trim();if(!id||!name)return json({error:"Informe o ID do jogador e a skin."},400);
      const player=await env.DB.prepare("SELECT id FROM players WHERE player_id=?").bind(id).first();if(!player)return json({error:"Jogador não encontrado."},404);
      const skin=await env.DB.prepare("SELECT id FROM skins WHERE name=?").bind(name).first();if(!skin)return json({error:"Skin não cadastrada no catálogo."},404);
      await env.DB.prepare("INSERT OR IGNORE INTO player_skins(player_id,skin_id) VALUES(?,?)").bind(player.id,skin.id).run();return json({success:true,message:"Skin liberada para o jogador."});
    }
    if(url.pathname==="/api/admin/vip-packages"){
      const name=String(body.name||"").trim(),price=Number(body.price),gems=Number(body.gems);
      if(!name||!Number.isFinite(price)||price<=0||!Number.isSafeInteger(gems)||gems<0)return json({error:"Dados do pacote VIP inválidos."},400);
      await env.DB.prepare("INSERT INTO vip_packages(name,price_brl,gems) VALUES(?,?,?)").bind(name,price,gems).run();return json({success:true,message:"Pacote VIP cadastrado."});
    }
    if(url.pathname==="/api/admin/skins"){
      const name=String(body.name||"").trim(),price=Number(body.price);if(!name||!Number.isFinite(price)||price<50||price>1000)return json({error:"Informe nome e preço entre R$ 50 e R$ 1.000."},400);
      const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM skins").first();if(count.total>=200)return json({error:"Limite de 200 skins atingido."},409);
      await env.DB.prepare("INSERT INTO skins(name,price_brl) VALUES(?,?)").bind(name,price).run();return json({success:true,message:"Skin cadastrada no catálogo."});
    }
    return json({error:"Rota administrativa não encontrada."},404);
  }catch(e){console.error("admin_request_failed",String(e?.message||e));return json({error:"Erro interno ao processar a solicitação."},500)}
 }
};
