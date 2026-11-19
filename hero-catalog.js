const HERO_TEMPLATES = Object.freeze({
  soldado_basico:{name:"Soldado Recruta",title:"Recruta do Reino",rarity:"white",type:"infantaria",portrait:"guard",stats:{hp:500,attack:80,defense:60,speed:30},skill:"Golpe Rápido",skillDesc:"Ataque básico simples",skillPower:1.2},
  arqueiro_comum:{name:"Arqueiro da Floresta",title:"Atirador Comum",rarity:"white",type:"arqueiro",portrait:"archer",stats:{hp:400,attack:100,defense:40,speed:45},skill:"Flecha Simples",skillDesc:"Disparo básico",skillPower:1.3},
  cavaleiro_iniciante:{name:"Cavaleiro Novato",title:"Montador Iniciante",rarity:"white",type:"cavalaria",portrait:"knight",stats:{hp:600,attack:90,defense:70,speed:50},skill:"Investida",skillDesc:"Carga básica",skillPower:1.4},
  curandeiro_aldeia:{name:"Curandeiro da Aldeia",title:"Médico Rural",rarity:"white",type:"suporte",portrait:"healer",stats:{hp:450,attack:50,defense:50,speed:35},skill:"Cura Menor",skillDesc:"Restaura pouca vida",skillPower:1.1},
  capitao_espada:{name:"Capitão da Guarda",title:"Líder Militar",rarity:"blue",type:"infantaria",portrait:"commander",stats:{hp:1200,attack:180,defense:140,speed:40},skill:"Corte Devastador",skillDesc:"Ataque poderoso em área",skillPower:2},
  mestre_arco:{name:"Mestre Arqueiro",title:"Atirador de Elite",rarity:"blue",type:"arqueiro",portrait:"master-archer",stats:{hp:900,attack:220,defense:80,speed:60},skill:"Chuva de Flechas",skillDesc:"Múltiplos disparos",skillPower:2.2},
  cavaleiro_dragao:{name:"Cavaleiro do Dragão",title:"Montador de Dragão",rarity:"blue",type:"cavalaria",portrait:"dragon-knight",stats:{hp:1400,attack:200,defense:160,speed:70},skill:"Sopro de Fogo",skillDesc:"Ataque flamejante",skillPower:2.5},
  sacerdotisa_luar:{name:"Sacerdotisa do Luar",title:"Curandeira Mística",rarity:"blue",type:"suporte",portrait:"moon-priestess",stats:{hp:1000,attack:120,defense:100,speed:50},skill:"Cura Lunar",skillDesc:"Cura poderosa em área",skillPower:1.8},
  rei_artur:{name:"Rei Artur",title:"O Rei Eterno",rarity:"purple",type:"infantaria",portrait:"arthur",stats:{hp:3500,attack:500,defense:400,speed:55},skill:"Excalibur",skillDesc:"Espada sagrada causa dano massivo",skillPower:4.5},
  merlin_arquimago:{name:"Merlin",title:"O Arquimago Supremo",rarity:"purple",type:"suporte",portrait:"mage",stats:{hp:2800,attack:650,defense:250,speed:65},skill:"Meteoro Ancestral",skillDesc:"Invoca destruição dos céus",skillPower:5},
  joana_darc:{name:"Joana D’Arc",title:"A Donzela de Ferro",rarity:"purple",type:"infantaria",portrait:"valkyrie",stats:{hp:4000,attack:450,defense:550,speed:60},skill:"Fé Divina",skillDesc:"Proteção sagrada absoluta",skillPower:4},
  genghis_khan:{name:"Genghis Khan",title:"O Flagelo de Deus",rarity:"purple",type:"cavalaria",portrait:"raider",stats:{hp:3200,attack:600,defense:300,speed:85},skill:"Horda Mongol",skillDesc:"Convoca exército de cavalaria",skillPower:4.8},
  kael_sunwarden:{name:"Kael",title:"Guardião do Sol",rarity:"blue",type:"infantaria",portrait:"kael",stats:{hp:1400,attack:250,defense:180,speed:64},skill:"Lâmina Solar",skillDesc:"Golpe de luz que fortalece a linha de frente",skillPower:2.1}
});

const HERO_RARITY = Object.freeze({
  white:{label:"Branco · Comum",fragments:5,maxLevel:30,maxStars:5},
  blue:{label:"Azul · Raro",fragments:15,maxLevel:50,maxStars:6},
  purple:{label:"Roxo · Lendário",fragments:40,maxLevel:70,maxStars:7}
});
const HERO_STAR_COST = Object.freeze({2:10,3:20,4:40,5:80,6:150,7:300});
const HERO_SUMMON_RARITY_ODDS = Object.freeze({white:70,blue:25,purple:5});
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
  valhalla_king:{attack:2,defense:1.8,health:1.5,critical:0.4}
});

export function getHeroCombatBonuses(hero = {}) {
  const key = String(hero.hero_key || "");
  const profile = HERO_COMBAT_PROFILES[key] || {attack:0,defense:0,health:0,critical:0};
  const rarity = HERO_RARITY[normalizedRarity(hero.rarity)];
  const level = integerInRange(hero.level, 1, 1, rarity.maxLevel);
  const stars = integerInRange(hero.stars, 1, 1, rarity.maxStars);
  const levelProgress = rarity.maxLevel > 1 ? (level - 1) / (rarity.maxLevel - 1) : 1;
  const starProgress = rarity.maxStars > 1 ? (stars - 1) / (rarity.maxStars - 1) : 1;
  const progression = 0.45 + levelProgress * 0.35 + starProgress * 0.20;
  return {
    attackPercent: Number((profile.attack * progression).toFixed(2)),
    defensePercent: Number((profile.defense * progression).toFixed(2)),
    healthPercent: Number((profile.health * progression).toFixed(2)),
    criticalChancePercent: Number((profile.critical * progression).toFixed(2))
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
  if (value === "white" || value === "blue" || value === "purple") return value;
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
  const rarityKey = normalizedRarity(row.rarity);
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
    combat_bonuses: getHeroCombatBonuses({ ...row, hero_key: heroKey, rarity: row.rarity, level, stars })
  };
}

export { HERO_TEMPLATES, HERO_RARITY, HERO_STAR_COST, HERO_SUMMON_RARITY_ODDS };
