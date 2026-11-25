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
let nodes=[],rallies=[],inAlliance=false,selectedNodeId=null,busy=false,refreshing=false;
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
 if(!response.ok)throw new Error(data.error||"Falha na operação de guerra.");
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
const TROOP_LABELS=Object.freeze({militia:"Milícia",swordsman:"Espadachim",spearman:"Lanceiro",archer:"Arqueiro",cavalry:"Cavalaria",knight:"Cavaleiro",mage:"Mago",crossbowman:"Besteiro",catapult:"Catapulta",ram:"Aríete",trebuchet:"Trabuco"});
function rallyCapacityView(rally){
 const total=rally.total_troops,capacity=rally.troop_capacity;
 if(!Number.isSafeInteger(total)||total<0||!Number.isSafeInteger(capacity)||capacity<1)return null;
 return {total,capacity,remaining:Math.max(0,capacity-total)};
}
function parseFormation(entries,limit=200000){
 if(!Number.isSafeInteger(limit)||limit<1)return null;
 const troops={};let total=0;
 for(const [type,raw] of entries){
  if(!Object.hasOwn(TROOP_LABELS,type)||Object.hasOwn(troops,type)||!/^[0-9]+$/.test(String(raw)))return null;
  const qty=Number(raw);
  if(!Number.isSafeInteger(qty)||qty<0||qty>limit)return null;
  if(qty){troops[type]=qty;total+=qty;if(total>limit)return null;}
 }
 return total>0?troops:null;
}
let formationOpen=false;
async function askTroops(limit=200000){
 if(formationOpen||busy||limit<1)return null;
 const dialog=make("dialog","rally-formation-dialog");
 if(typeof dialog.showModal!=="function"){notify("Atualize o navegador ou Android System WebView para selecionar tropas.",true);return null;}
 formationOpen=true;
 const form=make("form","rally-formation-form");
 const heading=make("h2","","Formação militar");
 const description=make("p","","Limite desta seleção: "+fmt(limit)+" soldados. O servidor valida suas tropas e sua capacidade individual.");
 const grid=make("div","rally-formation-grid"),fields=[];
 for(const [key,name] of Object.entries(TROOP_LABELS)){
  const label=make("label","",name),input=make("input","");
  input.type="number";input.inputMode="numeric";input.min="0";input.max=String(limit);input.step="1";input.value="0";input.required=true;
  label.append(input);grid.append(label);fields.push([key,input]);
 }
 const status=make("p","rally-formation-total","0 soldados selecionados");
 status.setAttribute("aria-live","polite");
 const actions=make("div","resource-node-actions"),cancel=make("button","rally-action","Cancelar"),confirm=make("button","rally-action","Confirmar tropas");
 cancel.type="button";confirm.type="submit";confirm.disabled=true;
 actions.append(cancel,confirm);form.append(heading,description,grid,status,actions);dialog.append(form);document.body.append(dialog);
 return new Promise(resolve=>{
  let selection=null;
  const read=()=>parseFormation(fields.map(([key,input])=>[key,input.value]),limit);
  const refreshTotal=()=>{const valid=read();const total=valid?Object.values(valid).reduce((a,b)=>a+b,0):0;confirm.disabled=!valid;status.textContent=valid?fmt(total)+" soldados selecionados":"Selecione uma quantidade válida dentro do limite.";};
  form.addEventListener("input",refreshTotal);
  form.addEventListener("submit",event=>{event.preventDefault();selection=read();if(selection)dialog.close();});
  cancel.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{formationOpen=false;dialog.remove();resolve(selection);},{once:true});
  try{dialog.showModal();}catch{formationOpen=false;dialog.remove();notify("Não foi possível abrir a formação militar.",true);resolve(null);}
 });
}
function nodeLabel(node){
 const type=NODE_TYPES[node.node_type]||{icon:"📍",name:"Nó",resource:"recurso"};
 return type.name+" nível "+node.level+" · "+type.resource;
}
function selectNode(node){
 selectedNodeId=node.id;
 const title=$("selected-node-title"),details=$("selected-node-details");
 if(title)title.textContent=nodeLabel(node);
 if(details){
  details.replaceChildren(
   make("span","",node.id),
   make("span","",fmt(node.current_resources)+" / "+fmt(node.max_resources)+" recursos"),
   make("span","",node.occupied_by?"Ocupado por um reino":"Livre para ocupação")
  );
 }
 document.querySelectorAll(".resource-node-pin").forEach(pin=>pin.classList.toggle("selected",pin.dataset.nodeId===node.id));
}
async function runNodeAction(action,node){
 if(busy)return;
 const troops=action==="collect"||action==="recall"?undefined:await askTroops();
 if(busy||(action!=="collect"&&action!=="recall"&&!troops))return;
 busy=true;
 try{
  const data=await api(action,{method:"POST",body:JSON.stringify({node_id:node.id,...(troops?{troops}:{})})});
  notify(action==="collect"?"Coleta concluída: "+fmt(data.collected)+" "+data.resource_type+".":action==="recall"?"Tropas retornaram ao reino.":"Nó ocupado com sucesso.");
  await refresh();
 }catch(error){notify(error.message,true);}
 finally{busy=false;}
}
function renderNodeList(){
 const root=$("resource-node-list");if(!root)return;
 root.replaceChildren();
 const fragment=document.createDocumentFragment();
 for(const node of nodes){
  const type=NODE_TYPES[node.node_type]||NODE_TYPES.mine;
  const card=make("article","resource-node-card"+(node.id===selectedNodeId?" selected":""));
  const head=make("div","resource-node-heading");
  head.append(make("strong","",type.icon+" "+node.id),make("span","", "Nível "+node.level));
  const info=make("p","",fmt(node.current_resources)+" / "+fmt(node.max_resources)+" "+type.resource.toLowerCase());
  const ownership=make("p","resource-node-owner",node.occupied_by?"Ocupado":"Livre");
  card.append(head,info,ownership);
  const actions=make("div","resource-node-actions");
  if(node.is_mine){
   addAction(actions,"Coletar",()=>runNodeAction("collect",node),busy);
   addAction(actions,"Recolher tropas",()=>runNodeAction("recall",node),busy||Boolean(node.reserved_by_rally));
  }else if(node.occupied_by){
   addAction(actions,"Ocupado",()=>selectNode(node),true);
  }else{
   const locked=Boolean(node.reserved_by_rally);
   addAction(actions,inAlliance?"Criar rally":"Ocupar nó",async()=>{
    if(inAlliance){
     const troops=await askTroops();if(!troops)return;
     runRallyCreate(node,troops);
    }else runNodeAction("occupy",node);
   },locked||busy);
  }
  addAction(actions,"Ver no mapa",()=>selectNode(node));
  card.append(actions);
  fragment.append(card);
 }
 root.append(fragment);
}
async function runRallyCreate(node,troops){
 if(busy)return;busy=true;
 try{
  const data=await api("create",{method:"POST",body:JSON.stringify({target_type:"resource_node",target_id:node.id,troops})});
  notify("Rally criado. Reunião por 5 minutos; poder: "+fmt(data.power)+".");
  await refresh();
 }catch(error){notify(error.message,true);}
 finally{busy=false;}
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
  const capacity=rallyCapacityView(rally);
  card.append(heading,meta,members);
  card.append(make("p","rally-capacity",capacity?fmt(capacity.total)+" / "+fmt(capacity.capacity)+" soldados · "+fmt(capacity.remaining)+" vagas":"Capacidade aguardando sincronização"));
  if(inAlliance&&rally.status==="gathering"&&!rally.joined){
   addAction(card,"Enviar reforços",async()=>{
    const troops=await askTroops(capacity?.remaining??0);if(!troops||busy)return;busy=true;
    try{const data=await api("join",{method:"POST",body:JSON.stringify({rally_id:rally.id,troops})});notify("Reforços enviados: +"+fmt(data.power_added)+" poder.");await refresh();}
    catch(error){notify(error.message,true);}finally{busy=false;}
   },busy||!capacity||capacity.remaining===0);
  }
  root.append(card);
 }
}
function renderMapNodes(){
 const map=$("mapContent");if(!map)return;
 map.querySelectorAll(".resource-node-pin").forEach(pin=>pin.remove());
 const fragment=document.createDocumentFragment();
 for(const node of nodes){
  const type=NODE_TYPES[node.node_type]||NODE_TYPES.mine;
  const button=make("button","resource-node-pin"+(node.occupied_by?" occupied":"")+(node.id===selectedNodeId?" selected":""));
  button.type="button";button.dataset.nodeId=node.id;
  button.style.left=Math.max(7,Math.min(93,50+Number(node.map_x)*0.9))+"%";
  button.style.top=Math.max(8,Math.min(92,50-Number(node.map_y)*0.9))+"%";
  button.textContent=type.icon;
  button.title=node.id+" · "+nodeLabel(node);
  button.setAttribute("aria-label",node.id+" · "+nodeLabel(node));
  button.addEventListener("click",()=>{selectNode(node);$("rally-ui-panel")?.scrollIntoView({behavior:"smooth",block:"nearest"});});
  fragment.append(button);
 }
 map.append(fragment);
}
async function refresh(){
 if(refreshing||!token)return;refreshing=true;
 try{
  const [nodeData,rallyData]=await Promise.all([api("nodes"),api("active")]);
  nodes=Array.isArray(nodeData.nodes)?nodeData.nodes:[];
  rallies=Array.isArray(rallyData.rallies)?rallyData.rallies:[];
  inAlliance=rallyData.in_alliance===true;
  renderMapNodes();renderNodeList();renderRallies();
  const selected=nodes.find(node=>node.id===selectedNodeId);
  if(selected)selectNode(selected);
  notify(nodes.length+" nós de recursos sincronizados.");
 }catch(error){notify(error.message,true);}
 finally{refreshing=false;}
}
function init(){
 if(!token){notify(rallySession.blocked
  ?"O navegador bloqueou o armazenamento da sessão. Ative o acesso deste site e abra o reino para recuperar a guerra."
  :"Entre no seu reino para acessar a guerra.",true);return;}
 refresh();
 window.setInterval(()=>{if(!document.hidden)refresh();},12000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
}
init();
