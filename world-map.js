const API = "/api";
const $ = id => document.getElementById(id);
const token = localStorage.getItem("coi_game_token") || sessionStorage.getItem("coi_game_token");
const RESOURCE = {
  food: { icon: "🌾", label: "Comida" },
  wood: { icon: "🪵", label: "Madeira" },
  stone: { icon: "🪨", label: "Pedra" },
  iron: { icon: "⛓️", label: "Ferro" },
  gold: { icon: "🪙", label: "Ouro" },
};
const TERRAIN = {
  forest: { icon: "🌲", label: "Floresta" },
  plains: { icon: "🌾", label: "Planície" },
  mountain: { icon: "⛰️", label: "Montanha" },
};
const UNIT_NAMES = {
  militia: "Milícia", swordsman: "Espadachim", spearman: "Lanceiro",
  archer: "Arqueiro", crossbowman: "Besteiro", cavalry: "Cavalaria",
  knight: "Cavaleiro", mage: "Mago", catapult: "Catapulta",
  ram: "Aríete", trebuchet: "Trabuquete",
};
let state = null;
let selectedTerritoryId = null;
const requestedTerritorySearch = new URLSearchParams(location.search).get("search") || "";
let requestedTerritoryApplied = false;
let selectedUnits = {};
let busy = false;

