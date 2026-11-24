// Projection-only onboarding for the existing 4X game. The Worker remains authoritative.
// No rewards, currencies, progress flags or gameplay actions are created here.
function natural(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
function directive(title, description, action, href, phase) {
  return Object.freeze({ title, description, action, href, phase });
}
export function projectRoyalJourney(detail = {}) {
  const kingdom = detail && typeof detail === "object" ? detail.kingdom : null;
  if (!kingdom || typeof kingdom !== "object") {
    return directive("Reino não sincronizado",
      "Aguarde a conexão antes de planejar ordens. Nenhuma ação é executada aqui.",
      "Ver cidade", "#city", "sync");
  }
  const level = natural(kingdom.castle_level);
  // A partial/invalid response must not be presented as a new level-1 kingdom.
  if (level < 1) {
    return directive("Reino não sincronizado",
      "Aguarde a conexão antes de planejar ordens. Nenhuma ação é executada aqui.",
      "Ver cidade", "#city", "sync");
  }
  const army = natural(detail.armyCount);
  const active = (Array.isArray(detail.queues) ? detail.queues : [])
    .filter(q => q && q.status === "running");
  const constructing = active.some(q => q.queue_type === "construction" && q.target_key === "castle");
  const training = active.some(q => q.queue_type === "training");
  if (level < 3) {
    if (constructing) return directive("Castelo em evolução",
      "Sua melhoria está em andamento. Confira o tempo restante no centro de operações.",
      "Acompanhar obra", "#queues", "castle-running");
    return directive("Fortaleça seu castelo",
      "Consulte os custos e inicie uma melhoria do castelo. Os recursos e o nível são validados no servidor.",
      "Ver construções", "#buildings", "castle");
  }
  if (army < 30) {
    if (training) return directive("Exército em formação",
      "O recrutamento está em andamento. As tropas só chegam após a conclusão no servidor.",
      "Acompanhar treino", "#queues", "army-running");
    return directive("Recrute suas primeiras tropas",
      "Organize um exército antes de avançar pelo mapa. Verifique capacidade, recursos e tempo.",
      "Treinar tropas", "#trainingForm", "army");
  }
  const marches = Array.isArray(detail.marches) ? detail.marches : [];
  const marching = marches.some(m => m && (m.status === "marching" || m.status === "traveling"));
  if (!marching) return directive("Explore o mapa de Eldoria",
    "Localize territórios, confira suas defesas e planeje marchas pelo mapa estratégico.",
    "Abrir mapa", "/world.html", "world");
  return directive("Organize sua aliança",
    "Com tropas em movimento, coordene seus próximos objetivos com outros comandantes.",
    "Ver alianças", "/alliance.html", "alliance");
}
