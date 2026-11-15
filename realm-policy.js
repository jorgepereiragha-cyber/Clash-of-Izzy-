export const REALM_OPENING_THRESHOLD = 1000;

/** O marco de 1.000 jogadores é obrigatório; abrir também exige pressão real de capacidade. */
export function evaluateRealmOpening({ registeredPlayers = 0, activePlayers = 0, capacityReached = false, sustainedQueue = false } = {}) {
  const registered = Math.max(0, Math.floor(Number(registeredPlayers) || 0));
  const active = Math.max(0, Math.floor(Number(activePlayers) || 0));
  const thresholdReached = registered >= REALM_OPENING_THRESHOLD;
  const demandReached = Boolean(capacityReached || sustainedQueue);
  return {
    eligible: thresholdReached && demandReached,
    registeredPlayers: registered,
    activePlayers: active,
    threshold: REALM_OPENING_THRESHOLD,
    remaining: Math.max(0, REALM_OPENING_THRESHOLD - registered),
    reason: !thresholdReached ? "Aguardando 1.000 jogadores válidos." : !demandReached ? "Manter a comunidade reunida no reino atual até haver pressão de capacidade." : "Pode abrir um novo reino."
  };
}
