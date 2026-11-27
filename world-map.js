import { castleCityArtId } from "./scripts/castle-skin-visuals.js";
import { createEntityArtElement, worldResourceArt } from "./scripts/kingdom-2d-art-atlas.js";
import { throneVisualState } from "./scripts/world-map-visual-state.js";
import { clampMapViewport, mapViewportTransform, nextMapZoom } from "./world-map-viewport.js";
import { marchVisualPoint, marchVisualProgress, marchTimestamp, readMarchComposition } from "./scripts/march-visual-path.js";
import { createWorldRefreshGate } from "./scripts/world-state-refresh.js";
import { startRealtimePresence } from "./scripts/eldoria-realtime-client.js";

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
// The world map, rallies and monster panels share authenticated state. A
// session replacement must discard all three, including pending formations.
function worldSessionChanged(event){
  return (event.key==="coi_game_token"||event.key===null)&&readWorldSession().token!==token;
}
window.addEventListener("storage",event=>{
  if(worldSessionChanged(event)){
    worldRefreshGate.invalidate();
    realmRefreshGate.invalidate();
    window.location.reload();
  }
});
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
let selectedHunt = null;
let selectedResourceNode = null;
let pendingHunt = null;
let selectedUnits = {};
let busy = false;
const worldRefreshGate=createWorldRefreshGate();
const realmRefreshGate=createWorldRefreshGate();
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
export function getMarchFormation(){
  return Object.fromEntries(Object.entries(selectedUnits).filter(([,quantity])=>quantity>0));
}
export function clearMarchFormation(){
  selectedUnits={};
  if(state)renderTroops();
}
export function focusMarchFormation(){
  $("worldTargetPanel").scrollIntoView({block:"nearest"});
  ($("troops").querySelector("input")||$("worldTargetHeading")).focus({preventScroll:true});
}
export function focusMapMarker(marker) {
  if (!marker) return;
  const map = $("worldMap");
  const { clientWidth:width, clientHeight:height } = map;
  const zoom = Math.max(mapViewport.zoom, 1.75);
  const left = marker.offsetLeft - width / 2;
  const top = marker.offsetTop - height / 2;
  applyMapViewport({ zoom, panX: -left * zoom, panY: -top * zoom });
  map.scrollIntoView({ block: "nearest" });
  marker.focus({ preventScroll: true });
}
export function setResourceExpedition(node) {
  selectedResourceNode = node;
  if (node) {
    selectedTerritoryId = null;
    selectedHunt = null;
    window.dispatchEvent(new Event("coi:resource-node-selected"));
    for (const button of window.__coiWorldMapButtons?.values() || []) {
      button.classList.remove("selected");
      button.setAttribute("aria-pressed", "false");
    }
  }
  if (state) renderDetails();
}
function renderResources() {
  const root = $("resources");
  root.replaceChildren();
  for (const [key, meta] of Object.entries(RESOURCE)) {
    const item = make("div", "resource");
    item.append(worldResourceArt(key,document)||make("span","",meta.icon),document.createTextNode(meta.label));
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
export function tacticalHome(){
  const hasThrone=state?.territories?.some(row=>row.territory_kind==="throne");
  return {x:hasThrone?13:0,z:hasThrone?-11:0};
}
function tacticalMarches(now=Date.now()) {
  if (!$('worldMap').classList.contains('map-3d-fallback')) return;
  const home=tacticalHome();
  for (const marker of $('mapContent').querySelectorAll('.tactical-march')) {
    const { x, z, start, end } = marker.dataset;
    const point=marchVisualPoint(home,{x:Number(x),z:Number(z)},marchVisualProgress(now,Number(start),Number(end)));
    marker.style.left=clamp(50+point.x*.9,9,91)+'%';
    marker.style.top=clamp(50-point.z*.9,10,90)+'%';
  }
}
function renderMap() {
  const root = $("mapContent");
  const focusedTerritory = document.activeElement?.dataset.territoryId;
  root.querySelectorAll(".territory-pin,.tactical-march,.map-center").forEach(pin => pin.remove());
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
  const home=make("div","map-center");
  const homeLocation=tacticalHome();
  home.style.left=(50+homeLocation.x*.9)+"%";
  home.style.top=(50-homeLocation.z*.9)+"%";
  const homeArt=createEntityArtElement({kind:"symbol",src:"/assets/art/buildings/icons.svg#"+castleCityArtId(visualState.castleSkinId),viewBox:"0 0 100 90"},document);
  home.append(homeArt,make("small","",state.kingdom.kingdom_name||"Seu castelo"));
  root.append(home);
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
    button.setAttribute("aria-pressed", String(Number(territory.id) === Number(selectedTerritoryId)));
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
      button.append((!isThrone&&worldResourceArt(territory.resource_type,document))||make("span", "", resource.icon));
    }
    button.append(make("small", "", territory.name));
    button.addEventListener("click", () => {
      selectedTerritoryId = territory.id;
      selectedHunt = null;
      selectedResourceNode = null;
      window.dispatchEvent(new Event("coi:territory-selected"));
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
  for (const march of visualState.marches.filter(row=>row.status==="marching")) {
    const target=march.march_type==="hunt"?{x:march.monster_x,z:march.monster_z}:
      visualState.territories.find(row=>Number(row.id)===Number(march.target_territory_id));
    if(!target||target.x==null||target.z==null)continue;
    const marker=make("span","tactical-march",march.march_type==="gather"?"◆":"⚑");
    marker.dataset.type=march.march_type;
    marker.dataset.x=target.x;marker.dataset.z=target.z;
    marker.dataset.start=marchTimestamp(march.started_at);marker.dataset.end=marchTimestamp(march.arrives_at);
    marker.setAttribute("aria-hidden","true");
    root.append(marker);
  }
  tacticalMarches();
  applyMapViewport();
  if (focusedTerritory) buttonRefs.get(Number(focusedTerritory))?.focus({ preventScroll: true });
}
// Rebuild tactical positions immediately when the 3D renderer is lost.
window.addEventListener("coi:world-map-2d-fallback", () => {
  if (state?.kingdom) renderMap();
});
window.setInterval(()=>{if(!document.hidden)tacticalMarches();},1000);
window.addEventListener("coi:monster-selected",({detail})=>{
  selectedHunt=detail.monster?detail:null;
  if(!state)return;
  if(selectedHunt){
    selectedTerritoryId=null;
    selectedResourceNode=null;
  }
  renderMap();renderDetails();
  if(detail.openFormation){
    $("worldTargetPanel").scrollIntoView({block:"nearest"});
    $("worldTargetHeading").focus({preventScroll:true});
  }
});
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
  if(mode==="clear"){clearMarchFormation();return;}
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
  const available = (state.troops || []).filter(unit => Number(unit.tier) === 1 && Number(unit.quantity) > 0);
  const availableTypes = new Set(available.map(unit => unit.unit_type));
  for (const unitType of Object.keys(selectedUnits)) {
    if (!availableTypes.has(unitType)) delete selectedUnits[unitType];
  }
  if (!available.length) {
    root.replaceChildren(make("div", "muted", "Você ainda não possui tropas disponíveis para marchar."));
    updateActionButtons();
    updateMarchCapacityLabel();
    return;
  }
  const rows = new Map(Array.from(root.children, row => [row.dataset.unitType, row]));
  for (const [type, row] of rows) {
    if (!availableTypes.has(type)) row.remove();
  }
  for (const unit of available) {
    const type = unit.unit_type;
    const name = UNIT_NAMES[type] || type;
    let row = rows.get(type);
    if (!row) {
      row = make("div", "troop-row");
      row.dataset.unitType = type;
      const label = make("label", "");
      const input = make("input");
      input.type = "number";
      input.id = "march-unit-" + type;
      input.min = "0";
      input.step = "1";
      input.inputMode = "numeric";
      input.setAttribute("aria-label", "Quantidade de " + name);
      label.htmlFor = input.id;
      input.addEventListener("input", () => {
        selectedUnits[type] = clamp(Math.floor(Number(input.value) || 0), 0, Number(input.max));
        if (input.value && Number(input.value) !== selectedUnits[type]) input.value = String(selectedUnits[type]);
        updateActionButtons();
        updateMarchCapacityLabel();
      });
      input.addEventListener("blur", () => { input.value = String(selectedUnits[type] || 0); });
      row.append(label, input);
      root.append(row);
    }
    const [label, input] = row.children;
    label.textContent = name + " · " + fmt(unit.quantity);
    input.max = String(Math.min(10000, Number(unit.quantity)));
    selectedUnits[type] = clamp(selectedUnits[type] || 0, 0, Number(input.max));
    const quantity = String(selectedUnits[type]);
    if (input.value !== quantity && (document.activeElement !== input || input.value !== "")) {
      input.value = quantity;
    }
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
  const hunting=Boolean(selectedHunt);
  for(const id of ["gather","scout","attack"])$(id).hidden=hunting||Boolean(selectedResourceNode);
  $("hunt").hidden=!hunting;
  $("hunt").disabled=busy||!hasTroops||!marchAvailable||!hunting||Boolean(huntRestriction());
  if(hunting){
    const damage=Object.entries(selectedUnits).reduce((sum,[type,count])=>sum+(selectedHunt.progress?.unitDamage?.[type]||0)*count,0);
    $("marchHint").textContent=huntRestriction()||
      (damage?"Dano previsto: "+fmt(Math.min(damage,selectedHunt.monster.hp))+" PV. ":"Escolha a formação. ")+"As tropas retornam após a expedição.";
  }
  $("gather").disabled = busy || !canVisit || !["food","wood","stone","iron"].includes(territory?.resource_type) || !hasTroops || !marchAvailable;
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
function huntRestriction(){
  const {monster,progress,combatEnabled}=selectedHunt||{};
  if(!combatEnabled||!progress)return "Aguardando sincronização da energia de caça.";
  if(monster.hp<=0)return "A criatura está reaparecendo.";
  if(monster.level>progress.unlockedLevel)return "Derrote uma criatura do nível anterior para liberar este alvo.";
  if(progress.energy<progress.energyCosts[monster.level])return "Energia de caça insuficiente.";
  if(state.marches?.some(march=>march.status==="marching"&&march.march_type==="hunt"&&march.monster_id===monster.id))
    return "Uma expedição sua já está a caminho desta criatura.";
  return "";
}
// The server owns the duration; do not display a guessed rule.
function throneHoldLabel(minutes) {
  return Number.isSafeInteger(minutes) && minutes>0 ? fmt(minutes)+" minutos" : "tempo definido pelo servidor";
}
function renderDetails() {
  const root = $("territoryDetails");
  root.replaceChildren();
  const territory = getSelectedTerritory();
  if (selectedResourceNode) {
    const { label, availability } = selectedResourceNode;
    root.append(make("div", "territory-title", label), make("p", "muted", availability));
    const nodeActions = make("a", "", "Abrir ações do nó");
    nodeActions.href = "#selected-node-title";
    root.append(nodeActions);
    $("marchHint").textContent = "Escolha a formação e abra as ações do nó para ocupar ou convocar um rally.";
    renderTroops();
    return;
  }
  if(selectedHunt){
    const {monster,progress}=selectedHunt;
    root.append(make("div","territory-title",monster.name));
    const grid=make("div","detail-grid");
    addStat(grid,"Nível e vida","Nv. "+monster.level+" · "+fmt(monster.hp)+" / "+fmt(monster.max_hp)+" PV");
    if(progress)addStat(grid,"Energia da expedição",fmt(progress.energyCosts[monster.level])+" de "+fmt(progress.energy)+" disponível");
    root.append(grid);
    renderTroops();
    return;
  }
  if (!territory) {
    root.append(make("div", "muted", "Escolha um ponto no mapa."));
    $("troops").replaceChildren();
    $("marchHint").textContent="";
    updateActionButtons();
    return;
  }
  const resource = territory.territory_kind==="throne"?{icon:"👑",label:"Trono Imperial"}:(RESOURCE[territory.resource_type] || { icon: "📍", label: "Recurso" });
  const terrain = TERRAIN[territory.terrain] || { icon: "🗺️", label: "Terreno" };
  const title=make("div","territory-title");
  const resourceArt=territory.territory_kind!=="throne"&&territory.territory_kind!=="castle"?worldResourceArt(territory.resource_type,document):null;
  title.append(resourceArt||make("span","",resource.icon),document.createTextNode(territory.name));
  root.append(title);
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
    if(["food","wood","stone","iron"].includes(territory.resource_type)&&territoryOwner(territory)!=="Outro reino")
      addStat(grid,"Coleta por marcha",fmt(state.worldGatherFixedAmount??Math.max(1,Number(territory.resource_rate)||90))+" "+resource.label.toLocaleLowerCase("pt-BR"));
    addStat(grid, "Nível", fmt(territory.level || 1));
    if (territory.alliance_id != null) addStat(grid, "Aliança controladora", territory.controlling_alliance_tag ? "[" + territory.controlling_alliance_tag + "]" : "Território reivindicado");
  }
  root.append(grid);
  $("marchHint").textContent = isThrone
    ? "Guerra do Trono: alianças rivais, cerco de tropas e "+throneHoldLabel(state?.throne?.holdRequiredMinutes)+" de ocupação para coroação."
    : isCastle
    ? "Castelo de outro comandante detectado. Você pode consultar comandante, poder e aliança; o envio de ataques PvP será ativado na Fase 10."
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
  const scoutReports=new Map();
  const gatherReports=new Map();
  for(const event of state.recentEvents||[]){
    const reports=event.event_type==="territory_scouted"?scoutReports:event.event_type==="territory_gathered"?gatherReports:null;
    if(!reports)continue;
    try{const report=JSON.parse(event.payload_json);if(Number.isSafeInteger(report.marchId)&&!reports.has(report.marchId))reports.set(report.marchId,report);}catch{}
  }
  for (const march of marches.slice(0, 10)) {
    const card = make("div", "march");
    const types={hunt:"Caça",gather:"Coleta",scout:"Exploração",attack:"Conquista",reinforce:"Reforço",return:"Retorno"};
    const statuses={marching:"Em marcha",completed:"Concluída",arrived:"Chegou",returning:"Retornando",cancelled:"Cancelada"};
    const title = make("strong", "", (types[march.march_type] || "Marcha") + " · " + (march.monster_name || territories.get(Number(march.target_territory_id)) || "Território"));
    const date = march.arrives_at ? new Date(marchTimestamp(march.arrives_at)).toLocaleString("pt-BR") : "—";
    card.append(title, make("div", "muted", statuses[march.status]||"Situação indisponível"));
    if(march.status==="marching")card.append(make("div","muted","Chegada prevista: "+date));
    const composition=readMarchComposition(march.units_json);
    if(composition.length)card.append(make("div","muted","Formação: "+composition.map(u=>UNIT_NAMES[u.type]+" × "+fmt(u.count)).join(" · ")));
    const report=scoutReports.get(Number(march.id));
    if(march.march_type==="scout"&&report){
      const label=RESOURCE[report.resourceType]?.label||"Sem recurso";
      card.append(make("div","muted","Reconhecimento: "+String(report.name||"Território")+" · Nv. "+fmt(report.level)+" · "+label+" · Taxa "+fmt(report.resourceRate)));
    }
    const haul=gatherReports.get(Number(march.id));
    if(haul)card.append(make("div","muted",haul.amount>0?"Entregue ao reino: "+fmt(haul.amount)+" "+(RESOURCE[haul.resource]?.label||""):"Tropas retornaram sem carga. O ponto de coleta ficou indisponível."));
    if(march.hunt_outcome){
      const outcomes={victory:"Criatura derrotada. Recompensas entregues ao reino.",wounded:"Criatura ferida. As tropas retornaram.",unavailable:"Alvo indisponível. As tropas retornaram e a energia foi devolvida."};
      card.append(make("div","muted",outcomes[march.hunt_outcome]));
      if(march.hunt_damage>0)card.append(make("div","muted",fmt(march.hunt_damage)+" PV de dano"));
    }
    root.append(card);
  }
}
async function updateRealmCards({background=false}={}){
  const grid=$("realmGrid"),label=$("realmStatus");
  if(!grid||!label||!state?.kingdom)return;
  const realmId=Number(state.kingdom.map_region||1);
  try{
    await realmRefreshGate.run(async()=>{
      const data=await request("/realms/status");
      if(!Array.isArray(data.realms)||data.realms.length!==3)throw new Error("resposta inválida");
      let throne=null;
      try{throne=await request("/throne/status?realm="+encodeURIComponent(realmId));}catch{/* Disable throne actions until the next successful refresh. */}
      return {data,throne};
    },({data,throne})=>{
    if(!state?.kingdom||Number(state.kingdom.map_region||1)!==realmId)return;
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
    state.throne=throne&&Number(throne.realmId)===realmId?throne:null;
    renderMap();
    renderDetails();
    },{background});
  }catch{
    if(!state?.kingdom||Number(state.kingdom.map_region||1)!==realmId)return;
    state.throne=null;
    updateActionButtons();
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
  return worldRefreshGate.run(()=>request("/game/state"),applyWorldState,{background});
}
function applyWorldState(response){
  const nextState=response.state || response;
  if (!nextState.kingdom) throw new Error("O servidor não retornou o reino.");
  const oldThrone=state?.throne||null;
  const previousRealm=Number(state?.kingdom?.map_region||1);
  state = nextState;
  if(previousRealm!==Number(state.kingdom.map_region||1))realmRefreshGate.invalidate();
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
  if (!selectedHunt&&!selectedResourceNode&&!getSelectedTerritory()&&state.territories?.length) selectedTerritoryId = state.territories[0].id;
  render();
}
async function sendThroneAssault(){
  if(busy||getSelectedTerritory()?.territory_kind!=="throne"||state?.throne?.phase!=="contest")return;
  const units=Object.fromEntries(Object.entries(selectedUnits).filter(([,qty])=>Number(qty)>0));
  const count=Object.values(units).reduce((n,q)=>n+Number(q),0);
  if(count<200||count>10000)return;
  if(!window.confirm("Confirmar cerco ao Trono Imperial? O resultado pode causar perdas permanentes de tropas."))return;
  worldRefreshGate.invalidate();
  realmRefreshGate.invalidate();
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
  const hunting=marchType==="hunt";
  const target=hunting?selectedHunt?.monster:territory;
  const units = getMarchFormation();
  if (!target || !Object.keys(units).length || (hunting&&huntRestriction())) return;
  if(marchType==="gather"&&!["food","wood","stone","iron"].includes(territory.resource_type))return;
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
  const draft={type: "march", targetId: target.id, marchType, units};
  if(hunting){
    draft.generation=target.generation;
    const key=JSON.stringify(draft);
    if(pendingHunt?.key!==key)pendingHunt={key,id:crypto.randomUUID()};
    draft.requestId=pendingHunt.id;
  }
  try {
    const result = await request("/game/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    selectedUnits = {};
    applyWorldState(result);
    if(hunting){pendingHunt=null;window.dispatchEvent(new Event("coi:refresh-monsters"));}
    $("marchNotice").textContent = hunting?"Expedição de caça enviada.":result.message || "Marcha registrada pelo servidor.";
    setStatus("● Reino sincronizado");
  } catch (error) {
    if(hunting&&error.status>=400&&error.status<500){pendingHunt=null;window.dispatchEvent(new Event("coi:refresh-monsters"));}
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
$("hunt").addEventListener("click", () => sendMarch("hunt"));
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
window.addEventListener("coi:refresh-world",()=>{
  if(state&&!busy)void refreshState().catch(error=>setStatus(error.message,true));
});

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
let lastRealtimeRefresh=0;
if(typeof WebSocket==="function")startRealtimePresence({onWorldChanged:()=>{
  if(document.hidden||busy||!token||Date.now()-lastRealtimeRefresh<5000)return;
  lastRealtimeRefresh=Date.now();
  window.dispatchEvent(new Event("coi:refresh-monsters"));
  window.dispatchEvent(new Event("coi:refresh-resource-nodes"));
  refreshState({background:true}).catch(()=>{/* periodic polling remains available */});
  updateRealmCards({background:true});
}});
window.setInterval(() => {
  if (document.hidden || busy || !token) return;
  refreshState({background:true}).catch(error => setStatus(error.message, true));
}, 15000);
window.setInterval(() => { if(!document.hidden&&!busy&&token) updateRealmCards({background:true}); },60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !busy && token) refreshState({background:true}).catch(error => setStatus(error.message, true));
});
window.addEventListener("coi:app-resume", event => {
  if (event.detail?.reason === "online" && !busy && token) {
    refreshState({background:true}).catch(error => setStatus(error.message, true));
  }
});
