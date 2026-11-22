import { EXPANSION_HERO_TEMPLATES } from "./hero-expansion.js";
import { HERO_IDENTITIES } from "./hero-identities.js";
const HERO_TEMPLATES = Object.freeze({
  soldado_basico:{name:"Darian Ferrovale",title:"Sentinela do Primeiro Muro",rarity:"white",type:"infantaria",portrait:"guard",stats:{hp:500,attack:80,defense:60,speed:30},skill:"Golpe Rápido",skillDesc:"Ataque básico simples",skillPower:1.2},
  arqueiro_comum:{name:"Lyria Falcobruma",title:"Batedora de Folhavento",rarity:"white",type:"arqueiro",portrait:"archer",stats:{hp:400,attack:100,defense:40,speed:45},skill:"Flecha Simples",skillDesc:"Disparo básico",skillPower:1.3},
  cavaleiro_iniciante:{name:"Torven Galopardo",title:"Escudeiro da Aurora",rarity:"white",type:"cavalaria",portrait:"knight",stats:{hp:600,attack:90,defense:70,speed:50},skill:"Investida",skillDesc:"Carga básica",skillPower:1.4},
  curandeiro_aldeia:{name:"Elara Ervalume",title:"Curadora do Vale Azul",rarity:"white",type:"suporte",portrait:"healer",stats:{hp:450,attack:50,defense:50,speed:35},skill:"Cura Menor",skillDesc:"Restaura pouca vida",skillPower:1.1},
  capitao_espada:{name:"Rovan Brasaferro",title:"Capitão do Bastião",rarity:"blue",type:"infantaria",portrait:"commander",stats:{hp:1200,attack:180,defense:140,speed:40},skill:"Corte Devastador",skillDesc:"Ataque poderoso em área",skillPower:2},
  mestre_arco:{name:"Serin Longavento",title:"Olho do Carvalho",rarity:"blue",type:"arqueiro",portrait:"master-archer",stats:{hp:900,attack:220,defense:80,speed:60},skill:"Chuva de Flechas",skillDesc:"Múltiplos disparos",skillPower:2.2},
  cavaleiro_dragao:{name:"Veyron Escamaforte",title:"Guardião da Brasa Alta",rarity:"blue",type:"cavalaria",portrait:"dragon-knight",stats:{hp:1400,attack:200,defense:160,speed:70},skill:"Sopro de Fogo",skillDesc:"Ataque flamejante",skillPower:2.5},
  sacerdotisa_luar:{name:"Maelis Pratalua",title:"Oráculo das Marés",rarity:"blue",type:"suporte",portrait:"moon-priestess",stats:{hp:1000,attack:120,defense:100,speed:50},skill:"Cura Lunar",skillDesc:"Cura poderosa em área",skillPower:1.8},
  rei_artur:{name:"Arthelion de Aurendal",title:"Soberano das Sete Lâminas",rarity:"purple",type:"infantaria",portrait:"arthur",stats:{hp:3500,attack:500,defense:400,speed:55},skill:"Lâmina do Juramento",skillDesc:"Lâmina ancestral de Aurendal causa dano massivo",skillPower:4.5},
  merlin_arquimago:{name:"Meridran Astrolume",title:"Arquiteto dos Arcanos",rarity:"purple",type:"suporte",portrait:"mage",stats:{hp:2800,attack:650,defense:250,speed:65},skill:"Meteoro Ancestral",skillDesc:"Invoca destruição dos céus",skillPower:5},
  joana_darc:{name:"Serah Valen",title:"Sentinela da Chama Viva",rarity:"purple",type:"infantaria",portrait:"valkyrie",stats:{hp:4000,attack:450,defense:550,speed:60},skill:"Fé Divina",skillDesc:"Proteção sagrada absoluta",skillPower:4},
  genghis_khan:{name:"Kharzun Ventobravo",title:"Senhor das Mil Selas",rarity:"purple",type:"cavalaria",portrait:"raider",stats:{hp:3200,attack:600,defense:300,speed:85},skill:"Horda Mongol",skillDesc:"Convoca exército de cavalaria",skillPower:4.8},
  kael_sunwarden:{name:"Kael",title:"Guardião do Sol",rarity:"blue",type:"infantaria",portrait:"kael",stats:{hp:1400,attack:250,defense:180,speed:64},skill:"Lâmina Solar",skillDesc:"Golpe de luz que fortalece a linha de frente",skillPower:2.1},
  amun_ra_solar:{name:"Amon-Rá",title:"Soberano do Disco Solar",rarity:"purple",type:"infantaria",portrait:"amun-ra",theme:"egypt",aura:"solar",stats:{hp:4100,attack:640,defense:430,speed:62},skill:"Presença do Meio-Dia",skillDesc:"Passivo de comandante: amplia o poder ofensivo da formação",skillPower:4.7},
  anubis_duat:{name:"Anúbis",title:"Guardião das Balanças do Duat",rarity:"purple",type:"infantaria",portrait:"anubis",theme:"egypt",aura:"duat",stats:{hp:4700,attack:430,defense:650,speed:50},skill:"Vigília do Duat",skillDesc:"Passivo de comandante: reforça a resistência da linha de frente",skillPower:4.5},
  isis_eternal_wings:{name:"Ísis",title:"Senhora das Asas Eternas",rarity:"purple",type:"suporte",portrait:"isis",theme:"egypt",aura:"wings",stats:{hp:4300,attack:520,defense:560,speed:60},skill:"Manto de Ísis",skillDesc:"Passivo de comandante: fortalece a proteção e a sobrevivência do exército",skillPower:4.6},
  horus_eternal_eye:{name:"Hórus",title:"Olho da Eternidade",rarity:"purple",type:"arqueiro",portrait:"horus",theme:"egypt",aura:"falcon",stats:{hp:3900,attack:700,defense:420,speed:70},skill:"Olho Celeste",skillDesc:"Passivo de comandante: favorece o ataque preciso e os golpes críticos",skillPower:4.8},
  sekhmet_crimson_lioness:{name:"Sekhmet",title:"A Leoa Carmesim",rarity:"purple",type:"cavalaria",portrait:"sekhmet",theme:"egypt",aura:"crimson",stats:{hp:4500,attack:690,defense:450,speed:76},skill:"Fúria da Leoa",skillDesc:"Passivo de comandante: intensifica o ataque de choque",skillPower:4.9},
  ...EXPANSION_HERO_TEMPLATES
});

