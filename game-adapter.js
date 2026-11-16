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

function makeStack(row, side, index) {
  const rule = UNIT_RULES[row.unit_type] || UNIT_RULES.militia;
  const quantity = clamp(Math.floor(Number(row.quantity) || 0), 0, 100000);
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

function attackPhase(acting, opposing, round, log, bonus = 0, critical = {}, metrics = { criticalHits: 0 }) {
  for (const unit of acting) {
    if (!alive(unit) || unit.power <= 0) continue;
    const target = selectTarget(opposing, unit);
    if (!target) {
      unit.position = Math.min(20, unit.position + 1);
      continue;
    }
    const activeUnits = Math.min(unit.quantity, 40);
    const criticalHit = Number(critical.chance) > 0 && criticalRoll(critical.seed, round, unit.index, unit.side) < Number(critical.chance) / 100;
    const baseDamage = activeUnits * unit.power * 1.65 + bonus;
    const damage = Math.max(1, Math.floor(baseDamage * (criticalHit ? critical.multiplier : 1)));
    const dealt = applyDamage(target, damage);
    if (criticalHit) metrics.criticalHits++;
    if (log.length < 80) log.push({
      round, side: unit.side, unit: unit.key, target: target.key,
      damage: dealt, critical: criticalHit, targetRemaining: target.quantity
    });
  }
}

export function simulateBattle({ army, castleLevel = 1, defenderLevel = castleLevel, heroLevel = 1, dragonLevel = 1, researchLevel = 0, defenseBonusPercent = 0, equipmentAttackBonusPercent = 0, equipmentHealthBonusPercent = 0, infantryAttackBonusPercent = 0, criticalChancePercent = 0, criticalDamageMultiplier = 1.5, criticalSeed = 1, castlePowerBonusPercent, roll = 1 }) {
  const attackers = (army || [])
    .filter(row => Number(row.quantity) > 0)
    .map((row, index) => makeStack(row, "attacker", index));
  const defenseBonus = clamp(Number(defenseBonusPercent) || 0, 0, 30);
  const attackGearBonus = clamp(Number(equipmentAttackBonusPercent) || 0, 0, 30) / 100;
  const infantryAttackBonus = clamp(Number(infantryAttackBonusPercent) || 0, 0, 30) / 100;
  const healthGearBonus = clamp(Number(equipmentHealthBonusPercent) || 0, 0, 30) / 100;
  const castlePowerBonus = clamp(Number(castlePowerBonusPercent ?? castleLevel) || 0, 0, 30) / 100;
  for (const stack of attackers) {
    stack.defenseBonusPercent = defenseBonus;
    const isInfantry = ["militia", "swordsman", "spearman"].includes(stack.key);
    stack.power = stack.power * (1 + castlePowerBonus) * (1 + attackGearBonus) * (isInfantry ? (1 + infantryAttackBonus) : 1);
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
    chance: clamp(Number(criticalChancePercent) || 0, 0, 100),
    multiplier: clamp(Number(criticalDamageMultiplier) || 1.5, 1.25, 2.5),
    seed: Number(criticalSeed) >>> 0
  };
  let rounds = 0;

  for (let round = 1; round <= 30; round++) {
    rounds = round;
    attackPhase(attackers, defenders, round, log, heroBonus + dragonBonus + techBonus, critical, metrics);
    attackPhase(defenders, attackers, round, log, 0, {}, metrics);
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
    losses, log, criticalHits: metrics.criticalHits, survivors: attackers.reduce((sum, unit) => sum + unit.quantity, 0)
  };
}


// Combate entre dois reinos. O servidor fornece os exércitos persistidos e a vida
// atual da muralha; nenhuma composição de defesa é inventada pelo cliente.
export function simulatePvpBattle({
  army,
  defenderArmy = [],
  attackerCastleLevel = 1,
  defenderCastleLevel = 1,
  attackerDefenseBonusPercent = 0,
  defenderDefenseBonusPercent = 0,
  attackerAttackBonusPercent = 0,
  defenderAttackBonusPercent = 0,
  attackerHealthBonusPercent = 0,
  defenderHealthBonusPercent = 0,
  attackerFlatBonus = 0,
  defenderFlatBonus = 0,
  wallHp = 0,
  roll = 1,
  criticalChancePercent = 0,
  criticalDamageMultiplier = 1.5,
  criticalSeed = 1
}) {
  const attackers = (army || [])
    .filter(row => Number(row.quantity) > 0)
    .map((row, index) => makeStack(row, "attacker", index));
  if (!attackers.length) throw new Error("Exército atacante vazio.");

  const defenders = (defenderArmy || [])
    .filter(row => Number(row.quantity) > 0)
    .map((row, index) => makeStack(row, "defender", index + 1));

  const initialWallHp = clamp(Math.floor(Number(wallHp) || 0), 0, 100000000);
  let wall = null;
  if (initialWallHp > 0) {
    wall = makeStack({ unit_type: "militia", tier: 1, quantity: 1 }, "defender", 0);
    wall.key = "wall";
    wall.power = 0;
    wall.range = 0;
    wall.hpPerUnit = initialWallHp;
    wall.hp = initialWallHp;
    wall.initialHp = initialWallHp;
    wall.position = 1;
    wall.lane = "fortification";
    defenders.unshift(wall);
  }

  const applySideBonuses = (stacks, castleLevel, attackBonus, healthBonus, defenseBonus) => {
    const castleBonus = clamp(Number(castleLevel) || 1, 0, 30) / 100;
    const gearAttack = clamp(Number(attackBonus) || 0, 0, 50) / 100;
    const gearHealth = clamp(Number(healthBonus) || 0, 0, 50) / 100;
    const mitigation = clamp(Number(defenseBonus) || 0, 0, 40);
    for (const stack of stacks) {
      if (stack.key === "wall") {
        stack.defenseBonusPercent = mitigation;
        continue;
      }
      stack.power *= 1 + castleBonus + gearAttack;
      stack.hpPerUnit = Math.max(1, Math.floor(stack.hpPerUnit * (1 + castleBonus + gearHealth)));
      stack.hp = stack.quantity * stack.hpPerUnit;
      stack.defenseBonusPercent = mitigation;
    }
  };

  applySideBonuses(
    attackers,
    attackerCastleLevel,
    attackerAttackBonusPercent,
    attackerHealthBonusPercent,
    attackerDefenseBonusPercent
  );
  applySideBonuses(
    defenders,
    defenderCastleLevel,
    defenderAttackBonusPercent,
    defenderHealthBonusPercent,
    defenderDefenseBonusPercent
  );

  const multiplier = clamp(Number(roll) || 1, 0.85, 1.15);
  const critical = {
    chance: clamp(Number(criticalChancePercent) || 0, 0, 100),
    multiplier: clamp(Number(criticalDamageMultiplier) || 1.5, 1.25, 2.5),
    seed: Number(criticalSeed) >>> 0
  };
  const log = [];
  const metrics = { criticalHits: 0 };
  let rounds = 0;

  for (let round = 1; round <= 30; round++) {
    rounds = round;
    attackPhase(attackers, defenders, round, log, Math.max(0, Number(attackerFlatBonus) || 0), critical, metrics);
    attackPhase(defenders, attackers, round, log, Math.max(0, Number(defenderFlatBonus) || 0), {}, metrics);
    if (!attackers.some(alive) || !defenders.some(alive)) break;
  }

  const attackerPower = Math.max(1, Math.floor(
    attackers.reduce((sum, unit) => sum + unit.initialQuantity * unit.power, 0) +
    Math.max(0, Number(attackerFlatBonus) || 0) * 8
  ));
  const defenderPower = Math.max(1, Math.floor(
    defenders.filter(unit => unit.key !== "wall").reduce((sum, unit) => sum + unit.initialQuantity * unit.power, 0) +
    initialWallHp / 100 +
    Math.max(0, Number(defenderFlatBonus) || 0) * 8
  ));

  const attackersAlive = attackers.some(alive);
  const defendersAlive = defenders.some(alive);
  const won = attackersAlive && (
    !defendersAlive ||
    (rounds >= 30 && attackerPower * multiplier >= defenderPower * 1.35)
  );

  const losses = {};
  for (const unit of attackers) {
    const lost = clamp(unit.initialQuantity - unit.quantity, 0, unit.initialQuantity);
    losses[unit.key] = (losses[unit.key] || 0) + lost;
  }
  const defenderLosses = {};
  const defenderSurvivors = {};
  for (const unit of defenders) {
    if (unit.key === "wall") continue;
    const lost = clamp(unit.initialQuantity - unit.quantity, 0, unit.initialQuantity);
    defenderLosses[unit.key] = (defenderLosses[unit.key] || 0) + lost;
    defenderSurvivors[unit.key] = (defenderSurvivors[unit.key] || 0) + unit.quantity;
  }

  const attackerSurvivors = {};
  for (const unit of attackers) {
    attackerSurvivors[unit.key] = (attackerSurvivors[unit.key] || 0) + unit.quantity;
  }
  const wallRemainingHp = wall ? Math.max(0, wall.hp) : 0;
  const wallDamage = Math.max(0, initialWallHp - wallRemainingHp);
  return {
    won,
    rounds,
    attackerPower: Math.floor(attackerPower * multiplier),
    defenderPower,
    losses,
    defenderLosses,
    attackerSurvivors,
    defenderSurvivors,
    wallDamage,
    wallRemainingHp,
    log,
    criticalHits: metrics.criticalHits
  };
}

export const COMBAT_UNIT_RULES = UNIT_RULES;


export function calculateMarchDuration(baseSeconds, speedBonusPercent = 0) {
  const base = Math.max(5, Math.floor(Number(baseSeconds) || 5));
  const speed = clamp(Number(speedBonusPercent) || 0, 0, 50);
  return Math.max(5, Math.ceil(base / (1 + speed / 100)));
}
