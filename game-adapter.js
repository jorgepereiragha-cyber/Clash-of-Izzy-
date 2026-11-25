// Adaptador de combate do Clash of Izzy.
// Converte as tropas persistidas no D1 para um simulador server-authoritative.
// Não depende de Unity nem de bibliotecas externas.
const UNIT_RULES = Object.freeze({
  militia:      { power: 2,  hp: 100, range: 1, lane: "front" },
  swordsman:    { power: 5,  hp: 150, range: 1, lane: "front" },
  spearman:     { power: 4,  hp: 130, range: 2, lane: "front" },
  archer:       { power: 5,  hp: 85,  range: 6, lane: "back" },
  crossbowman:  { power: 7,  hp: 95,  range: 7, lane: "back" },
  cavalry:      { power: 9,  hp: 180, range: 2, lane: "front" },
  knight:       { power: 14, hp: 240, range: 2, lane: "front" },
  mage:         { power: 12, hp: 90,  range: 8, lane: "back" },
  catapult:     { power: 22, hp: 260, range: 12, lane: "siege" },
  ram:          { power: 20, hp: 300, range: 2, lane: "siege" },
  trebuchet:    { power: 30, hp: 220, range: 14, lane: "siege" }
});

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Experimental server-owned ruleset. Legacy battles remain unchanged.
export function combatRulesVersion(env){
  return env?.ENVIRONMENT==="beta"&&env?.COMBAT_TACTICS_ENABLED==="true"?2:1;
}
const CLASS=Object.freeze({militia:"infantry",swordsman:"infantry",spearman:"infantry",archer:"ranged",crossbowman:"ranged",mage:"ranged",cavalry:"cavalry",knight:"cavalry",catapult:"siege",ram:"siege",trebuchet:"siege"});
const COUNTER=Object.freeze({infantry:"ranged",ranged:"cavalry",cavalry:"infantry"});
// Experimental research profile, consumed only in offline tactical simulations
// until Worker authority, research gates and live balance are homologated.
export const SPECIALIZED_SCIENCE_KEYS=Object.freeze({infantry:"science_infantry",ranged:"science_archers",cavalry:"science_cavalry",siege:"science_siege"});
export function specializedScienceAttackPercent(levels,unitType){
  if(!Object.hasOwn(CLASS,unitType)||!levels||typeof levels!=="object"||Array.isArray(levels))return 0;
  const key=SPECIALIZED_SCIENCE_KEYS[CLASS[unitType]];
  const level=Object.hasOwn(levels,key)?levels[key]:0;
  return Number.isSafeInteger(level)&&level>=0&&level<=10?level*0.3:0;
}
export function tacticalMultiplier(attacker,defender){
  const a=Object.hasOwn(CLASS,attacker)?CLASS[attacker]:null;
  const d=Object.hasOwn(CLASS,defender)?CLASS[defender]:null;
  return a&&d&&COUNTER[a]===d?1.15:1;
}
export function tacticalActiveUnits(quantity){
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>200000)return 0;
  return quantity<=40?quantity:Math.floor(Math.sqrt(40*quantity));
}
function canonicalArmy(rows){
  const stacks=new Map();let total=0;
  for(const row of rows||[]){
    if(!Object.hasOwn(UNIT_RULES,row?.unit_type)||!Number.isSafeInteger(row.quantity)||row.quantity<1||!Number.isSafeInteger(row.tier)||row.tier<1||row.tier>10)throw Error("Formação inválida.");
    total+=row.quantity;if(total>200000)throw Error("Capacidade tática excedida.");
    const key=row.unit_type+":"+row.tier;
    const current=stacks.get(key)||{unit_type:row.unit_type,tier:row.tier,quantity:0};
    current.quantity+=row.quantity;stacks.set(key,current);
  }
  const laneOrder={front:0,back:1,siege:2};
  return [...stacks.values()].sort((a,b)=>laneOrder[UNIT_RULES[a.unit_type].lane]-laneOrder[UNIT_RULES[b.unit_type].lane]||a.unit_type.localeCompare(b.unit_type,"en")||a.tier-b.tier);
}

