export function buildOnboardingSteps(state = {}) {
  const buildings = Array.isArray(state.buildings) ? state.buildings : [];
  const troops = Number(state.totalTroops || 0);
  const research = Array.isArray(state.research) ? state.research : [];
  const battles = Array.isArray(state.battleReports) ? state.battleReports : [];
  const story = Array.isArray(state.storyProgress) ? state.storyProgress : [];
  return [
    { id: "first_upgrade", title: "Fortaleça seu castelo", description: "Melhore uma construção para desenvolver sua cidade.", done: buildings.some(item => Number(item.level || 0) >= 2), tab: "kingdom" },
    { id: "first_recruits", title: "Prepare seu exército", description: "Treine tropas até alcançar 40 unidades.", done: troops >= 40, tab: "army" },
    { id: "first_research", title: "Descubra uma tecnologia", description: "Conclua sua primeira pesquisa na Academia.", done: research.some(item => Number(item.level || 0) > 0), tab: "research" },
    { id: "first_battle", title: "Defenda seu território", description: "Participe da sua primeira batalha PvE.", done: battles.length > 0, tab: "army" },
    { id: "first_alliance", title: "Encontre aliados", description: "Entre ou crie uma aliança.", done: Boolean(state.alliance), tab: "alliance" },
    { id: "first_secret", title: "Investigue o segredo antigo", description: "Registre a primeira pista da Vigília do Véu.", done: story.some(item => item.campaign_key === "veil_archive" && item.step_key === "lens"), tab: "veil" }
  ];
}
