import { castleCityArtId } from "./scripts/castle-skin-visuals.js";
import { createEntityArtElement } from "./scripts/kingdom-2d-art-atlas.js";
import { throneVisualState } from "./scripts/world-map-visual-state.js";
import { clampMapViewport, mapViewportTransform, nextMapZoom } from "./world-map-viewport.js";
import { readMarchComposition } from "./scripts/march-visual-path.js";
import { createWorldRefreshGate } from "./scripts/world-state-refresh.js";

const API = "/api";
const $ = id => document.getElementById(id);
function readWorldSession() {
  let readable = false;
  // Accessing a browser storage property may throw before getItem can run.
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const value = storage().getItem("coi_game_token");
      readable = true;
      if (value) return { token: value, blocked: false };
    } catch {}
  }
  return { token: "", blocked: !readable };
}
let token = readWorldSession().token;
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
const worldRefreshGate=createWorldRefreshGate();
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
  if (!response.ok) {
    const error = new Error(data.error || "Falha ao comunicar com o reino.");
    error.status = response.status;
    throw error;
  }
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
  const visualState = {
    territories: state.territories || [],
    marches: state.marches || [],
    kingdomId: state.kingdom?.id || 0,
    castleSkinId: Number(state.kingdom?.equipped_skin_id || 0),
    castleLevel: Number(state.kingdom?.castle_level || 1),
    throneShielded:state.throne?.shielded===true,
    thronePhase:state.throne?.phase,
    throneClaimed:Boolean(state.throne?.kingAllianceId || state.throne?.occupantAllianceId)
  };
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
    if (isThrone) button.dataset.throneState = throneVisualState(visualState);
    button.style.left = clamp(50 + Number(territory.x || 0) * 0.9, 9, 91) + "%";
    button.style.top = clamp(50 - Number(territory.z || 0) * 0.9, 10, 90) + "%";
    button.setAttribute("aria-label", territory.name + ", " + (isCastle ? "castelo de " + (territory.commander_name || "outro comandante") : terrain.label) + ", " + owner);
    button.title = isCastle
      ? territory.name + " · " + (territory.commander_name || "Comandante") + " · poder " + fmt(territory.power)
      : territory.name + " · " + resource.label + " · " + owner;
    if (isCastle) {
      const artId = castleCityArtId(territory.castle_skin_id);
      const portrait = createEntityArtElement({
        kind:"symbol",src:"/assets/art/buildings/icons.svg#"+artId,viewBox:"0 0 100 90"
      }, document);
      portrait.classList.add("territory-castle-art");
      button.append(portrait);
    } else {
      button.append(make("span", "", resource.icon));
    }
    button.append(make("small", "", territory.name));
    button.addEventListener("click", () => {
      selectedTerritoryId = territory.id;
      renderMap();
      renderDetails();
    });
    buttonRefs.set(Number(territory.id), button);
    root.append(button);
  }
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
function updateMarchCapacityLabel(){
 const label=$("marchCapacity");
 if(!label)return;
 const cap=Math.max(0,Number(state?.marchCapacity?.maximum)||0);
 const total=Object.values(selectedUnits).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value)||0)),0);
 const slots=state?.marchSlots||{active:0,max:1,available:1};
 label.textContent="Formação: "+fmt(total)+" / "+fmt(cap)+" tropas. "+fmt(slots.active)+" / "+fmt(slots.max)+" marchas em andamento. "+
   "Castelo, academia, herói "+(state?.marchCapacity?.heroRarity||"")+
   " e pesquisa militar aumentam esse limite.";
 label.style.color=total>cap?"#ffc1ac":"#d6e2f0";
}
function applyMarchPreset(mode){
  if(busy||!state)return;
  if(mode==="clear"){selectedUnits={};renderTroops();return;}
  const troops=(state.troops||[]).filter(x=>Number(x.tier)===1&&Number(x.quantity)>0)
    .map(x=>({...x,usable:Math.min(10000,Math.floor(Number(x.quantity)))}));
  const cap=Math.max(0,Math.floor(Number(state?.marchCapacity?.maximum)||0));
  let remaining=mode==="gather"?Math.min(cap,50):cap;
  const preference=["militia","spearman","swordsman","archer","crossbowman","cavalry","knight","catapult","ram","trebuchet","mage"];
  troops.sort((a,b)=>(preference.indexOf(a.unit_type)+1||99)-(preference.indexOf(b.unit_type)+1||99));
  const chosen={};
  if(mode==="balanced"&&troops.length){
    const share=Math.floor(remaining/troops.length);
    for(const troop of troops){
      const qty=Math.min(share,troop.usable);
      if(qty>0){chosen[troop.unit_type]=qty;remaining-=qty;}
    }
  }
  for(const troop of troops){
    if(remaining<1)break;
    const used=chosen[troop.unit_type]||0;
    const qty=Math.min(remaining,troop.usable-used);
    if(qty>0){chosen[troop.unit_type]=used+qty;remaining-=qty;}
  }
  selectedUnits=chosen;
  renderTroops();
}
for(const [id,mode] of [["presetGather","gather"],["presetBalanced","balanced"],
  ["presetFill","fill"],["presetClear","clear"]]){
  $(id).addEventListener("click",()=>applyMarchPreset(mode));
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
      updateMarchCapacityLabel();
    });
    row.append(label, input);
    root.append(row);
  }
  updateActionButtons();
  updateMarchCapacityLabel();
}
function updateActionButtons() {
  const territory = getSelectedTerritory();
  const total=Object.values(selectedUnits).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value)||0)),0);
  const hasTroops=total>0&&total<=Number(state?.marchCapacity?.maximum||0);
  const marchAvailable=Number(state?.marchSlots?.available??1)>0;
  const isCastle = territory?.territory_kind === "castle";
  const isThrone = territory?.territory_kind === "throne";
  const canVisit = Boolean(territory && !isCastle && !isThrone && territoryOwner(territory) !== "Outro reino");
  $("gather").disabled = busy || !canVisit || !hasTroops || !marchAvailable;
  $("scout").disabled = busy || !canVisit || !hasTroops || !marchAvailable;
  $("attack").disabled = busy || !territory || isCastle || isThrone || Boolean(territory.owner_kingdom_id) || !hasTroops || !marchAvailable;
  const siegeTotal=Object.values(selectedUnits).reduce((n,q)=>n+Number(q||0),0);
  $("throneAssault").hidden=!isThrone;
  for(const id of ["presetGather","presetBalanced","presetFill","presetClear"])$(id).disabled=busy;
  $("throneAssault").disabled=busy||!isThrone||state?.throne?.phase!=="contest"||
    Boolean(state?.throne?.kingAllianceId)||
    !state?.alliance?.id||Number(state?.kingdom?.castle_level||0)<10||
    siegeTotal<200||siegeTotal>10000;
}
// The server owns the duration; do not display a guessed rule.
function throneHoldLabel(minutes) {
  return Number.isSafeInteger(minutes) && minutes>0 ? fmt(minutes)+" minutos" : "tempo definido pelo servidor";
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
    if(throne?.phase==="contest")addStat(grid,"Ocupação para vencer",throneHoldLabel(throne.holdRequiredMinutes)+" de ocupação contínua");
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
    ? "Guerra do Trono: alianças rivais, cerco de tropas e "+throneHoldLabel(state?.throne?.holdRequiredMinutes)+" de ocupação para coroação."
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
    const composition=readMarchComposition(march.units_json);
    if(composition.length)card.append(make("div","muted","Formação: "+composition.map(u=>UNIT_NAMES[u.type]+" × "+fmt(u.count)).join(" · ")));
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
async function refreshState({background=false}={}) {
  return worldRefreshGate.run(()=>request("/game/state"),response=>{
  const nextState=response.state || response;
  if (!nextState.kingdom) throw new Error("O servidor não retornou o reino.");
  const oldThrone=state?.throne||null;
  state = nextState;
  if(oldThrone&&Number(oldThrone.realmId)===Number(state?.kingdom?.map_region||1))
    state.throne=oldThrone;
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
  },{background});
}
async function sendThroneAssault(){
  if(busy||getSelectedTerritory()?.territory_kind!=="throne"||state?.throne?.phase!=="contest")return;
  const units=Object.fromEntries(Object.entries(selectedUnits).filter(([,qty])=>Number(qty)>0));
  const count=Object.values(units).reduce((n,q)=>n+Number(q),0);
  if(count<200||count>10000)return;
  if(!window.confirm("Confirmar cerco ao Trono Imperial? O resultado pode causar perdas permanentes de tropas."))return;
  worldRefreshGate.invalidate();
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
      "Cerco vitorioso! Sua aliança deve manter o trono por "+throneHoldLabel(outcome.battle.holdMinutes??state?.throne?.holdRequiredMinutes)+".":
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
  const total=Object.values(units).reduce((sum,value)=>sum+Number(value||0),0);
  const max=Number(state?.marchCapacity?.maximum||0);
  if(Number(state?.marchSlots?.available??1)<1){
    $("marchNotice").textContent="Todas as filas de marcha estão ocupadas. Aguarde a conclusão das expedições.";
    return;
  }
  if(total>max){
    $("marchNotice").textContent="Capacidade excedida: "+fmt(total)+"/"+fmt(max)+
      ". Evolua heróis, castelo, academia e pesquisa militar.";
    return;
  }
  worldRefreshGate.invalidate();
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

function showWorldSessionRecovery() {
  setStatus("O navegador bloqueou o armazenamento da sessão. Nenhum novo reino será criado automaticamente.", true);
  const notice = $("marchNotice");
  notice.replaceChildren(document.createTextNode("Permita o armazenamento do site e "));
  const retry = make("button", "", "Tentar novamente");
  retry.type = "button";
  retry.id = "retryWorldSession";
  retry.addEventListener("click", () => {
    const checked = readWorldSession();
    if (checked.blocked) { setStatus("O armazenamento da sessão continua bloqueado.", true); return; }
    token = checked.token;
    void connect();
  });
  const link = make("a", "", "Acessar minha conta");
  link.href = "/account.html";
  notice.append(retry, document.createTextNode(" ou "), link);
}
async function connect() {
  if (!token) {
    const checked = readWorldSession();
    token = checked.token;
    if (!token && checked.blocked) { showWorldSessionRecovery(); return; }
    if (!token) { location.replace("/kingdom.html"); return; }
  }
  setStatus("Sincronizando territórios…");
  try {
    await refreshState();
    await updateRealmCards();
    setStatus("● Reino sincronizado");
  } catch (error) {
    setStatus(error.message, true);
    const notice = $("marchNotice");
    notice.replaceChildren(document.createTextNode(error.message));
    if (error.status === 401 || error.status === 403) {
      const account = make("a", "", "Acessar minha conta");
      account.href = "/account.html";
      notice.append(document.createTextNode(" "), account);
    }
  }
}
connect();
window.setInterval(() => {
  if (document.hidden || busy || !token) return;
  refreshState({background:true}).catch(error => setStatus(error.message, true));
}, 15000);
window.setInterval(() => { if(!document.hidden&&!busy&&token) updateRealmCards(); },60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !busy && token) refreshState({background:true}).catch(error => setStatus(error.message, true));
});
window.addEventListener("coi:app-resume", event => {
  if (event.detail?.reason === "online" && !busy && token) {
    refreshState({background:true}).catch(error => setStatus(error.message, true));
  }
});
