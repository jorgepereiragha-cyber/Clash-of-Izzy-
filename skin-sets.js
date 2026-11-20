// Conjuntos cosméticos equipáveis do Clash of Izzy.
// Os bônus são calculados no Worker e limitados globalmente para preservar o equilíbrio.
export const SKIN_SET_CATALOG = Object.freeze([
  {
    id: "egyptian_solar_court",
    name: "Corte Solar do Egito",
    theme: "Egito",
    subtitle: "Cinco relíquias dos deuses do Nilo",
    description: "O poder solar de Rá, a proteção do Duat e a fúria de Sekhmet.",
    icon: "☀️",
    items: [
      { id: "eg_ra_crown", name: "Diadema do Meio-Dia", slot: "head", slotLabel: "Coroa", icon: "☀️", price: 1400, rarity: "lendária", visual: "Ouro solar, lápis-lazúli e disco radiante" },
      { id: "eg_anubis_armor", name: "Égide do Guardião do Duat", slot: "body", slotLabel: "Armadura", icon: "𓃢", price: 1600, rarity: "lendária", visual: "Obsidiana negra, ouro antigo e inscrições funerárias" },
      { id: "eg_horus_blade", name: "Lança do Olho Celeste", slot: "weapon", slotLabel: "Arma", icon: "𓅃", price: 1500, rarity: "lendária", visual: "Aço dourado, penas de falcão e núcleo azul" },
      { id: "eg_isis_ankh", name: "Ankh das Asas Eternas", slot: "relic", slotLabel: "Relíquia", icon: "☥", price: 1300, rarity: "lendária", visual: "Ankh de ouro, asas azul-turquesa e gema azul" },
      { id: "eg_sekhmet_aura", name: "Aura da Leoa Carmesim", slot: "aura", slotLabel: "Aura", icon: "♨️", price: 1800, rarity: "mítica", visual: "Chamas rubras, poeira dourada e halo solar" }
    ],
    thresholds: [
      { pieces: 2, label: "Juramento do Nilo", bonuses: { defensePercent: 0.5 } },
      { pieces: 3, label: "Bênção das Duas Terras", bonuses: { attackPercent: 0.75, defensePercent: 0.5 } },
      { pieces: 5, label: "Ascensão do Panteão Solar", bonuses: { attackPercent: 2, defensePercent: 1.5, healthPercent: 1, criticalChancePercent: 0.5 } }
    ]
  },
  {
    id: "sumerian_first_light",
    name: "Aurora dos Anunnaki",
    theme: "Suméria",
    subtitle: "O primeiro fogo das cidades antigas",
    description: "Runas de argila, ouro martelado e a força dos rios primordiais.",
    icon: "𒀭",
    items: [
      { id: "su_enlil_crown", name: "Coroa dos Ventos de Enlil", slot: "head", slotLabel: "Coroa", icon: "🌬️", price: 1200, rarity: "lendária", visual: "Ouro envelhecido, zigurate e espirais de vento" },
      { id: "su_inanna_armor", name: "Manto Estelar de Inanna", slot: "body", slotLabel: "Armadura", icon: "⭐", price: 1500, rarity: "lendária", visual: "Bronze rosado, estrelas lapidadas e tecido púrpura" },
      { id: "su_enki_scepter", name: "Cetro das Águas de Enki", slot: "weapon", slotLabel: "Arma", icon: "🌊", price: 1400, rarity: "lendária", visual: "Cobre azul, ondas gravadas e pedra turquesa" },
      { id: "su_utu_disc", name: "Disco Solar de Utu", slot: "relic", slotLabel: "Relíquia", icon: "🌞", price: 1300, rarity: "lendária", visual: "Disco de bronze dourado com raios geométricos" },
      { id: "su_ninhursag_aura", name: "Aura da Montanha-Mãe", slot: "aura", slotLabel: "Aura", icon: "🏔️", price: 1700, rarity: "mítica", visual: "Pó de ouro, terra fértil e brilho verde-âmbar" }
    ],
    thresholds: [
      { pieces: 2, label: "Pacto de Uruk", bonuses: { healthPercent: 0.5 } },
      { pieces: 3, label: "Sabedoria das Tábuas", bonuses: { attackPercent: 0.5, defensePercent: 0.5 } },
      { pieces: 5, label: "Despertar dos Anunnaki", bonuses: { attackPercent: 1.5, defensePercent: 1, healthPercent: 1.5 } }
    ]
  },
  {
    id: "mesopotamian_ishtar_gate",
    name: "Portões de Ishtar",
    theme: "Mesopotâmia",
    subtitle: "O esplendor de Babilônia",
    description: "Azul profundo, leões de guarda, dragões mušḫuššu e bronze real.",
    icon: "🦁",
    items: [
      { id: "me_marduk_crown", name: "Coroa do Dragão de Marduk", slot: "head", slotLabel: "Coroa", icon: "🐉", price: 1450, rarity: "lendária", visual: "Lápis-lazúli, ouro e escamas do mušḫuššu" },
      { id: "me_ishtar_armor", name: "Couraça da Estrela de Ishtar", slot: "body", slotLabel: "Armadura", icon: "✴️", price: 1550, rarity: "lendária", visual: "Azul vitrificado, cobre e estrela de oito pontas" },
      { id: "me_gilgamesh_axe", name: "Machado do Rei Gilgamesh", slot: "weapon", slotLabel: "Arma", icon: "🪓", price: 1500, rarity: "lendária", visual: "Bronze real, marfim e gravações de cedro" },
      { id: "me_tiamat_scale", name: "Escama Abissal de Tiamat", slot: "relic", slotLabel: "Relíquia", icon: "🐲", price: 1350, rarity: "lendária", visual: "Cristal azul-escuro, pérolas e espiral oceânica" },
      { id: "me_nergal_aura", name: "Aura do Leão de Nergal", slot: "aura", slotLabel: "Aura", icon: "🔥", price: 1750, rarity: "mítica", visual: "Brasas de bronze, poeira azul e sombras de leões" }
    ],
    thresholds: [
      { pieces: 2, label: "Guardiões da Porta Azul", bonuses: { defensePercent: 0.5 } },
      { pieces: 3, label: "Realeza da Babilônia", bonuses: { attackPercent: 0.5, defensePercent: 0.75 } },
      { pieces: 5, label: "Império das Duas Margens", bonuses: { attackPercent: 1.5, defensePercent: 2, healthPercent: 1 } }
    ]
  },
  {
    id: "poseidon_abyssal_tide",
    name: "Maré Abissal de Poseidon",
    theme: "Grécia · Oceano",
    subtitle: "O domínio dos sete mares",
    description: "Tridente ancestral, coral de cristal e uma aura de tempestade marinha.",
    icon: "🔱",
    items: [
      { id: "po_poseidon_crown", name: "Diadema das Marés", slot: "head", slotLabel: "Coroa", icon: "🔱", price: 1450, rarity: "lendária", visual: "Prata marinha, conchas e safira" },
      { id: "po_amphitrite_armor", name: "Armadura de Anfitrite", slot: "body", slotLabel: "Armadura", icon: "🐚", price: 1550, rarity: "lendária", visual: "Escamas peroladas, coral e bronze marítimo" },
      { id: "po_trident", name: "Tridente da Fenda Oceânica", slot: "weapon", slotLabel: "Arma", icon: "🔱", price: 1650, rarity: "lendária", visual: "Metal azul-prateado e três cristais de água" },
      { id: "po_tethys_pearl", name: "Pérola de Tétis", slot: "relic", slotLabel: "Relíquia", icon: "🫧", price: 1300, rarity: "lendária", visual: "Pérola luminosa envolta em correntes de água" },
      { id: "po_abyss_aura", name: "Aura do Abismo Atlântico", slot: "aura", slotLabel: "Aura", icon: "🌊", price: 1850, rarity: "mítica", visual: "Arcos de ondas, espuma luminosa e relâmpagos azuis" }
    ],
    thresholds: [
      { pieces: 2, label: "Chamado das Correntes", bonuses: { healthPercent: 0.5, defensePercent: 0.25 } },
      { pieces: 3, label: "Proteção de Anfitrite", bonuses: { defensePercent: 1, healthPercent: 0.5 } },
      { pieces: 5, label: "Soberania dos Sete Mares", bonuses: { attackPercent: 1, defensePercent: 1.5, healthPercent: 1.5, criticalChancePercent: 0.25 } }
    ]
  }
]);