const HERO_RARITY = Object.freeze({
  white:{label:"Branco · Comum",fragments:5,maxLevel:30,maxStars:5},
  blue:{label:"Azul · Raro",fragments:15,maxLevel:50,maxStars:6},
  purple:{label:"Roxo · Épico",fragments:40,maxLevel:70,maxStars:7},
  gold:{label:"Dourado · Lendário",fragments:65,maxLevel:90,maxStars:8}
});
const HERO_STAR_COST = Object.freeze({2:10,3:20,4:40,5:80,6:150,7:300,8:600});
const HERO_SUMMON_RARITY_ODDS = Object.freeze({white:55,blue:30,purple:13,gold:2});
export function getHeroSummonOdds() {
  const counts = Object.fromEntries(Object.keys(HERO_SUMMON_RARITY_ODDS).map(key => [key, 0]));
  for (const hero of Object.values(HERO_TEMPLATES)) {
    if (Object.hasOwn(counts, hero.rarity)) counts[hero.rarity]++;
  }
  return Object.entries(HERO_SUMMON_RARITY_ODDS).map(([rarity, chancePercent]) => ({
    rarity,
    chancePercent,
    heroCount: counts[rarity] || 0,
    perHeroPercent: counts[rarity] ? Number((chancePercent / counts[rarity]).toFixed(4)) : 0
  }));
}

