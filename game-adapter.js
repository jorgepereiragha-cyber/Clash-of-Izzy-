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
  target.hp = Math.max(0, target.hp - Math.max(0, damage));
  target.quantity = Math.ceil(target.hp / target.hpPerUnit);
  return before - target.hp;
}

function selectTarget(stacks, attacker) {
  return stacks
    .filter(s => alive(s) && s.position <= attacker.position + attacker.range - 1)
    .sort((a, b) => a.position - b.position || a.index - b.index)[0] || null;
}

function attackPhase(acting, opposing, round, log, bonus = 0) {
  for (const unit of acting) {
    if (!alive(unit)) continue;
    const target = selectTarget(opposing, unit);
    if (!target) {
      unit.position = Math.min(20, unit.position + 1);
      continue;
    }
    const activeUnits = Math.min(unit.quantity, 40);
    const damage = Math.max(1, Math.floor(activeUnits * unit.power * 1.65 + bonus));
    const dealt = applyDamage(target, damage);
    if (log.length < 80) log.push({
      round, side: unit.side, unit: unit.key, target: target.key,
      damage: dealt, targetRemaining: target.quantity
    });
  }
}

export function simulateBattle({ army, castleLevel = 1, heroLevel = 1, dragonLevel = 1, researchLevel = 0, roll = 1 }) {
  const attackers = (army || [])
    .filter(row => Number(row.quantity) > 0)
    .map((row, index) => makeStack(row, "attacker", index));
  if (!attackers.length) throw new Error("Exército vazio.");

  const level = clamp(Math.floor(Number(castleLevel) || 1), 1, 30);
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
  let rounds = 0;

  for (let round = 1; round <= 30; round++) {
    rounds = round;
    attackPhase(attackers, defenders, round, log, heroBonus + dragonBonus + techBonus);
    attackPhase(defenders, attackers, round, log, 0);
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
    losses, log, survivors: attackers.reduce((sum, unit) => sum + unit.quantity, 0)
  };
}

export const COMBAT_UNIT_RULES = UNIT_RULES;