export const PANTHEON_SKIN_ITEMS = Object.freeze(
  Object.fromEntries(SKIN_SET_CATALOG.flatMap(set => set.items.map(item => [
    item.id,
    Object.freeze({ ...item, theme: set.theme, setId: set.id, setName: set.name, kind: "set" })
  ])))
);

const BONUS_CAPS = Object.freeze({
  attackPercent: 2.5,
  defensePercent: 2.5,
  healthPercent: 2,
  criticalChancePercent: 0.75
});

export function getSkinSetBonuses(equippedRows = []) {
  const equippedIds = new Set(
    (Array.isArray(equippedRows) ? equippedRows : [])
      .filter(row => row && row.equipped_slot)
      .map(row => String(row.item_id || ""))
  );
  const totals = { attackPercent: 0, defensePercent: 0, healthPercent: 0, criticalChancePercent: 0 };
  const activeSets = [];

  for (const set of SKIN_SET_CATALOG) {
    const pieces = set.items.filter(item => equippedIds.has(item.id)).length;
    const threshold = [...set.thresholds].reverse().find(entry => pieces >= entry.pieces);
    if (!threshold) continue;
    activeSets.push({
      id: set.id,
      name: set.name,
      pieces,
      requiredPieces: threshold.pieces,
      bonusName: threshold.label,
      bonuses: { ...threshold.bonuses }
    });
    for (const key of Object.keys(totals)) totals[key] += Number(threshold.bonuses[key] || 0);
  }

  for (const key of Object.keys(totals)) totals[key] = Math.min(BONUS_CAPS[key], Number(totals[key].toFixed(2)));
  return { ...totals, activeSets, caps: { ...BONUS_CAPS } };
}

