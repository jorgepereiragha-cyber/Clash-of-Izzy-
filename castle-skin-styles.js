// Shared presentation-only palette for owned castle skins.
// The database remains authoritative for ownership and the equipped skin ID.
const CASTLE_SKINS = Object.freeze([
  Object.freeze({ name: "Fortaleza do Dragão Dourado", wall: "#b88743", roof: "#76291f", banner: "#f3cf72", accent: "#f0c46c" }),
  Object.freeze({ name: "Fortaleza do Dragão Imperial", wall: "#9a5260", roof: "#3e294f", banner: "#e2bd83", accent: "#d9a66a" }),
  Object.freeze({ name: "Fortaleza do Dragão Ancestral", wall: "#596575", roof: "#293b56", banner: "#d49a4a", accent: "#ebc17e" }),
  Object.freeze({ name: "Fortaleza do Dragão Místico", wall: "#8876ad", roof: "#33275d", banner: "#9bdbff", accent: "#d9c4ff" }),
  Object.freeze({ name: "Fortaleza do Dragão Lunar", wall: "#95b0c4", roof: "#2e587c", banner: "#e7f2fc", accent: "#c7e6f2" }),
  Object.freeze({ name: "Fortaleza do Dragão Solar", wall: "#c69a4b", roof: "#a63c22", banner: "#ffe18a", accent: "#fff0b3" })
]);

const normalizeSkinName = value => String(value || "")
  .normalize("NFKD")
  .replace(/\p{M}/gu, "")
  .toLocaleLowerCase("pt-BR")
  .trim();

export function getCastleSkinStyle(name, skinId = 0) {
  const normalized = normalizeSkinName(name);
  const exact = CASTLE_SKINS.find(style => normalizeSkinName(style.name) === normalized);
  if (exact) return exact;

  // Legacy owned skins remain equipable. Until each older asset gets its own
  // art pack, they receive a deterministic palette derived from their stable ID.
  const id = Number(skinId);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return CASTLE_SKINS[(id - 1) % CASTLE_SKINS.length] || null;
}
