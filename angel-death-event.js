import { COMBAT_UNIT_RULES } from "./game-adapter.js";

export const ANGEL_DEATH_EVENT = Object.freeze({
  key: "angel_of_death",
  name: "Anjo da Morte",
  epithet: "O Ceifador do Fim",
  level: 1000,
  timezone: "America/Sao_Paulo",
  bossHp: 12000000000,
  schedule: "Sexta-feira 18:00 até segunda-feira 00:00 (horário de Brasília)"
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const DAY_MS = 86400000;

function zonedParts(date) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: ANGEL_DEATH_EVENT.timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(values.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}

function zonedDateTimeToUtc(year, month, day, hour, minute, second = 0) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = zonedParts(new Date(guess));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += target - represented;
  }
  return new Date(guess);
}

function datePartsFromUtcDay(dayValue) {
  const date = new Date(dayValue);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function getAngelDeathWeekendWindow(now = new Date()) {
  const instant = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(instant.getTime())) throw new TypeError("Data inválida para o calendário do evento.");
  const local = zonedParts(instant);
  const localMidnight = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day));
  const weekday = new Date(localMidnight).getUTCDay();
  const daysSinceFriday = (weekday - 5 + 7) % 7;
  let friday = localMidnight - daysSinceFriday * DAY_MS;
  let start = zonedDateTimeToUtc(...Object.values(datePartsFromUtcDay(friday)), 18, 0, 0);
  let monday = datePartsFromUtcDay(friday + 3 * DAY_MS);
  let end = zonedDateTimeToUtc(monday.year, monday.month, monday.day, 0, 0, 0);
  if (instant.getTime() >= end.getTime()) {
    friday += 7 * DAY_MS;
    start = zonedDateTimeToUtc(...Object.values(datePartsFromUtcDay(friday)), 18, 0, 0);
    monday = datePartsFromUtcDay(friday + 3 * DAY_MS);
    end = zonedDateTimeToUtc(monday.year, monday.month, monday.day, 0, 0, 0);
  }
  return { startsAt: start.toISOString(), endsAt: end.toISOString(), timezone: ANGEL_DEATH_EVENT.timezone };
}

export function simulateAngelDeathAttack({ army, castleLevel = 1, heroLevel = 1, dragonLevel = 1, militaryLevel = 0, attackBonusPercent = 0, defenseBonusPercent = 0, seed = 1 }) {
  const stacks = (army || []).filter(row => Number(row.quantity) > 0 && COMBAT_UNIT_RULES[row.unit_type]);
  if (!stacks.length) throw new Error("Selecione pelo menos uma tropa válida.");
  let totalPower = 0;
  let totalTroops = 0;
  for (const row of stacks) {
    const quantity = clamp(Math.floor(Number(row.quantity) || 0), 0, 50000);
    const tier = clamp(Math.floor(Number(row.tier) || 1), 1, 10);
    totalPower += quantity * COMBAT_UNIT_RULES[row.unit_type].power * tier;
    totalTroops += quantity;
  }
  if (!totalTroops || totalTroops > 50000) throw new Error("Envie entre 1 e 50.000 tropas por ataque.");
  const bonus = 1
    + clamp(Number(castleLevel) || 1, 1, 30) * 0.01
    + clamp(Number(heroLevel) || 1, 1, 100) * 0.002
    + clamp(Number(dragonLevel) || 1, 1, 100) * 0.002
    + clamp(Number(militaryLevel) || 0, 0, 30) * 0.01
    + clamp(Number(attackBonusPercent) || 0, 0, 30) / 100;
  const damage = Math.max(1, Math.floor(totalPower * bonus * 18));
  let random = Number(seed) >>> 0;
  const nextRandom = () => {
    random = (Math.imul(random ^ (random >>> 15), 1 | random) + 0x6d2b79f5) | 0;
    let value = random;
    value = Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const baseLossRate = clamp(0.09 + clamp(Number(castleLevel) || 1, 1, 30) * 0.001 + nextRandom() * 0.03, 0.09, 0.18);
  const lossRate = clamp(baseLossRate * (1 - clamp(Number(defenseBonusPercent) || 0, 0, 30) / 200), 0.09, 0.18);
  // Define as baixas sobre o exército inteiro, e só depois distribui por pilha.
  // Isso impede que dividir a mesma força em várias pilhas aumente artificialmente as perdas.
  const totalLosses = Math.min(totalTroops, Math.max(1, Math.floor(totalTroops * lossRate)));
  const allocations = stacks.map((row, index) => {
    const quantity = clamp(Math.floor(Number(row.quantity) || 0), 0, 50000);
    const exactLoss = totalLosses * quantity / totalTroops;
    const loss = Math.floor(exactLoss);
    return {
      row,
      quantity,
      loss,
      remainder: exactLoss - loss,
      tieBreak: nextRandom(),
      index
    };
  });
  let unassignedLosses = totalLosses - allocations.reduce((sum, entry) => sum + entry.loss, 0);
  allocations.sort((left, right) =>
    right.remainder - left.remainder || left.tieBreak - right.tieBreak || left.index - right.index
  );
  for (let index = 0; index < unassignedLosses; index++) allocations[index].loss += 1;

  const losses = {};
  for (const entry of allocations) {
    const key = entry.row.unit_type + "_" + clamp(Math.floor(Number(entry.row.tier) || 1), 1, 10);
    losses[key] = (losses[key] || 0) + entry.loss;
  }
  const troopsLost = Object.values(losses).reduce((sum, loss) => sum + loss, 0);
  return { damage, score: damage, totalPower, totalTroops, losses, troopsLost, lossRate };
}

export function angelDeathRewardForRank(rank) {
  const position = Math.max(1, Math.floor(Number(rank) || 1));
  if (position === 1) return { gems: 12000, food: 5000000, wood: 5000000, stone: 3000000, iron: 1000000, gold: 5000000, deathEssence: 500 };
  if (position === 2) return { gems: 9000, food: 4000000, wood: 4000000, stone: 2500000, iron: 800000, gold: 4000000, deathEssence: 350 };
  if (position === 3) return { gems: 7000, food: 3000000, wood: 3000000, stone: 2000000, iron: 600000, gold: 3000000, deathEssence: 250 };
  if (position <= 10) return { gems: 6000, food: 2000000, wood: 2000000, stone: 1500000, iron: 400000, gold: 2000000, deathEssence: 150 };
  if (position <= 50) return { gems: 3000, food: 1500000, wood: 1500000, stone: 1000000, iron: 300000, gold: 1000000, deathEssence: 100 };
  if (position <= 100) return { gems: 1000, food: 1000000, wood: 1000000, stone: 750000, iron: 200000, gold: 750000, deathEssence: 60 };
  return { gems: 100, food: 500000, wood: 500000, stone: 300000, iron: 100000, gold: 500000, deathEssence: 30 };
}
