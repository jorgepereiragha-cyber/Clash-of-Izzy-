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
const activeMapPointers = new Map();
let mapPanStart = null;
let mapPinchStart = null;
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
    const isThrone = territory.territory_kind === "throne";
    const resource = isThrone?{icon:"👑",label:"Trono Imperial"}:
      isCastle?{icon:"🏰",label:"Castelo de jogador"}:
      (RESOURCE[territory.resource_type]||{icon:"📍",label:"Território"});
    const terrain = TERRAIN[territory.terrain] || { icon: "🗺️", label: "Terreno" };
    const owner = territoryOwner(territory);
    const button = make("button", "territory-pin" +
      (owner === "Seu reino" ? " owned" : owner === "Outro reino" ? " enemy" : "") +
      (isCastle ? " castle" : "") + (isThrone ? " throne" : "") +
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
    kingdomId: state.kingdom?.id || 0,
    castleSkinId: Number(state.kingdom?.equipped_skin_id || 0),
    throneShielded:state.throne?.shielded===true
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
  const isThrone = territory?.territory_kind === "throne";
  const canVisit = Boolean(territory && !isCastle && !isThrone && territoryOwner(territory) !== "Outro reino");
  $("gather").disabled = busy || !canVisit || !hasTroops;
  $("scout").disabled = busy || !canVisit || !hasTroops;
  $("attack").disabled = busy || !territory || isCastle || isThrone || Boolean(territory.owner_kingdom_id) || !hasTroops;
  const siegeTotal=Object.values(selectedUnits).reduce((n,q)=>n+Number(q||0),0);
  $("throneAssault").hidden=!isThrone;
  $("throneAssault").disabled=busy||!isThrone||state?.throne?.phase!=="contest"||
    Boolean(state?.throne?.kingAllianceId)||
    !state?.alliance?.id||Number(state?.kingdom?.castle_level||0)<10||
    siegeTotal<200||siegeTotal>10000;
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
  const resource = territory.territory_kind==="throne"?{icon:"👑",label:"Trono Imperial"}:(RESOURCE[territory.resource_type] || { icon: "📍", label: "Recurso" });
  const terrain = TERRAIN[territory.terrain] || { icon: "🗺️", label: "Terreno" };
  root.append(make("div", "territory-title", resource.icon + " " + territory.name));
  root.append(make("p", "muted", territoryOwner(territory)));
  const grid = make("div", "detail-grid");
  const isCastle = territory.territory_kind === "castle";
  const isThrone = territory.territory_kind === "throne";
  if(isThrone){
    const throne=state.throne;
    const phases={shield:"Escudo de proteção",preparation:"Preparação",contest:"Guerra do Trono",recovery:"Recuperação"};
    addStat(grid,"Situação",phases[throne?.phase]||"Consultando o servidor");
    addStat(grid,"Escudo até",throne?.shieldUntil?new Date(throne.shieldUntil).toLocaleString("pt-BR"):"—");
    addStat(grid,"Aliança ocupante",throne?.occupantAllianceTag||"Nenhuma");
    addStat(grid,"Reino coroado",throne?.reigningKingdom||"Nenhum");
    addStat(grid,"Requisito","Aliança · Castelo 10 · 200 tropas");
    if(throne?.phase==="contest")addStat(grid,"Ocupação para vencer","30 minutos contínuos");
  }else if (isCastle) {
    addStat(grid, "Comandante", territory.commander_name || "Comandante");
    addStat(grid, "Poder", fmt(territory.power));
    addStat(grid, "Nível do castelo", fmt(territory.castle_level || territory.level || 1));
    if (territory.alliance_tag) addStat(grid, "Aliança", "[" + territory.alliance_tag + "]");
  } else {
    addStat(grid, "Terreno", terrain.label);
    addStat(grid, "Recurso", resource.label);
    addStat(grid, "Produção", fmt(territory.resource_rate) + " / hora");
    addStat(grid, "Nível", fmt(territory.level || 1));
  }
  root.append(grid);
  $("marchNotice").textContent = isThrone
    ? "Guerra do Trono: 35 dias de proteção, alianças rivais, cerco de tropas e 30 minutos de ocupação para coroação."
    : isCastle
    ? "Castelo de outro comandante detectado. Você pode consultar comandante, poder e aliança; o envio de ataques PvP será ativado na Fase 10."
    : territory.owner_kingdom_id && territoryOwner(territory) === "Outro reino"
      ? "Este território pertence a outro jogador e não está disponível para coleta."
      : "Escolha as tropas e uma ação. O servidor confirma custos, disponibilidade e resultado.";
  if (isCastle) {
    $("troops").replaceChildren();
    updateActionButtons();
  } else {
    renderTroops();
  }
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
async function updateRealmCards(){
  const grid=$("realmGrid"),label=$("realmStatus");
  if(!grid||!label)return;
  try{
    const data=await request("/realms/status");
    if(!Array.isArray(data.realms)||data.realms.length!==3)throw new Error("resposta inválida");
    grid.replaceChildren();
    label.textContent="Reinos cadastrados: "+fmt(data.registeredPlayers)+" · Mapa atual: "+fmt(state?.kingdom?.map_region||1);
    for(const realm of data.realms){
      const current=Number(realm.id)===Number(state?.kingdom?.map_region||1);
      const card=make("div","realm-tile"+(realm.open?"":" is-locked")+(current?" is-current":""));
      card.setAttribute("role","listitem");
      card.append(make("strong","",realm.name));
      const status=realm.open?(current?"Seu mapa · aberto":"Aberto para novos reinos")
        :"Bloqueado · faltam "+fmt(realm.playersRemaining)+" jogadores";
      card.append(make("span","",status));
      card.append(make("span","","Castelos neste mapa: "+fmt(realm.inhabitants)));
      if(!realm.open){
        const progress=make("progress");
        progress.max=Number(realm.unlockAtPlayers)||1;
        progress.value=Math.min(progress.max,Number(data.registeredPlayers)||0);
        progress.setAttribute("aria-label","Progresso para abrir "+realm.name);
        card.append(progress);
      }
      grid.append(card);
    }
    try{
      state.throne=await request("/throne/status?realm="+encodeURIComponent(state?.kingdom?.map_region||1));
      renderMap();
      renderDetails();
    }catch{state.throne=null;updateActionButtons();}
  }catch{
    label.textContent="Não foi possível consultar o desbloqueio dos mapas.";
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
async function sendThroneAssault(){
  if(busy||getSelectedTerritory()?.territory_kind!=="throne"||state?.throne?.phase!=="contest")return;
  const units=Object.fromEntries(Object.entries(selectedUnits).filter(([,qty])=>Number(qty)>0));
  const count=Object.values(units).reduce((n,q)=>n+Number(q),0);
  if(count<200||count>10000)return;
  if(!window.confirm("Confirmar cerco ao Trono Imperial? O resultado pode causar perdas permanentes de tropas."))return;
  busy=true;updateActionButtons();
  $("marchNotice").textContent="Realizando cerco ao Trono Imperial…";
  try{
    const outcome=await request("/game/action",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({type:"throne_assault",units,requestId:crypto.randomUUID()})
    });
    selectedUnits={};
    await refreshState();
    await updateRealmCards();
    $("marchNotice").textContent=outcome.battle?.won?
      "Cerco vitorioso! Sua aliança deve manter o trono por 30 minutos.":
      "O cerco não superou as defesas. Confira as baixas no relatório.";
  }catch(e){$("marchNotice").textContent=e.message;setStatus(e.message,true)}
  finally{busy=false;updateActionButtons()}
}
$("throneAssault").addEventListener("click",sendThroneAssault);

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
  activeMapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  $("worldMap").classList.add("is-dragging");
  try {
    $("worldMap").setPointerCapture(event.pointerId);
  } catch {
    activeMapPointers.delete(event.pointerId);
    $("worldMap").classList.toggle("is-dragging", activeMapPointers.size > 0);
    return;
  }

  if (activeMapPointers.size === 1) {
    mapPanStart = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: mapViewport.panX,
      panY: mapViewport.panY,
    };
    mapPinchStart = null;
  } else if (activeMapPointers.size === 2) {
    const points = [...activeMapPointers.values()];
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    mapPinchStart = {
      distance: Math.max(1, Math.hypot(dx, dy)),
      zoom: mapViewport.zoom,
    };
    mapPanStart = null;
  }
});