function makeStack(row, side, index, rulesVersion=1) {
  const rule = UNIT_RULES[row.unit_type] || UNIT_RULES.militia;
  const quantity = clamp(Math.floor(Number(row.quantity) || 0), 0, rulesVersion===2?200000:100000);
  const tier = clamp(Math.floor(Number(row.tier) || 1), 1, 10);
  const hpPerUnit = rule.hp * tier;
  return {
    key: row.unit_type,
    side,
    index,
    quantity,
    initialQuantity: quantity,
    tier,
    hpPerUnit,
    hp: quantity * hpPerUnit,
    power: rule.power * tier,
    range: rule.range,
    position: side === "attacker" ? 1 : 1,
    lane: rule.lane
  };
}

function alive(stack) { return stack.hp > 0 && stack.quantity > 0; }

function applyDamage(target, damage) {
  const before = target.hp;
  const mitigation = clamp(Number(target.defenseBonusPercent) || 0, 0, 30) / 100;
  const effectiveDamage = damage > 0 ? Math.max(1, Math.floor(damage * (1 - mitigation))) : 0;
  target.hp = Math.max(0, target.hp - effectiveDamage);
  target.quantity = Math.ceil(target.hp / target.hpPerUnit);
  return before - target.hp;
}

function selectTarget(stacks, attacker) {
  return stacks
    .filter(s => alive(s) && s.position <= attacker.position + attacker.range - 1)
    .sort((a, b) => a.position - b.position || a.index - b.index)[0] || null;
}

