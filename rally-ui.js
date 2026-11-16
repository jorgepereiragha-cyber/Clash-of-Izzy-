const $=id=>document.getElementById(id);
const token=localStorage.getItem("coi_game_token")||sessionStorage.getItem("coi_game_token");
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
function askTroops(){
 const raw=window.prompt('Informe as tropas em JSON. Exemplo: {"militia": 50, "archer": 10}');
 if(!raw)return null;
 try{
  const value=JSON.parse(raw);
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error();
  return value;
 }catch{
  notify("Formato inválido. Use um objeto JSON com quantidades inteiras.",true);
  return null;
 }
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
 if(action!=="collect"&&action!=="recall"&&!askTroops())return;
 const troops=action==="collect"||action==="recall"?undefined:askTroops();
 if(action!=="collect"&&action!=="recall"&&!troops)return;
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
  if(Number(node.occupied_by)>0){
   // A API decide se o nó pertence ao reino autenticado.
   addAction(actions,"Coletar",()=>runNodeAction("collect",node),busy);
   addAction(actions,"Recolher tropas",()=>runNodeAction("recall",node),busy||Boolean(node.reserved_by_rally));
  }else{
   const locked=Boolean(node.reserved_by_rally);
   addAction(actions,inAlliance?"Criar rally":"Ocupar nó",()=>{
    if(inAlliance){
     const troops=askTroops();if(!troops)return;
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
  card.append(heading,meta,members);
  if(inAlliance&&rally.status==="gathering"&&!rally.joined){
   addAction(card,"Enviar reforços",async()=>{
    const troops=askTroops();if(!troops||busy)return;busy=true;
    try{const data=await api("join",{method:"POST",body:JSON.stringify({rally_id:rally.id,troops})});notify("Reforços enviados: +"+fmt(data.power_added)+" poder.");await refresh();}
    catch(error){notify(error.message,true);}finally{busy=false;}
   },busy);
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
 if(!token){notify("Entre no seu reino para acessar a guerra.");return;}
 refresh();
 window.setInterval(()=>{if(!document.hidden)refresh();},12000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
}
init();
