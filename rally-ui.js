import {worldResourceArt} from "./scripts/kingdom-2d-art-atlas.js";
import {clearMarchFormation, focusMapMarker, focusMarchFormation, getMarchFormation, setResourceExpedition, tacticalHome} from "./world-map.js";
const $=id=>document.getElementById(id);
function readRallySession() {
 let readable=false;
 for(const storage of [()=>window.localStorage,()=>window.sessionStorage]){
  try{const found=storage().getItem("coi_game_token");readable=true;if(found)return {token:found,blocked:false};}catch{}
 }
 return {token:"",blocked:!readable};
}
const rallySession=readRallySession();
const token=rallySession.token;
const NODE_TYPES={
 mine:{icon:"⛏️",name:"Mina",resource:"Ferro"},
 forest:{icon:"🌲",name:"Floresta",resource:"Madeira"},
 farm:{icon:"🌾",name:"Fazenda",resource:"Comida"},
 quarry:{icon:"🪨",name:"Pedreira",resource:"Pedra"}
};
let nodes=[],rallies=[],inAlliance=false,collectReturnEnabled=false,selectedNodeId=null,busy=false,refreshing=null,lastMapNodes="";
function make(tag,className,text){
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!==undefined)el.textContent=String(text);
 return el;
}
function fmt(value){return Number(value||0).toLocaleString("pt-BR");}
async function api(path,options={}){
 const response=await fetch("/api/game/rally/"+path,{
  ...options,
  headers:{...(options.headers||{}),...(token?{Authorization:"Bearer "+token}:{}),...(options.body?{"Content-Type":"application/json"}:{})}
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(data.error||"Falha na operação de guerra.");error.status=response.status;throw error;}
 return data;
}
function notify(message,error=false){
 const status=$("rally-status");
 if(status){status.textContent=message;status.classList.toggle("error",error);}
}
function addAction(parent,label,action,disabled=false){
 const button=make("button","rally-action",label);
 button.type="button";button.disabled=disabled;
 button.addEventListener("click",action);
 parent.append(button);
 return button;
}
function expeditionTroops(){
 const troops=getMarchFormation();
 if(Object.keys(troops).length)return troops;
 notify("Escolha as tropas no painel da expedição.",true);
 focusMarchFormation();
 return null;
}
function nodeAvailability(node){
 return node.is_mine?"Sua ocupação":node.occupied_by?"Ocupado por outro reino":node.reserved_by_rally?"Reservado para rally":"Livre para ocupação";
}
function nodeResourceArt(node){
 const key=Object.hasOwn(NODE_TYPES,node.node_type)?({mine:"iron",forest:"wood",farm:"food",quarry:"stone"})[node.node_type]:null;
 return worldResourceArt(key,document)||make("span","","◆");
}
function nodeLabel(node){
 const type=NODE_TYPES[node.node_type]||{icon:"📍",name:"Nó",resource:"recurso"};
 return type.name+" nível "+node.level+" · "+type.resource;
}
function collectableNodeAmount(node){
 const authoritative=node.collection_amount;
 if(Number.isSafeInteger(authoritative)&&authoritative>=0)return authoritative;
 const available=Number(node.current_resources);
 return Number.isFinite(available)?Math.max(0,Math.floor(available*0.5)):0;
}
function nodeReadyLabel(node){
 if(collectableNodeAmount(node)>0)return "Coleta disponível";
 if(!Number.isFinite(node.collection_ready_at)||!Number.isFinite(node.server_time))return "Aguardando regeneração para coletar";
 const minutes=Math.max(1,Math.ceil((node.collection_ready_at-node.server_time)/60));
 const time=minutes>=60?Math.floor(minutes/60)+" h "+(minutes%60)+" min":minutes+" min";
 return "Aguardando regeneração para coletar · ~"+time;
}
function nodeHarvestPreview(node){
 const amount=collectableNodeAmount(node);
 const type=NODE_TYPES[node.node_type];
 return {amount,resource:type?.resource||"Recursos",stock:Math.max(0,Number(node.current_resources)||0),capacity:Math.max(0,Number(node.max_resources)||0),readyLabel:nodeReadyLabel(node),blocked:!node.is_mine&&Boolean(node.occupied_by||node.reserved_by_rally)};
}
function nodeStockMeter(node){
 const meter=make("progress","resource-node-stock");
 meter.max=Math.max(1,Number(node.max_resources)||0);
 meter.value=Math.max(0,Math.min(meter.max,Number(node.current_resources)||0));
 meter.setAttribute("aria-label","Estoque disponível do ponto de coleta");
 return meter;
}
function selectNode(node){
 const previous=selectedNodeId;
 selectedNodeId=node?.id??null;
 const title=$("selected-node-title"),details=$("selected-node-details");
 if(title)title.textContent=node?nodeLabel(node):"Selecione um nó no mapa";
 if(details){
  details.replaceChildren(...(node?[
   make("span","",node.id),
   make("span","",fmt(node.current_resources)+" / "+fmt(node.max_resources)+" recursos"),
   make("span","",nodeAvailability(node)),
   make("span","",nodeHarvestPreview(node).blocked?"Ponto indisponível para nova expedição":collectableNodeAmount(node)>0?"Coleta estimada: "+fmt(collectableNodeAmount(node)):nodeReadyLabel(node)),
   make("span","",fmt(node.regen_rate)+" recursos/h de regeneração")
  ]:[]));
 }
 document.querySelectorAll(".resource-node-pin").forEach(pin=>{
  const selected=pin.dataset.nodeId===String(selectedNodeId);
  pin.classList.toggle("selected",selected);
  pin.setAttribute("aria-pressed",String(selected));
 });
 document.querySelectorAll(".resource-node-card").forEach(card=>
  card.classList.toggle("selected",card.dataset.nodeId===String(selectedNodeId)));
 const list=$("resource-node-list");
 const activeCard=list?.querySelector(".resource-node-card.selected");
 if(activeCard&&list.firstElementChild!==activeCard)list.prepend(activeCard);
 if(node||previous)setResourceExpedition(node?{label:nodeLabel(node),availability:nodeAvailability(node),harvest:nodeHarvestPreview(node)}:null);
}
function nodeActionReceipt(action,node,data){
 const resource=(Object.hasOwn(NODE_TYPES,node.node_type)?NODE_TYPES[node.node_type].resource:"Recursos").toLocaleLowerCase("pt-BR");
 if(action==="collect"||action==="collect-return"){
  const collected="Coleta concluída: "+fmt(data.collected)+" "+resource+".";
  if(action==="collect")return collected;
  const returned=Number(data.returned),allies=Number(data.returned_allies);
  const own=Number.isSafeInteger(returned)&&returned>=0?fmt(returned)+" tropas próprias retornaram.":"Tropas retornaram ao reino.";
  return collected+" "+own+(Number.isSafeInteger(allies)&&allies>0?" "+fmt(allies)+" tropas aliadas retornaram.":"");
 }
 if(action==="recall")return "Tropas retornaram ao reino.";
 return "Nó ocupado com sucesso.";
}
async function runNodeAction(action,node){
 const troops=action==="occupy"?expeditionTroops():undefined;
 if(action==="occupy"&&!troops)return;
 await sendRallyAction(action,{node_id:node.id,...(troops?{troops}:{})},data=>nodeActionReceipt(action,node,data));
}
async function sendRallyAction(action,body,message){
 if(busy||readRallySession().token!==token)return;
 busy=true;
 renderNodeList();renderRallies();
 try{
  const data=await api(action,{method:"POST",body:JSON.stringify(body)});
  if(readRallySession().token!==token)return;
  const receipt=message(data);
  if(body.troops)clearMarchFormation();
  window.dispatchEvent(new Event("coi:refresh-world"));
  if(refreshing)await refreshing;
  if(readRallySession().token!==token)return;
  await refresh(receipt);
 }catch(error){if(readRallySession().token===token)notify(error.message,true);}
 finally{busy=false;renderNodeList();renderRallies();}
}
function renderNodeList(){
 const root=$("resource-node-list");if(!root)return;
 const focused=document.activeElement?.closest(".resource-node-card");
 const focusedId=focused?.dataset.nodeId;
 const focusedAction=focused?document.activeElement.textContent:null;
 root.replaceChildren();
 const fragment=document.createDocumentFragment();
 const filtered=filteredNodes();
 filtered.sort((a,b)=>Number(b.id===selectedNodeId)-Number(a.id===selectedNodeId));
 if(!filtered.length)fragment.append(make("p","rally-empty","Nenhum nó neste filtro."));
 for(const node of filtered){
  const type=NODE_TYPES[node.node_type]||NODE_TYPES.mine;
  const card=make("article","resource-node-card"+(node.id===selectedNodeId?" selected":""));
  card.dataset.nodeId=node.id;
  const head=make("div","resource-node-heading");
  const name=make("strong","resource-node-name");name.append(nodeResourceArt(node),document.createTextNode(type.name+" · "+node.id));
  head.append(name,make("span","", "Nível "+node.level));
  const info=make("p","",fmt(node.current_resources)+" / "+fmt(node.max_resources)+" "+type.resource.toLowerCase());
  const ownership=make("p","resource-node-owner",nodeAvailability(node));
  card.append(head,info,nodeStockMeter(node),ownership);
  const actions=make("div","resource-node-actions");
  if(node.is_mine){
   const amount=collectableNodeAmount(node);
   card.append(make("p","resource-node-yield",amount>0?"Coleta estimada: "+fmt(amount)+" "+type.resource.toLowerCase():nodeReadyLabel(node)));
   addAction(actions,"Coletar",()=>runNodeAction("collect",node),busy||amount<1);
   if(collectReturnEnabled)addAction(actions,"Coletar e retornar",()=>runNodeAction("collect-return",node),busy||amount<1||Boolean(node.reserved_by_rally));
   addAction(actions,"Recolher tropas",()=>runNodeAction("recall",node),busy||Boolean(node.reserved_by_rally));
  }else if(node.occupied_by){
   addAction(actions,"Ocupado",()=>selectNode(node),true);
  }else{
   const locked=Boolean(node.reserved_by_rally);
   if(!locked)card.append(make("p","resource-node-yield",collectableNodeAmount(node)>0?"Coleta estimada: "+fmt(collectableNodeAmount(node))+" "+type.resource.toLowerCase():nodeReadyLabel(node)));
   addAction(actions,"Ocupar nó",()=>runNodeAction("occupy",node),locked||busy);
   if(inAlliance){
    addAction(actions,"Criar rally",()=>{
     const troops=expeditionTroops();if(!troops)return;
     sendRallyAction("create",{target_type:"resource_node",target_id:node.id,troops},data=>
      "Rally criado. Reunião por 5 minutos. Poder: "+fmt(data.power)+".");
    },locked||busy);
   }
  }
  addAction(actions,"Ver no mapa",()=>locateNode(node));
  card.append(actions);
  fragment.append(card);
 }
 root.append(fragment);
 if(focusedId){
  const card=Array.from(root.children).find(item=>item.dataset.nodeId===focusedId);
  Array.from(card?.querySelectorAll("button")||[]).find(button=>button.textContent===focusedAction)?.focus({preventScroll:true});
 }
}
function renderRallies(){
 const root=$("rally-active-list");if(!root)return;
 root.replaceChildren();
 if(!rallies.length){root.append(make("p","rally-empty","Nenhum rally ativo na sua aliança."));return;}
 for(const rally of rallies){
  const card=make("article","rally-card");
  const heading=make("div","rally-heading");
  heading.append(make("strong","",rally.leader_name||"Líder do rally"),make("span","rally-state",rally.status==="gathering"?"Reunindo":"Marchando"));
  const meta=make("p","",nodeLabel({node_type:rally.node_type,level:rally.node_level})+" · "+fmt(rally.total_power)+" poder");
  const members=make("p","",fmt(rally.member_count)+" participantes");
  card.append(heading,meta,members);
  if(inAlliance&&rally.status==="gathering"&&!rally.joined){
   addAction(card,"Enviar reforços",()=>{
    const troops=expeditionTroops();if(!troops)return;
    sendRallyAction("join",{rally_id:rally.id,troops},data=>"Reforços enviados. Poder adicionado: "+fmt(data.power_added)+".");
   },busy);
  }
  root.append(card);
 }
}
// Collection markers share the actual isometric projection used by castles and monsters.
function projectResourceNodes(){
 const map=$("mapContent"),host=$("worldMap");
 if(!map)return;
 for(const button of map.querySelectorAll(".resource-node-pin")){
  const x=Number(button.dataset.mapX),z=Number(button.dataset.mapZ);
  const point=!host?.classList.contains("map-3d-fallback")?window.__coiWorldMap3D?.projectPoint?.(x,z):null;
  button.style.left=point?point.left+"px":Math.max(7,Math.min(93,50+x*.9))+"%";
  button.style.top=point?point.top+"px":Math.max(8,Math.min(92,50-z*.9))+"%";
 }
}
function nodeMatchesMapFilter(node,filter){
 if(filter==="free")return !node.occupied_by&&!node.reserved_by_rally;
 if(filter==="ready")return (node.is_mine===true||(!node.occupied_by&&!node.reserved_by_rally))&&collectableNodeAmount(node)>0;
 if(filter==="mine-owned")return node.is_mine===true;
 if(filter==="all"||!filter)return true;
 return node.node_type===filter;
}
for(const event of ["coi:world-map-3d-ready","coi:world-map-projection-changed","coi:world-map-2d-fallback"])window.addEventListener(event,projectResourceNodes);
const resourceFilter=$("resourceMapFilter");
if(resourceFilter){
 const target=new URLSearchParams(window.location.search).get("coleta");
 if(Object.hasOwn(NODE_TYPES,target))resourceFilter.value=target;
}
function filteredNodes(){
 return nodes.filter(node=>nodeMatchesMapFilter(node,resourceFilter?.value));
}
function locateNode(node){
 selectNode(node);
 const pin=Array.from($("mapContent").querySelectorAll(".resource-node-pin"))
  .find(marker=>marker.dataset.nodeId===String(node.id));
 focusMapMarker(pin);
}
resourceFilter?.addEventListener("change",()=>{
 if(!filteredNodes().some(node=>node.id===selectedNodeId))selectNode(null);
 renderMapNodes();renderNodeList();
});
function rankResourceNode(node){
 if(!node.is_mine&&(node.occupied_by||node.reserved_by_rally))return 2;
 return collectableNodeAmount(node)>0?0:1;
}
function compareResourceNodes(a,b){
 const home=tacticalHome();
 return rankResourceNode(a)-rankResourceNode(b)||Math.hypot(a.map_x-home.x,a.map_y-home.z)-Math.hypot(b.map_x-home.x,b.map_y-home.z);
}
$("resourceMapLocate")?.addEventListener("click",()=>{
 const candidates=filteredNodes().sort(compareResourceNodes);
 if(candidates.length)locateNode(candidates[0]);
});
window.addEventListener("coi:territory-selected",()=>{if(selectedNodeId)selectNode(null);});
window.addEventListener("coi:monster-selected",event=>{if(selectedNodeId&&event.detail.monster)selectNode(null);});
function renderMapNodes(){
 const map=$("mapContent");if(!map)return;
 const filtered=filteredNodes();
 $("resourceMapLocate").disabled=!filtered.length;
 $("resourceMapCount").textContent=filtered.length===1?"1 nó":fmt(filtered.length)+" nós";
 const snapshot=JSON.stringify(filtered.map(node=>[node.id,node.node_type,node.level,node.map_x,node.map_y,nodeAvailability(node),collectableNodeAmount(node)>0]));
 if(snapshot===lastMapNodes)return;
 lastMapNodes=snapshot;
 const focusedId=document.activeElement?.dataset.nodeId;
 map.querySelectorAll(".resource-node-pin").forEach(pin=>pin.remove());
 const fragment=document.createDocumentFragment();
 let replacementFocus;
 for(const node of filtered){
  const button=make("button","resource-node-pin"+(node.occupied_by?" occupied":"")+(node.id===selectedNodeId?" selected":""));
  button.type="button";button.dataset.nodeId=node.id;
  button.dataset.mapX=String(node.map_x);button.dataset.mapZ=String(node.map_y);
  if(node.occupied_by&&!node.is_mine)button.classList.add("foreign");
  button.append(nodeResourceArt(node));
  button.append(make("small","resource-node-level",String(node.level)));
  if(node.reserved_by_rally&&!node.occupied_by)button.style.borderStyle="dashed";
  button.title=node.id+" · "+nodeLabel(node)+" · "+nodeAvailability(node)+(collectableNodeAmount(node)<1?" · Aguardando regeneração":"");
  button.setAttribute("aria-label",button.title);
  button.setAttribute("aria-pressed",String(node.id===selectedNodeId));
  button.addEventListener("pointerdown",event=>event.stopPropagation());
  button.addEventListener("click",()=>{
   selectNode(nodes.find(row=>row.id===node.id));
   const title=$("selected-node-title");
   title?.scrollIntoView({block:"nearest"});
   title?.focus({preventScroll:true});
  });
  if(button.dataset.nodeId===focusedId)replacementFocus=button;
  fragment.append(button);
 }
 map.append(fragment);projectResourceNodes();
 replacementFocus?.focus({preventScroll:true});
}
function refresh(successMessage){
 if(refreshing||!token)return refreshing;
 refreshing=loadRallyState(successMessage).finally(()=>{refreshing=null;});
 return refreshing;
}
async function loadRallyState(successMessage){
 try{
  const data=await api("world");
  if(readRallySession().token!==token)return;
  nodes=Array.isArray(data.nodes)?data.nodes:[];
  rallies=Array.isArray(data.rallies)?data.rallies:[];
  inAlliance=data.in_alliance===true;
  collectReturnEnabled=data.collect_return_enabled===true;
  if(selectedNodeId&&!filteredNodes().some(node=>node.id===selectedNodeId))selectNode(null);
  renderMapNodes();renderNodeList();renderRallies();
  const selected=nodes.find(node=>node.id===selectedNodeId);
  if(selected||selectedNodeId)selectNode(selected);
  notify(successMessage||nodes.length+" nós de recursos sincronizados.");
 }catch(error){
  if(error.status===401||error.status===403){
   nodes=[];rallies=[];inAlliance=false;collectReturnEnabled=false;
   if(selectedNodeId)selectNode(null);
   renderMapNodes();renderNodeList();renderRallies();
  }
  if(readRallySession().token!==token)return;
  notify(successMessage?successMessage+" Não foi possível atualizar o mapa; aguarde a próxima sincronização.":error.message,true);
 }
}
function init(){
 if(!token){notify(rallySession.blocked
  ?"O navegador bloqueou o armazenamento da sessão. Ative o acesso deste site e abra o reino para recuperar a guerra."
  :"Entre no seu reino para acessar a guerra.",true);return;}
 $("rallyFormation")?.addEventListener("click",focusMarchFormation);
 refresh();
 window.setInterval(()=>{if(!document.hidden&&!busy)refresh();},12000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!busy)refresh();});
 window.addEventListener("coi:refresh-resource-nodes",()=>{if(!document.hidden&&!busy)refresh();});
}
init();
