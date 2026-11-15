const UNIT_TRAINING_SECONDS = Object.freeze({
  militia: 2,
  swordsman: 3,
  spearman: 3,
  archer: 3,
  crossbowman: 4,
  cavalry: 6,
  knight: 8,
  mage: 7,
  catapult: 15,
  ram: 13,
  trebuchet: 18,
});

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

/**
 * Server-side, deterministic durations for the three persistent strategy lanes.
 * The Worker remains authoritative; the client only displays completes_at.
 */
export function calculateQueueDurationSeconds(queueType, options = {}) {
  const level = boundedInteger(options.level, 1, 1, 30);
  const quantity = boundedInteger(options.quantity, 1, 1, 100);
  const facilityLevel = boundedInteger(options.facilityLevel, 1, 1, 30);
  const researchLevel = boundedInteger(options.researchLevel, 0, 0, 30);

  if (queueType === "construction") {
    const facilityReduction = Math.min(0.35, (facilityLevel - 1) * 0.015);
    const researchReduction = Math.min(0.30, researchLevel * 0.02);
    return Math.max(30, Math.ceil(60 * Math.pow(level, 1.25) * (1 - facilityReduction) * (1 - researchReduction)));
  }

  if (queueType === "training") {
    const unitSeconds = UNIT_TRAINING_SECONDS[String(options.targetKey || "")];
    if (!unitSeconds) throw new TypeError("Tipo de tropa sem duração de treinamento.");
    const facilityReduction = Math.min(0.35, (facilityLevel - 1) * 0.015);
    return Math.max(15, Math.ceil(unitSeconds * quantity * (1 - facilityReduction)));
  }

  if (queueType === "research") {
    const academyReduction = Math.min(0.30, (facilityLevel - 1) * 0.02);
    return Math.max(60, Math.ceil(180 * Math.pow(level, 1.3) * (1 - academyReduction)));
  }

  throw new TypeError("Tipo de fila estratégica inválido.");
}