const HERO_COMBAT_PROFILES = Object.freeze({
  soldado_basico:{attack:0.9,defense:0.5,health:0.2,critical:0},
  arqueiro_comum:{attack:1.2,defense:0.2,health:0,critical:0.35},
  cavaleiro_iniciante:{attack:0.8,defense:0.8,health:0.7,critical:0},
  curandeiro_aldeia:{attack:0.2,defense:0.7,health:1,critical:0},
  capitao_espada:{attack:1.6,defense:1.1,health:0.5,critical:0},
  mestre_arco:{attack:1.8,defense:0.2,health:0,critical:0.7},
  cavaleiro_dragao:{attack:2,defense:0.7,health:0.7,critical:0.15},
  sacerdotisa_luar:{attack:0.6,defense:1.2,health:1.5,critical:0},
  rei_artur:{attack:2,defense:1.8,health:1.3,critical:0.25},
  merlin_arquimago:{attack:2.2,defense:0.5,health:0.5,critical:1},
  joana_darc:{attack:1.3,defense:2.2,health:1.5,critical:0},
  genghis_khan:{attack:2.4,defense:0.4,health:0.3,critical:0.6},
  kael_sunwarden:{attack:2.2,defense:1.7,health:1,critical:0.15},
  odin_awakened:{attack:1.8,defense:1.8,health:1.2,critical:0.3},
  thor_ragnarok:{attack:2.8,defense:0.6,health:0.5,critical:0.4},
  freya_vanir:{attack:1.1,defense:1.7,health:1.6,critical:0.3},
  loki_chaos:{attack:2,defense:0.6,health:0.3,critical:1.2},
  valhalla_king:{attack:2,defense:1.8,health:1.5,critical:0.4},
  amun_ra_solar:{attack:2.6,defense:1.4,health:1.1,critical:0.4},
  anubis_duat:{attack:1.4,defense:2.8,health:2.3,critical:0.1},
  isis_eternal_wings:{attack:1.4,defense:2.2,health:2.4,critical:0.2},
  horus_eternal_eye:{attack:2.8,defense:1,health:0.7,critical:0.7},
  sekhmet_crimson_lioness:{attack:2.8,defense:1.2,health:1.1,critical:0.6}
});

const HERO_COMBAT_BANDS=Object.freeze({
 white:{attack:[0.6,2.5],defense:[0.6,2.5]},
 blue:{attack:[3.0,6.0],defense:[3.0,6.0]},
 purple:{attack:[7.0,11.0],defense:[7.0,11.0]},
 gold:{attack:[13.0,20.0],defense:[13.0,20.0]}
});
export function getHeroCombatBonuses(hero = {}) {
  const key=String(hero.hero_key||"");
  const profile=HERO_COMBAT_PROFILES[key] || {attack:1,defense:1,health:0.8,critical:0.2};
  const zero={attackPercent:0,defensePercent:0,healthPercent:0,criticalChancePercent:0};
  if(!HERO_TEMPLATES[key]&&!HERO_COMBAT_PROFILES[key])return zero;
  // Preserve rarity for old heroes rows (gold is stored as 'legendary' in the
  // legacy heroes table but is gold in the canonical template/inventory).
  const rarityKey=HERO_TEMPLATES[key]?.rarity||normalizedRarity(hero.rarity);
  const rarity=HERO_RARITY[rarityKey]||HERO_RARITY.white;
  const level=integerInRange(hero.level,1,1,rarity.maxLevel);
  const stars=integerInRange(hero.stars,1,1,rarity.maxStars);
  const levelProgress=rarity.maxLevel>1?(level-1)/(rarity.maxLevel-1):1;
  const starProgress=rarity.maxStars>1?(stars-1)/(rarity.maxStars-1):1;
  const progression=levelProgress*.62+starProgress*.38;
  // Deterministic small variation keeps each hero distinct without stacking
  // duplicate rarity multipliers or trusting a client-supplied percentage.
  const seed=[...key].reduce((n,ch)=>(n*31+ch.charCodeAt(0))%997,17)/997;
  const bands=HERO_COMBAT_BANDS[rarityKey]||HERO_COMBAT_BANDS.white;
  const value=(kind,offset)=>{
    const [min,max]=bands[kind];
    const variation=.3+.7*((seed+offset)%1);
    return Number((min+(max-min)*variation*(.25+.75*progression)).toFixed(2));
  };
  return {
    attackPercent:value("attack",0),
    defensePercent:value("defense",.37),
    healthPercent:Number((Math.max(0,profile.health)*(.45+.55*progression)).toFixed(2)),
    criticalChancePercent:Number((Math.max(0,profile.critical)*(.45+.55*progression)).toFixed(2))
  };
}

