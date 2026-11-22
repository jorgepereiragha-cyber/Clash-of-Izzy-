// Simulador determinístico e isolado. Nenhum saldo, tropa ou estado D1 é alterado.
const LIMIT = 50000;
const bounded = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(LIMIT, Math.max(0, Math.floor(number))) : fallback;
};

export function createSiegeScenario() {
  return Object.freeze({
    round: 0,
    gateHp: 1300,
    wallHp: 2200,
    towerHp: 600,
    ramHp: 880,
    infantryHp: 950,
    winner: null
  });
}

export function advanceSiegeTurn(snapshot, target = "gate") {
  if (target !== "gate" && target !== "wall") throw new RangeError("Alvo de cerco inválido.");
  const base = createSiegeScenario();
  const state = Object.fromEntries(Object.keys(base).map(key => [
    key, key === "winner" ? (snapshot?.winner === "attackers" || snapshot?.winner === "defenders" ? snapshot.winner : null)
      : bounded(snapshot?.[key], base[key])
  ]));
  if (state.winner || state.round >= 30) return { ...state, winner: state.winner || "defenders", events: [] };
  const round = state.round + 1;
  const oldGate = state.gateHp;
  const oldWall = state.wallHp;
  const oldTower = state.towerHp;
  const activeRams = Math.ceil(state.ramHp / 220);
  const ramDamage = activeRams * 85;
  if (target === "wall") state.wallHp = Math.max(0, state.wallHp - ramDamage);
  else state.gateHp = Math.max(0, state.gateHp - ramDamage);
  const breached = state.gateHp === 0 || state.wallHp === 0;
  if (breached && state.infantryHp > 0) {
    state.towerHp = Math.max(0, state.towerHp - Math.ceil(state.infantryHp / 90) * 21);
  }
  if (state.towerHp > 0) {
    // Torre protege a passagem; os defensores escolhem a ameaça mais próxima.
    const volley = 85;
    if (state.infantryHp > 0) state.infantryHp = Math.max(0, state.infantryHp - volley);
    else state.ramHp = Math.max(0, state.ramHp - volley);
  }
  const winner = breached && state.towerHp === 0 ? "attackers"
    : (!state.ramHp && !state.infantryHp) || round >= 30 ? "defenders" : null;
  return {
    ...state,
    round,
    winner,
    events: [
      { type: "ram", target, damage: target === "wall" ? oldWall - state.wallHp : oldGate - state.gateHp },
      { type: "infantry", damage: oldTower - state.towerHp },
      { type: "tower", damage: state.towerHp > 0 ? 85 : 0 }
    ]
  };
}
