// Safe, deterministic command HUD projection from server-owned kingdom state.
// No gameplay mutations, inferred rewards, or client-side resource calculations.
function finiteNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}
const ORDER_LABELS = Object.freeze({
  construction:"Construção",
  training:"Treinamento",
  research:"Pesquisa"
});
const TARGET_LABELS = Object.freeze({
  castle:"Castelo",barracks:"Quartel",farm:"Fazenda",quarry:"Pedreira",
  lumber_mill:"Serraria",iron_mine:"Mina de ferro",academy:"Academia",
  wall:"Muralha",hospital:"Hospital",watchtower:"Torre de vigia",
  stable:"Estábulo",archery_range:"Campo de arqueiros",
  siege_workshop:"Oficina de cerco",market:"Mercado",warehouse:"Armazém",
  militia:"Milícia",swordsman:"Espadachim",spearman:"Lanceiro",
  archer:"Arqueiro",crossbowman:"Besteiro",cavalry:"Cavalaria",
  knight:"Cavaleiro",mage:"Mago",catapult:"Catapulta",
  economy:"Economia",military:"Doutrina militar",defense:"Defesa"
});
export function summarizeKingdomCommand(detail = {}) {
  const kingdom = detail.kingdom || {};
  const orders = (Array.isArray(detail.queues) ? detail.queues : [])
    .filter(order => order && order.status === "running" && Object.hasOwn(ORDER_LABELS, order.queue_type))
    .slice(0, 40);
  const nextOrder = orders.slice().sort((a, b) => {
    const at = Date.parse(a.completes_at || "");
    const bt = Date.parse(b.completes_at || "");
    return (Number.isFinite(at) ? at : Infinity) - (Number.isFinite(bt) ? bt : Infinity);
  })[0] || null;
  const activeMarches = (Array.isArray(detail.marches) ? detail.marches : [])
    .filter(march => march && (march.status === "marching" || march.status === "traveling")).length;
  return {
    castleLevel:finiteNonNegativeInteger(kingdom.castle_level),
    power:finiteNonNegativeInteger(kingdom.power),
    armyCount:finiteNonNegativeInteger(detail.armyCount),
    troopCapacity:finiteNonNegativeInteger(detail.troopCapacity),
    activeMarches,
    activeOrderCount:orders.length,
    nextOrderLabel:nextOrder
      ? ORDER_LABELS[nextOrder.queue_type] + " · " + (TARGET_LABELS[nextOrder.target_key] || "Ordem em andamento")
      : "",
  };
}