function criticalRoll(seed, round, index, side) {
  let value = (Number(seed) >>> 0) ^ Math.imul(round, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b);
  if (side === "defender") value ^= 0xc2b2ae35;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function attackPhase(acting, opposing, round, log, bonus = 0, critical = {}, metrics = { criticalHits: 0 }, rulesVersion=1) {
  for (const unit of acting) {
    if (!alive(unit)) continue;
    const target = selectTarget(opposing, unit);
    if (!target) {
      unit.position = Math.min(20, unit.position + 1);
      continue;
    }
    const activeUnits = rulesVersion===2?tacticalActiveUnits(unit.quantity):Math.min(unit.quantity, 40);
    const criticalHit = Number(critical.chance) > 0 && criticalRoll(critical.seed, round, unit.index, unit.side) < Number(critical.chance) / 100;
    const baseDamage = (activeUnits * unit.power * 1.65 + bonus) * (rulesVersion===2?tacticalMultiplier(unit.key,target.key):1);
    const damage = Math.max(1, Math.floor(baseDamage * (criticalHit ? critical.multiplier : 1)));
    const dealt = applyDamage(target, damage);
    if (criticalHit) metrics.criticalHits++;
    if (log.length < 80) log.push({
      round, side: unit.side, unit: unit.key, target: target.key,
      damage: dealt, critical: criticalHit, targetRemaining: target.quantity
    });
  }
}

export function simulateBattle({ army, castleLevel = 1, defenderLevel = castleLevel, heroLevel = 1, dragonLevel = 1, researchLevel = 0, defenseBonusPercent = 0, equipmentAttackBonusPercent = 0, equipmentHealthBonusPercent = 0, skinAttackBonusPercent = 0, skinDefenseBonusPercent = 0, skinSetAttackBonusPercent = 0, skinSetDefenseBonusPercent = 0, skinSetHealthBonusPercent = 0, skinSetCriticalChancePercent = 0, heroAttackBonusPercent = 0, heroDefenseBonusPercent = 0, dragonAttackBonusPercent = 0, dragonDefenseBonusPercent = 0, castleVipAttackBonusPercent = 0, castleVipDefenseBonusPercent = 0, imperialAttackBonusPercent = 0, imperialDefenseBonusPercent = 0, imperialHealthBonusPercent = 0, heroHealthBonusPercent = 0, heroCriticalChancePercent = 0, infantryAttackBonusPercent = 0, criticalChancePercent = 0, criticalDamageMultiplier = 1.5, criticalSeed = 1, castlePowerBonusPercent, roll = 1, rulesVersion=1, experimentalScienceLevels=null }) {
  const attackers = (rulesVersion===2?canonicalArmy(army):(army || []).filter(row => Number(row.quantity) > 0))
    .map((row, index) => makeStack(row, "attacker", index, rulesVersion));
  const defenseBonus = clamp((Number(defenseBonusPercent) || 0) + clamp(Number(skinDefenseBonusPercent) || 0, 0, 2.5) + clamp(Number(skinSetDefenseBonusPercent) || 0, 0, 2.5) + clamp(Number(heroDefenseBonusPercent) || 0, 0, 20) + clamp(Number(dragonDefenseBonusPercent) || 0, 0, 5.5) + clamp(Number(castleVipDefenseBonusPercent) || 0, 0, 7) + clamp(Number(imperialDefenseBonusPercent) || 0, 0, 6), 0, 30);
  const attackGearBonus = clamp((Number(equipmentAttackBonusPercent) || 0) + clamp(Number(skinAttackBonusPercent) || 0, 0, 2.5) + clamp(Number(skinSetAttackBonusPercent) || 0, 0, 2.5) + clamp(Number(heroAttackBonusPercent) || 0, 0, 20) + clamp(Number(dragonAttackBonusPercent) || 0, 0, 5.5) + clamp(Number(castleVipAttackBonusPercent) || 0, 0, 3.5) + clamp(Number(imperialAttackBonusPercent) || 0, 0, 6), 0, 30) / 100;
  const infantryAttackBonus = clamp(Number(infantryAttackBonusPercent) || 0, 0, 30) / 100;
  const healthGearBonus = clamp((Number(equipmentHealthBonusPercent) || 0) + clamp(Number(skinSetHealthBonusPercent) || 0, 0, 2) + clamp(Number(heroHealthBonusPercent) || 0, 0, 3) + clamp(Number(imperialHealthBonusPercent) || 0, 0, 6), 0, 30) / 100;
  const castlePowerBonus = clamp(Number(castlePowerBonusPercent ?? castleLevel) || 0, 0, 30) / 100;
  for (const stack of attackers) {
    stack.defenseBonusPercent = defenseBonus;
    const isInfantry = ["militia", "swordsman", "spearman"].includes(stack.key);
    const scienceBonus=rulesVersion===2?specializedScienceAttackPercent(experimentalScienceLevels,stack.key)/100:0;
    // Keep global gear/imperial/science attack within the existing 30% cap.
    // The existing pet infantry modifier remains unchanged.
    const effectiveAttackBonus=Math.min(0.30,attackGearBonus+scienceBonus);
    stack.power = stack.power * (1 + castlePowerBonus) * (1 + effectiveAttackBonus) * (isInfantry ? (1 + infantryAttackBonus) : 1);
    stack.hpPerUnit = Math.floor(stack.hpPerUnit * (1 + castlePowerBonus) * (1 + healthGearBonus));
    stack.hp = stack.quantity * stack.hpPerUnit;
  }
  if (!attackers.length) throw new Error("Exército vazio.");

  const level = clamp(Math.floor(Number(defenderLevel) || 1), 1, 30);
  const defenders = [
    makeStack({ unit_type: "militia", tier: Math.max(1, Math.ceil(level / 8)), quantity: 18 + level * 7 }, "defender", 0),
    makeStack({ unit_type: "archer", tier: Math.max(1, Math.ceil(level / 10)), quantity: 5 + level * 3 }, "defender", 1),
    ...(level >= 10 ? [makeStack({ unit_type: "knight", tier: Math.max(1, Math.ceil(level / 12)), quantity: Math.floor(level / 2) }, "defender", 2)] : [])
  ];

  const heroBonus = clamp(Number(heroLevel) || 1, 1, 100) * 1.5;
  const dragonBonus = clamp(Number(dragonLevel) || 1, 1, 100) * 2;
  const techBonus = clamp(Number(researchLevel) || 0, 0, 30) * 2.5;
  const multiplier = clamp(Number(roll) || 1, 0.85, 1.15);
  const log = [];
  const metrics = { criticalHits: 0 };
  const critical = {
    chance: clamp((Number(criticalChancePercent) || 0) + clamp(Number(heroCriticalChancePercent) || 0, 0, 2) + clamp(Number(skinSetCriticalChancePercent) || 0, 0, 0.75), 0, 100),
    multiplier: clamp(Number(criticalDamageMultiplier) || 1.5, 1.25, 2.5),
    seed: Number(criticalSeed) >>> 0
  };
  let rounds = 0;

  for (let round = 1; round <= 30; round++) {
    rounds = round;
    attackPhase(attackers, defenders, round, log, heroBonus + dragonBonus + techBonus, critical, metrics, rulesVersion);
    attackPhase(defenders, attackers, round, log, 0, {}, metrics, rulesVersion);
    if (!attackers.some(alive) || !defenders.some(alive)) break;
  }

  // Aplica uma pequena variação de campanha ao relatório, sem alterar HP persistido.
  const attackerPower = Math.max(1, Math.floor(attackers.reduce((sum, u) => sum + u.initialQuantity * u.power, 0) + heroBonus * 8 + dragonBonus * 8 + techBonus * 8));
  const defenderPower = Math.max(1, Math.floor(defenders.reduce((sum, u) => sum + (u.initialQuantity * u.power), 0)));
  const attackersAlive = attackers.some(alive);
  const defendersAlive = defenders.some(alive);
  const won = attackersAlive && (!defendersAlive || (rounds >= 30 && attackerPower * multiplier >= defenderPower * 1.35));

  const losses = {};
  for (const unit of attackers) {
    const lost = clamp(unit.initialQuantity - unit.quantity, 0, unit.initialQuantity);
    losses[unit.key] = (losses[unit.key] || 0) + lost;
  }
  return {
    won, rounds, attackerPower: Math.floor(attackerPower * multiplier), defenderPower,
    ...(rulesVersion===2?{rulesVersion:2,defenderLosses:Object.fromEntries(defenders.map(u=>[u.key,u.initialQuantity-u.quantity]))}:{}),
    losses, log, criticalHits: metrics.criticalHits, survivors: attackers.reduce((sum, unit) => sum + unit.quantity, 0)
  };
}

/**
 * Aplica as baixas agregadas por tipo de unidade e devolve apenas sobreviventes.
 * As perdas são distribuídas entre stacks do mesmo tipo sem subtrair duas vezes.
 */
export function applyUnitLosses(army = [], losses = {}) {
  const remainingLosses = new Map();
  const survivors = {};
  for (const [key, raw] of Object.entries(losses || {})) {
    remainingLosses.set(key, Math.max(0, Math.floor(Number(raw) || 0)));
  }
  for (const unit of Array.isArray(army) ? army : []) {
    const key = String(unit?.unit_type || "");
    if (!key) continue;
    const quantity = Math.max(0, Math.floor(Number(unit.quantity) || 0));
    const pendingLosses = remainingLosses.get(key) || 0;
    const lost = Math.min(quantity, pendingLosses);
    remainingLosses.set(key, pendingLosses - lost);
    survivors[key] = (survivors[key] || 0) + quantity - lost;
  }
  return survivors;
}

export const COMBAT_UNIT_RULES = UNIT_RULES;


export function calculateMarchDuration(baseSeconds, speedBonusPercent = 0) {
  const base = Math.max(5, Math.floor(Number(baseSeconds) || 5));
  const speed = clamp(Number(speedBonusPercent) || 0, 0, 50);
  return Math.max(5, Math.ceil(base / (1 + speed / 100)));
}