const SEASONAL_PORTRAITS = Object.freeze({
  odin_awakened:"odin",
  thor_ragnarok:"thor",
  freya_vanir:"freya",
  loki_chaos:"loki",
  valhalla_king:"valhalla-king"
});

const integerInRange = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
};

function parseStats(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizedRarity(value) {
  if (value === "white" || value === "blue" || value === "purple" || value === "gold") return value;
  if (value === "rare") return "blue";
  if (value === "legendary" || value === "mythic" || value === "epic") return "purple";
  return "white";
}

/**
 * Builds the player-facing hero card from the canonical inventory row.
 * Template base stats already encode the intended rarity tier; applying a
 * second 1.8x/3.5x rarity multiplier here double-counted rarity.
 */
export function heroView(row = {}) {
  const heroKey = String(row.hero_key || "");
  const template = HERO_TEMPLATES[heroKey] || null;
  const identity = HERO_IDENTITIES[heroKey] || null;
  // A ficha usa a raridade canônica do herói conhecido. Dados legados do D1
  // guardam alguns dourados como "legendary", que não deve virá-los roxos.
  const rarityKey = template?.rarity || normalizedRarity(row.rarity);
  const rarity = HERO_RARITY[rarityKey];
  const level = integerInRange(row.level, 1, 1, rarity.maxLevel);
  const stars = integerInRange(row.stars, 1, 1, rarity.maxStars);
  const baseLevel = template ? 1 : integerInRange(row.seasonal_base_level, 1, 1, 100);
  const baseStats = template?.stats || parseStats(row.seasonal_stats_json) || parseStats(row.stats_json);
  const progressionMultiplier = 1 + Math.max(0, level - baseLevel) * 0.03 + (stars - 1) * 0.15;
  const stats = baseStats
    ? Object.fromEntries(Object.entries(baseStats).map(([key, value]) => {
        const numeric = Number(value);
        return [key, Number.isFinite(numeric) ? Math.floor(numeric * progressionMultiplier) : 0];
      }))
    : {};

  const seasonalRarity = row.seasonal_rarity;
  const rarityLabel = seasonalRarity === "mythic"
    ? "Mítico"
    : seasonalRarity === "legendary"
      ? "Lendário"
      : rarity.label;
  const name = template?.name || row.seasonal_hero_name || row.hero_name || heroKey || "Herói do Reino";
  const title = template?.title || row.seasonal_description || row.hero_description || "Campeão de Eldoria";
  const portrait = template?.portrait || SEASONAL_PORTRAITS[heroKey] || "commander";
  const fragments = integerInRange(row.fragments, 0, 0, 100000000);

  return {
    ...row,
    name,
    title,
    type: template?.type || row.hero_type || "campeão",
    rarity_key: rarityKey,
    rarity_label: rarityLabel,
    max_level: rarity.maxLevel,
    max_stars: rarity.maxStars,
    level,
    stars,
    fragments,
    stats,
    skill: template?.skill || "Talento de Valhalla",
    skill_description: template?.skillDesc || row.seasonal_description || "Poder ancestral do reino.",
    skill_power: Number(template?.skillPower || 1),
    fragments_to_next: HERO_STAR_COST[stars + 1] || null,
    portrait_symbol: portrait,
    portrait_alt: name + " — " + title,
    theme_key: template?.theme || (identity?.faction==="Panteão das Areias"?"egypt":"eldoria"),
    aura_key: identity?.aura || template?.aura || null,
    aura_label: identity?.aura_label || null,
    identity_faction: identity?.faction || null,
    identity_lore: identity?.lore || null,
    identity_motto: identity?.motto || null,
    combat_bonuses: getHeroCombatBonuses({ ...row, hero_key: heroKey, rarity: row.rarity, level, stars })
  };
}

export { HERO_TEMPLATES, HERO_RARITY, HERO_STAR_COST, HERO_SUMMON_RARITY_ODDS };