$("worldMap").addEventListener("pointermove", event => {
  if (!activeMapPointers.has(event.pointerId)) return;
  activeMapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (activeMapPointers.size >= 2 && mapPinchStart) {
    const points = [...activeMapPointers.values()];
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    applyMapViewport({ zoom: mapPinchStart.zoom * (distance / mapPinchStart.distance) });
    return;
  }

  if (!mapPanStart || event.pointerId !== mapPanStart.pointerId) return;
  const dx = event.clientX - mapPanStart.startX;
  const dy = event.clientY - mapPanStart.startY;
  if (Math.abs(dx) + Math.abs(dy) < 2) return;
  applyMapViewport({ panX: mapPanStart.panX + dx, panY: mapPanStart.panY + dy });
});

function endMapPan(event) {
  if (!event || !activeMapPointers.has(event.pointerId)) return;
  const pointerId = event.pointerId;
  activeMapPointers.delete(pointerId);
  try {
    if ($("worldMap").hasPointerCapture(pointerId)) $("worldMap").releasePointerCapture(pointerId);
  } catch {
    // Pointer capture may already have been released by the browser.
  }

  mapPinchStart = null;
  if (activeMapPointers.size === 1) {
    const [remainingId, point] = activeMapPointers.entries().next().value;
    mapPanStart = {
      pointerId: remainingId,
      startX: point.x,
      startY: point.y,
      panX: mapViewport.panX,
      panY: mapViewport.panY,
    };
  } else {
    mapPanStart = null;
  }
  $("worldMap").classList.toggle("is-dragging", activeMapPointers.size > 0);
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
    await updateRealmCards();
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
window.setInterval(() => { if(!document.hidden&&!busy&&token) updateRealmCards(); },60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !busy && token) refreshState().catch(error => setStatus(error.message, true));
});
window.addEventListener("coi:app-resume", event => {
  if (event.detail?.reason === "online" && !busy && token) {
    refreshState().catch(error => setStatus(error.message, true));
  }
});
