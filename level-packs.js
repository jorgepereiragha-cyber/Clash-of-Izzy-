// Pacotes de progressao 4X independentes do VIP. Valores em centavos de BRL.
// Valores P4-P8 alinhados ao protocolo de 22/11/2026; bloqueados ate validacao comercial e testes de pagamento.
export const LEVEL_PACKS = Object.freeze([
  { level: 10, phase: "P1", name: "Pacote Lord Iniciante", priceCents: 990, gems: 500, resources: { wood: 5000, food: 5000 } },
  { level: 20, phase: "P2", name: "Pacote Senhor Feudal", priceCents: 2990, gems: 2000, resources: { wood: 20000, stone: 10000, iron: 5000 } },
  { level: 30, phase: "P3", name: "Pacote Conde Soberano", priceCents: 5990, gems: 5000, resources: { wood: 50000, stone: 30000, iron: 15000, gold: 5000 } },
  { level: 40, phase: "P4", name: "Pacote Marques Real", priceCents: 9990, gems: 10000, resources: { wood: 100000, food: 50000, stone: 50000, iron: 25000, gold: 10000 } },
  { level: 50, phase: "P5", name: "Pacote Duque Imperial", priceCents: 14990, gems: 20000, resources: { wood: 200000, food: 100000, stone: 100000, iron: 50000, gold: 20000 } },
  { level: 60, phase: "P6", name: "Pacote Principe Soberano", priceCents: 19990, gems: 35000, resources: { wood: 350000, food: 150000, stone: 150000, iron: 75000, gold: 30000 } },
  { level: 70, phase: "P7", name: "Pacote Rei Supremo", priceCents: 29990, gems: 60000, resources: { wood: 500000, food: 250000, stone: 250000, iron: 100000, gold: 50000 } },
  { level: 80, phase: "P8", name: "Pacote Imperador Eterno", priceCents: 49990, gems: 100000, resources: { wood: 1000000, food: 500000, stone: 500000, iron: 200000, gold: 100000 } }
].map(pack => Object.freeze({ ...pack, resources: Object.freeze({
  wood: 0, food: 0, stone: 0, iron: 0, gold: 0, ...pack.resources
}) })));

export function getLevelPackByName(name) {
  return LEVEL_PACKS.find(pack => pack.name === name) || null;
}

export function getPackForLevel(playerLevel) {
  const level = Number(playerLevel);
  if (!Number.isSafeInteger(level) || level < 10) return null;
  return [...LEVEL_PACKS].reverse().find(pack => level >= pack.level) || null;
}

// Liberacao progressiva: a flag global nunca expoe sozinha a loja a todos.
export function levelPacksEnabledForPlayer(env, publicPlayerId) {
  if (env?.LEVEL_PACKS_ENABLED !== "true" || env?.GAME_4X_SYSTEMS_ENABLED !== "true") return false;
  if (env?.LEVEL_PACKS_PUBLIC_ENABLED === "true") return true;
  const allowlist = String(env?.LEVEL_PACKS_TEST_PLAYER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
  return Boolean(publicPlayerId) && allowlist.includes(String(publicPlayerId));
}

export function levelPackPriceApproved(env, pack) {
  return Boolean(pack) && (pack.level < 40 || env?.LEVEL_PACKS_PROPOSED_PRICES_APPROVED === "true");
}

export function publicLevelPack(pack, env) {
  return {
    phase: pack.phase,
    requiredLevel: pack.level,
    oneTime: true,
    resources: { ...pack.resources },
    priceProvisional: !levelPackPriceApproved(env, pack)
  };
}

export function levelPackMatchesOrder(pack, order) {
  return Boolean(pack) &&
    order.product_kind === "vip_package" &&
    order.product_name === pack.name &&
    Number.isSafeInteger(Number(order.product_id)) &&
    Number(order.product_id) > 0 &&
    Number(order.gems_amount) === pack.gems &&
    Math.round(Number(order.price_brl) * 100) === pack.priceCents;
}

// Chamar apenas dentro do batch transacional de uma order confirmada pelo provedor.
// A unicidade por (kingdom_id, pack_level) bloqueia concessoes repetidas mesmo
// quando outro pedido para o mesmo pacote for confirmado posteriormente.
export function levelPackGrantStatements(db, requestId, productId, pack) {
  return [
    db.prepare(
      "INSERT OR IGNORE INTO level_pack_claims(request_id,kingdom_id,pack_level) " +
      "SELECT id,kingdom_id,? FROM purchase_requests " +
      "WHERE id=? AND status='approved' AND product_kind='vip_package' " +
      "AND product_id=? AND product_name=? AND gems_amount=? AND ROUND(price_brl*100)=?"
    ).bind(pack.level, requestId, productId, pack.name, pack.gems, pack.priceCents),
    db.prepare(
      "UPDATE players SET gems=gems+? " +
      "WHERE id=(SELECT r.player_id FROM purchase_requests r JOIN level_pack_claims c ON c.request_id=r.id WHERE r.id=?) AND changes()=1"
    ).bind(pack.gems, requestId),
    db.prepare(
      "UPDATE kingdoms SET wood=wood+?,food=food+?,stone=stone+?,iron=iron+?,gold=gold+?,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=(SELECT kingdom_id FROM level_pack_claims WHERE request_id=?) AND changes()=1"
    ).bind(pack.resources.wood, pack.resources.food, pack.resources.stone,
      pack.resources.iron, pack.resources.gold, requestId)
  ];
}
