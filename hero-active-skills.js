// Catálogo imutável de habilidades de heróis do Clash of Izzy.
// Os efeitos são calculados exclusivamente no Worker; o cliente só escolhe a habilidade.
export const HERO_ACTIVE_SKILLS = Object.freeze({
  kael_sunwarden: Object.freeze({ key: "solar_ward", name: "Égide Solar", description: "Fortalece ataque e proteção da tropa.", cooldownSeconds: 300, effects: Object.freeze({ attackPercent: 8, defensePercent: 16 }) }),
  soldado_basico: Object.freeze({ key: "quick_strike", name: "Golpe Rápido", description: "Uma investida curta aumenta o dano da infantaria.", cooldownSeconds: 180, effects: Object.freeze({ attackPercent: 15 }) }),
  arqueiro_comum: Object.freeze({ key: "piercing_volley", name: "Rajada Perfurante", description: "Aprimora o ataque à distância e os acertos críticos.", cooldownSeconds: 240, effects: Object.freeze({ attackPercent: 10, criticalChancePercent: 8 }) }),
  cavaleiro_iniciante: Object.freeze({ key: "vanguard_charge", name: "Carga da Vanguarda", description: "A cavalaria avança com força e resistência adicionais.", cooldownSeconds: 240, effects: Object.freeze({ attackPercent: 18, healthPercent: 6 }) }),
  curandeiro_aldeia: Object.freeze({ key: "field_medic", name: "Socorro no Campo", description: "Reduz perdas ao reforçar a resistência do exército.", cooldownSeconds: 300, effects: Object.freeze({ defensePercent: 10, healthPercent: 18 }) }),
  capitao_espada: Object.freeze({ key: "devastating_cut", name: "Corte Devastador", description: "Golpe pesado que amplia o poder ofensivo.", cooldownSeconds: 300, effects: Object.freeze({ attackPercent: 22 }) }),
  mestre_arco: Object.freeze({ key: "arrow_storm", name: "Chuva de Flechas", description: "Rajada coordenada com maior chance de crítico.", cooldownSeconds: 300, effects: Object.freeze({ attackPercent: 12, criticalChancePercent: 12 }) }),
  cavaleiro_dragao: Object.freeze({ key: "dragon_breath", name: "Sopro de Fogo", description: "Ataque dracônico reforça dano e vitalidade.", cooldownSeconds: 360, effects: Object.freeze({ attackPercent: 25, healthPercent: 8 }) }),
  sacerdotisa_luar: Object.freeze({ key: "lunar_blessing", name: "Bênção Lunar", description: "Protege e recupera a resistência das tropas.", cooldownSeconds: 360, effects: Object.freeze({ defensePercent: 16, healthPercent: 20 }) }),
  rei_artur: Object.freeze({ key: "excalibur", name: "Excalibur", description: "A lâmina sagrada libera uma poderosa ofensiva.", cooldownSeconds: 420, effects: Object.freeze({ attackPercent: 28, criticalChancePercent: 8 }) }),
  merlin_arquimago: Object.freeze({ key: "ancient_meteor", name: "Meteoro Ancestral", description: "Magia arcana amplifica o poder ofensivo.", cooldownSeconds: 420, effects: Object.freeze({ attackPercent: 30, criticalChancePercent: 6 }) }),
  joana_darc: Object.freeze({ key: "divine_faith", name: "Fé Divina", description: "Uma proteção sagrada aumenta defesa e vitalidade.", cooldownSeconds: 420, effects: Object.freeze({ defensePercent: 25, healthPercent: 25 }) }),
  genghis_khan: Object.freeze({ key: "mongol_horde", name: "Horda Mongol", description: "A investida da horda amplia ataque e chance crítica.", cooldownSeconds: 420, effects: Object.freeze({ attackPercent: 26, criticalChancePercent: 10 }) }),
  odin_awakened: Object.freeze({ key: "raven_sight", name: "Visão dos Corvos", description: "A sabedoria de Odin guia um ataque preciso e protegido.", cooldownSeconds: 480, effects: Object.freeze({ attackPercent: 24, defensePercent: 12, criticalChancePercent: 6 }) }),
  thor_ragnarok: Object.freeze({ key: "mjolnir_storm", name: "Tempestade de Mjölnir", description: "O trovão de Thor desencadeia um ataque devastador.", cooldownSeconds: 480, effects: Object.freeze({ attackPercent: 30, criticalChancePercent: 10 }) }),
  freya_vanir: Object.freeze({ key: "folkvangr_grace", name: "Graça de Fólkvangr", description: "A magia de Freyja reforça a defesa e a vida das tropas.", cooldownSeconds: 480, effects: Object.freeze({ defensePercent: 24, healthPercent: 24 }) }),
  loki_chaos: Object.freeze({ key: "chaos_illusion", name: "Ilusão do Caos", description: "Loki confunde o inimigo e amplia ataques críticos.", cooldownSeconds: 480, effects: Object.freeze({ attackPercent: 18, criticalChancePercent: 15 }) }),
  valhalla_king: Object.freeze({ key: "valhalla_command", name: "Comando de Valhalla", description: "A liderança ancestral equilibra ataque e resistência.", cooldownSeconds: 540, effects: Object.freeze({ attackPercent: 24, defensePercent: 20 }) })
});
export function getHeroActiveSkill(heroKey) {
  return HERO_ACTIVE_SKILLS[String(heroKey || "")] || null;
}
