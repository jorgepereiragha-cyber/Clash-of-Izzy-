export function taskDurationSeconds(kind, level, quantity = 1, unit = "militia") {
  const n = Math.max(1, Number(level) || 1);
  if (kind === "construction") return Math.min(86400, Math.round(45 * Math.pow(n, 1.35)));
  if (kind === "research") return Math.min(86400, Math.round(60 * Math.pow(n + 1, 1.3)));
  const factor = {
    militia: 1, swordsman: 1.4, spearman: 1.2, archer: 1.3,
    crossbowman: 1.6, cavalry: 2.2, knight: 3, mage: 2.5,
    catapult: 5, ram: 4.5, trebuchet: 6
  };
  return Math.min(86400, Math.max(5, Math.round(quantity * 2 * (factor[unit] || 1))));
}
