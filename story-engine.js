export const STORY_CAMPAIGNS = Object.freeze({
  first_rift: Object.freeze({
    minCastleLevel: 3,
    steps: Object.freeze({
      offerings: Object.freeze({ previous: null }),
      field: Object.freeze({ previous: "offerings" }),
      mark: Object.freeze({ previous: "field" }),
      basilisk: Object.freeze({ previous: "mark" }),
      foundations: Object.freeze({ previous: "basilisk" })
    })
  }),
  veil_archive: Object.freeze({
    minCastleLevel: 1,
    steps: Object.freeze({
      lens: Object.freeze({ previous: null }),
      star: Object.freeze({ previous: "lens" }),
      ledger: Object.freeze({ previous: "star" })
    })
  })
});

export function validateStoryStep({ campaign, step, castleLevel, completed = new Set() }) {
  const definition = STORY_CAMPAIGNS[campaign];
  if (!definition) return { ok: false, error: "Campanha desconhecida." };
  const rule = definition.steps[step];
  if (!rule) return { ok: false, error: "Descoberta desconhecida." };
  if (Number(castleLevel || 1) < definition.minCastleLevel) {
    return { ok: false, error: `É necessário Castelo nível ${definition.minCastleLevel}.` };
  }
  if (rule.previous && !completed.has(rule.previous)) {
    return { ok: false, error: "Encontre primeiro a pista anterior desta sequência." };
  }
  return { ok: true, rule };
}
