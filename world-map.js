import { clampMapViewport, mapViewportTransform, nextMapZoom } from "./world-map-viewport.js";

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
let selectedUnits = {};
let busy = false;
let mapViewport = { zoom: 1, panX: 0, panY: 0 };
let mapPointer = null;
const requestedTerritorySearch = new URLSearchParams(location.search).get("search") || "";
let requestedTerritoryApplied = false;
const normalizeTerritorySearch = value => String(value || "").normalize("NFKD").replace(/[\p{M}]/gu, "").toLocaleLowerCase("pt-BR").trim();

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
function applyMapViewport(patch = {}) {
  const map = $("worldMap");
  const content = $("mapContent");
  if (!map || !content) return;
  mapViewport = clampMapViewport({
    ...mapViewport,
    ...patch,
    width: map.clientWidth,
    height: map.clientHeight,
  });
  content.style.transform = mapViewportTransform(mapViewport);
  $("mapScale").textContent = Math.round(mapViewport.zoom * 100) + "%";
}
function changeMapZoom(delta) {
  applyMapViewport({ zoom: nextMapZoom(mapViewport.zoom, delta) });
}
function resetMapViewport() {
  mapViewport = { zoom: 1, panX: 0, panY: 0 };
  applyMapViewport();
}
function renderMap() {
  const root = $("mapContent");
  root.querySelectorAll(".territory-pin").forEach(pin => pin.remove());
  const buttonRefs = new Map();
  for (const territory of state.territories || []) {
    const isCastle = territory.territory_kind === "castle";
    const resource = isCastle ? { icon: "🏰", label: "Castelo de jogador" } : (RESOURCE[territory.resource_type] || { icon: "📍", label: "Território" });
    const terrain = TERRAIN[territory.terrain] || { icon: "🗺️", label: "Terreno" };
    const owner = territoryOwner(territory);
    const button = make("button", "territory-pin" +
      (owner === "Seu reino" ? " owned" : owner === "Outro reino" ? " enemy" : "") +
      (isCastle ? " castle" : "") +
      (Number(territory.id) === Number(selectedTerritoryId) ? " selected" : ""));
    button.type = "button";
    button.dataset.territoryId = String(territory.id);
    button.style.left = clamp(50 + Number(territory.x || 0) * 0.9, 9, 91) + "%";
    button.style.top = clamp(50 - Number(territory.z || 0) * 0.9, 10, 90) + "%";
    button.setAttribute("aria-label", territory.name + ", " + (isCastle ? "castelo de " + (territory.commander_name || "outro comandante") : terrain.label) + ", " + owner);
    button.title = isCastle
      ? territory.name + " · " + (territory.commander_name || "Comandante") + " · poder " + fmt(territory.power)
      : territory.name + " · " + resource.label + " · " + owner;
    button.append(make("span", "", resource.icon));
    button.append(make("small", "", territory.name));
    button.addEventListener("click", () => {
      selectedTerritoryId = territory.id;
      renderMap();
      renderDetails();
    });
    buttonRefs.set(Number(territory.id), button);
    root.append(button);
  }
  const visualState = {
    territories: state.territories || [],
    marches: state.marches || [],
    kingdomId: state.kingdom?.id || 0
  };
  window.__coiWorldMapButtons = buttonRefs;
  window.__coiWorldMapState = visualState;
  if (window.__coiWorldMap3D) {
    window.__coiWorldMap3D.setProjectionButtons(buttonRefs);
    window.__coiWorldMap3D.update(visualState);
  }
  applyMapViewport();
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
  const isCastle = territory?.territory_kind === "castle";
  const owner = territory ? territoryOwner(territory) : "";
  const canVisit = Boolean(territory && !isCastle && owner !== "Outro reino");
  const canAttack = Boolean(territory && (
    (isCastle && owner === "Outro reino") ||
    (!isCastle && !territory.owner_kingdom_id)
  ));
  $("gather").disabled = busy || !canVisit || !hasTroops;
  $("scout").disabled = busy || !canVisit || !hasTroops;
  $("attack").disabled = busy || !canAttack || !hasTroops;
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
  const isCastle = territory.territory_kind === "castle";
  if (isCastle) {
    addStat(grid, "Comandante", territory.commander_name || "Comandante");
    addStat(grid, "Poder", fmt(territory.power));
    addStat(grid, "Nível do castelo", fmt(territory.castle_level || territory.level || 1));
    addStat(grid, "Muralha", fmt(territory.wall_hp) + " / " + fmt(territory.wall_max_hp));
    addStat(grid, "Defesa", fmt(territory.defense_power));
    if (territory.protection_until && Date.parse(territory.protection_until) > Date.now()) {
      addStat(grid, "Proteção", "Escudo ativo");
    }
    if (territory.alliance_tag) addStat(grid, "Aliança", "[" + territory.alliance_tag + "]");
  } else {
    addStat(grid, "Terreno", terrain.label);
    addStat(grid, "Recurso", resource.label);
    addStat(grid, "Produção", fmt(territory.resource_rate) + " / hora");
    addStat(grid, "Nível", fmt(territory.level || 1));
  }
  root.append(grid);
  $("marchNotice").textContent = isCastle
    ? "Castelo inimigo detectado. Selecione suas tropas e ataque; escudos e membros da sua aliança são protegidos pelo servidor."
    : territory.owner_kingdom_id && territoryOwner(territory) === "Outro reino"
      ? "Este território pertence a outro jogador e não está disponível para coleta."
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
  if (!requestedTerritoryApplied && requestedTerritorySearch) {
    const query = normalizeTerritorySearch(requestedTerritorySearch);
    const territories = state.territories || [];
    const match = territories.find(item => normalizeTerritorySearch(item.name) === query)
      || territories.find(item => normalizeTerritorySearch(item.name).startsWith(query))
      || territories.find(item => normalizeTerritorySearch(item.name).includes(query));
    if (match) selectedTerritoryId = match.id;
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
$("zoomIn").addEventListener("click", () => changeMapZoom(0.25));
$("zoomOut").addEventListener("click", () => changeMapZoom(-0.25));
$("mapReset").addEventListener("click", resetMapViewport);

$("worldMap").addEventListener("pointerdown", event => {
  if (event.button !== 0 || event.target.closest(".territory-pin,.resource-node-pin")) return;
  mapPointer = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: mapViewport.panX,
    panY: mapViewport.panY,
  };
  $("worldMap").classList.add("is-dragging");
  try {
    $("worldMap").setPointerCapture(event.pointerId);
  } catch {
    mapPointer = null;
    $("worldMap").classList.remove("is-dragging");
  }
});
$("worldMap").addEventListener("pointermove", event => {
  if (!mapPointer || event.pointerId !== mapPointer.pointerId) return;
  const dx = event.clientX - mapPointer.startX;
  const dy = event.clientY - mapPointer.startY;
  if (Math.abs(dx) + Math.abs(dy) < 2) return;
  applyMapViewport({ panX: mapPointer.panX + dx, panY: mapPointer.panY + dy });
});
function endMapPan(event) {
  if (!mapPointer || (event && event.pointerId !== mapPointer.pointerId)) return;
  const pointerId = mapPointer.pointerId;
  mapPointer = null;
  $("worldMap").classList.remove("is-dragging");
  try {
    if ($("worldMap").hasPointerCapture(pointerId)) $("worldMap").releasePointerCapture(pointerId);
  } catch {
    // Pointer capture may already have been released by the browser.
  }
}
$("worldMap").addEventListener("pointerup", endMapPan);
$("worldMap").addEventListener("pointercancel", endMapPan);
$("worldMap").addEventListener("lostpointercapture", endMapPan);
$("worldMap").addEventListener("wheel", event => {
  event.preventDefault();
  changeMapZoom(event.deltaY < 0 ? 0.1 : -0.1);
}, { passive: false });
window.addEventListener("resize", () => applyMapViewport());

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
window.setInterval(() => {
  if (document.hidden || busy || !token) return;
  refreshState().catch(error => setStatus(error.message, true));
}, 15000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !busy && token) refreshState().catch(error => setStatus(error.message, true));
});
window.addEventListener("coi:realtime", event => {
  if (event.detail?.type !== "state_changed" || document.hidden || busy || !token) return;
  refreshState().catch(error => setStatus(error.message, true));
});