function setStatus(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function fmt(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
async function request(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Falha ao comunicar com o reino.");
  return data;
}
function territoryOwner(territory) {
  if (!territory.owner_kingdom_id) return "Território neutro";
  return Number(territory.owner_kingdom_id) === Number(state?.kingdom?.id)
    ? "Seu reino"
    : "Outro reino";
}
function getSelectedTerritory() {
  return (state?.territories || []).find(item => Number(item.id) === Number(selectedTerritoryId)) || null;
}
function renderResources() {
  const root = $("resources");
  root.replaceChildren();
  for (const [key, meta] of Object.entries(RESOURCE)) {
    const item = make("div", "resource");
    item.append(document.createTextNode(meta.icon + " " + meta.label));
    item.append(make("b", "", fmt(state.kingdom[key])));
    root.append(item);
  }
}
function renderMap() {
  const root = $("worldMap");
  root.querySelectorAll(".territory-pin").forEach(pin => pin.remove());
  for (const territory of state.territories || []) {
    const resource = RESOURCE[territory.resource_type] || { icon: "📍", label: "Território" };
    const terrain = TERRAIN[territory.terrain] || { icon: "🗺️", label: "Terreno" };
    const owner = territoryOwner(territory);
    const button = make("button", "territory-pin" +
      (owner === "Seu reino" ? " owned" : owner === "Outro reino" ? " enemy" : "") +
      (Number(territory.id) === Number(selectedTerritoryId) ? " selected" : ""));
    button.type = "button";
    button.style.left = clamp(50 + Number(territory.x || 0) * 0.9, 9, 91) + "%";
    button.style.top = clamp(50 - Number(territory.z || 0) * 0.9, 10, 90) + "%";
    button.setAttribute("aria-label", territory.name + ", " + terrain.label + ", " + owner);
    button.title = territory.name + " · " + resource.label + " · " + owner;
    button.append(make("span", "", resource.icon));
    button.append(make("small", "", territory.name));
    button.addEventListener("click", () => {
      selectedTerritoryId = territory.id;
      renderMap();
      renderDetails();
    });
    root.append(button);
  }
}
function addStat(root, label, value) {
  const stat = make("div", "stat");
  stat.append(make("span", "", label), make("b", "", value));
  root.append(stat);
}
function renderTroops() {
  const root = $("troops");
  root.replaceChildren();
  const available = (state.troops || []).filter(unit => Number(unit.tier) === 1 && Number(unit.quantity) > 0);
  const availableTypes = new Set(available.map(unit => unit.unit_type));
  for (const unitType of Object.keys(selectedUnits)) {
    if (!availableTypes.has(unitType)) delete selectedUnits[unitType];
  }
  if (!available.length) {
    root.append(make("div", "muted", "Você ainda não possui tropas disponíveis para marchar."));
    updateActionButtons();
    return;
  }
  for (const unit of available) {
    const row = make("div", "troop-row");
    const label = make("label", "", (UNIT_NAMES[unit.unit_type] || unit.unit_type) + " · " + fmt(unit.quantity));
    const input = make("input");
    input.type = "number";
    input.min = "0";
    input.max = String(unit.quantity);
    input.step = "1";
    input.inputMode = "numeric";
    input.setAttribute("aria-label", "Quantidade de " + (UNIT_NAMES[unit.unit_type] || unit.unit_type));
    const defaultValue = 0;
    input.value = String(selectedUnits[unit.unit_type] ?? defaultValue);
    selectedUnits[unit.unit_type] = clamp(Math.floor(Number(input.value) || 0), 0, Number(unit.quantity));
    input.addEventListener("input", () => {
      selectedUnits[unit.unit_type] = clamp(Math.floor(Number(input.value) || 0), 0, Number(unit.quantity));
      input.value = String(selectedUnits[unit.unit_type]);
      updateActionButtons();
    });
    row.append(label, input);
    root.append(row);
  }
  updateActionButtons();
}
function updateActionButtons() {
  const territory = getSelectedTerritory();
  const hasTroops = Object.values(selectedUnits).some(quantity => Number(quantity) > 0);
  const canVisit = Boolean(territory && territoryOwner(territory) !== "Outro reino");
  $("gather").disabled = busy || !canVisit || !hasTroops;
  $("scout").disabled = busy || !canVisit || !hasTroops;
  $("attack").disabled = busy || !territory || Boolean(territory.owner_kingdom_id) || !hasTroops;
}
function renderDetails() {
  const root = $("territoryDetails");
  root.replaceChildren();
  const territory = getSelectedTerritory();
  if (!territory) {
    root.append(make("div", "muted", "Escolha um ponto no mapa."));
    $("troops").replaceChildren();
    updateActionButtons();
    return;
  }
  const resource = RESOURCE[territory.resource_type] || { icon: "📍", label: "Recurso" };
  const terrain = TERRAIN[territory.terrain] || { icon: "🗺️", label: "Terreno" };
  root.append(make("div", "territory-title", resource.icon + " " + territory.name));
  root.append(make("p", "muted", territoryOwner(territory)));
  const grid = make("div", "detail-grid");
  addStat(grid, "Terreno", terrain.label);
  addStat(grid, "Recurso", resource.label);
  addStat(grid, "Produção", fmt(territory.resource_rate) + " / hora");
  addStat(grid, "Nível", fmt(territory.level || 1));
  root.append(grid);
  $("marchNotice").textContent = territory.owner_kingdom_id && territoryOwner(territory) === "Outro reino"
    ? "Este território pertence a outro jogador. Ações PvP ainda não estão habilitadas."
    : "Escolha as tropas e uma ação. O servidor confirma custos, disponibilidade e resultado.";
  renderTroops();
}
function renderMarches() {
  const root = $("marches");
  root.replaceChildren();
  const marches = state.marches || [];
  if (!marches.length) {
    root.append(make("div", "muted", "Nenhuma marcha registrada."));
    return;
  }
  const territories = new Map((state.territories || []).map(item => [Number(item.id), item.name]));
  for (const march of marches.slice(0, 10)) {
    const card = make("div", "march");
    const title = make("strong", "", (march.march_type || "Marcha").toUpperCase() + " · " + (territories.get(Number(march.target_territory_id)) || "Território"));
    const date = march.arrives_at ? new Date(march.arrives_at).toLocaleString("pt-BR") : "—";
    card.append(title, make("div", "muted", "Estado: " + march.status), make("div", "muted", "Chegada prevista: " + date));
    root.append(card);
  }
}
function render() {
  renderResources();
  renderMap();
  renderDetails();
  renderMarches();
}
async function refreshState() {
  const response = await request("/game/state");
  state = response.state || response;
  if (!state.kingdom) throw new Error("O servidor não retornou o reino.");
  if (requestedTerritorySearch && !requestedTerritoryApplied) {
    const normalize = value => String(value || "").normalize("NFKD").replace(/[\p{M}]/gu, "").toLocaleLowerCase("pt-BR");
    const needle = normalize(requestedTerritorySearch);
    const match = (state.territories || []).find(item => normalize(item.name).includes(needle));
    if (match) {
      selectedTerritoryId = match.id;
      $("marchNotice").textContent = "Território localizado pela busca global: " + match.name + ".";
    } else {
      $("marchNotice").textContent = "O território pesquisado não está entre os territórios atualmente visíveis no mapa.";
    }
    requestedTerritoryApplied = true;
  }
  if (!getSelectedTerritory() && state.territories?.length) selectedTerritoryId = state.territories[0].id;
  render();
}
async function sendMarch(marchType) {
  if (busy) return;
  const territory = getSelectedTerritory();
  const units = Object.fromEntries(Object.entries(selectedUnits).filter(([, quantity]) => Number(quantity) > 0));
  if (!territory || !Object.keys(units).length) return;
  busy = true;
  updateActionButtons();
  $("marchNotice").textContent = "Enviando ordem de marcha ao servidor…";
  try {
    const result = await request("/game/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "march", targetId: territory.id, marchType, units }),
    });
    selectedUnits = {};
    await refreshState();
    $("marchNotice").textContent = result.message || "Marcha registrada pelo servidor.";
    setStatus("● Reino sincronizado");
  } catch (error) {
    $("marchNotice").textContent = error.message;
    setStatus(error.message, true);
  } finally {
    busy = false;
    updateActionButtons();
  }
}
$("gather").addEventListener("click", () => sendMarch("gather"));
$("scout").addEventListener("click", () => sendMarch("scout"));
$("attack").addEventListener("click", () => sendMarch("attack"));

async function connect() {
  if (!token) {
    location.replace("/kingdom.html");
    return;
  }
  setStatus("Sincronizando territórios…");
  try {
    await refreshState();
    setStatus("● Reino sincronizado");
  } catch (error) {
    setStatus(error.message, true);
    $("marchNotice").textContent = error.message;
  }
}
connect();