export function buildSkinSetGallery(ownedRows = []) {
  const ownedById = new Map(
    (Array.isArray(ownedRows) ? ownedRows : []).map(row => [String(row.item_id), row])
  );
  const sets = SKIN_SET_CATALOG.map(set => {
    const items = set.items.map(item => {
      const row = ownedById.get(item.id);
      return {
        ...item,
        owned: Boolean(row),
        equipped: Boolean(row && row.equipped_slot === item.slot),
        equippedSlot: row?.equipped_slot || null
      };
    });
    const equippedCount = items.filter(item => item.equipped).length;
    const nextThreshold = set.thresholds.find(entry => equippedCount < entry.pieces) || null;
    const activeThreshold = [...set.thresholds].reverse().find(entry => equippedCount >= entry.pieces) || null;
    return {
      id: set.id,
      name: set.name,
      theme: set.theme,
      subtitle: set.subtitle,
      description: set.description,
      icon: set.icon,
      items,
      equippedCount,
      totalPieces: set.items.length,
      nextThreshold: nextThreshold ? { ...nextThreshold, bonuses: { ...nextThreshold.bonuses } } : null,
      activeThreshold: activeThreshold ? { ...activeThreshold, bonuses: { ...activeThreshold.bonuses } } : null
    };
  });
  return { sets, bonuses: getSkinSetBonuses(ownedRows) };
}
