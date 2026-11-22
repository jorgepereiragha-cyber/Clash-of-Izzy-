// Cidade 4X: grade móvel com pré-visualização, seleção por toque e API autoritativa.
const root=document.getElementById("advancedCitySection");
if(root){
 const canvas=document.getElementById("cityGridCanvas"),ctx=canvas.getContext("2d");
 const info=document.getElementById("cityGridStatus");
 const typeSelect=document.getElementById("cityBuildingType");
 const modeSelect=document.getElementById("cityGridMode");
 const rotateButton=document.getElementById("cityRotate");
 const panText=document.getElementById("cityGridViewport");
 const elements=document.getElementById("cityGridStructures");
 const population=document.getElementById("cityGridPopulation");
 const stock=document.getElementById("cityGridStock");
 const bonuses=document.getElementById("cityGridBonuses");
 const C=20;
 const palette={core:"#af956f",resource:"#549d69",military:"#627cc2",defense:"#b77a5f"};
 let state=null,offsetX=15,offsetY=15,hover=null,rotation=0,busy=false,selectedId=null,pendingKey=null,initializedMap=false;
 let lastToken="";
 const token=()=>localStorage.getItem("coi_game_token")||sessionStorage.getItem("coi_game_token")||"";
 function status(message,error=false){info.textContent=message;info.dataset.error=error?"1":"0";}
 function labelDate(value){const date=new Date(String(value).replace(" ","T").replace(/Z?$/,"Z"));return Number.isFinite(date.getTime())?date.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"aguardando";}
 async function api(path,body=null){
  const t=token();if(!t)throw new Error("Entre no seu reino para editar a cidade.");
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
  try{
   const res=await fetch("/api/game/city"+path,{method:body===null?"GET":"POST",
    headers:{"Authorization":"Bearer "+t,...(body===null?{}:{"Content-Type":"application/json"})},
    body:body===null?undefined:JSON.stringify(body),signal:ctrl.signal});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(data.error||"Operação da cidade não autorizada.");
   return data;
  }finally{clearTimeout(timer);}
 }
 function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
 function footprint(type,rot=rotation){
  const item=state?.types.find(x=>x.type===type);
  if(!item)return null;
  return rot%180===0?{width:item.width,height:item.height}:{width:item.height,height:item.width};
 }
 function occupant(x,y,exceptId=null){
  return state?.buildings.find(s=>Number(s.id)!==Number(exceptId)&&
   x>=s.grid_x&&y>=s.grid_y&&x<s.grid_x+s.width&&y<s.grid_y+s.height);
 }
 function fits(x,y,w,h,exceptId=null){
  const start=state?.unlockedOrigin??15;
  if(!state||x<start||y<start||x+w>start+state.unlockedSize||y+h>start+state.unlockedSize)return false;
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(occupant(xx,yy,exceptId))return false;
  return true;
 }
 function pointerTile(event){
  const box=canvas.getBoundingClientRect();
  if(!box.width||!box.height)return null;
  const x=Math.floor((event.clientX-box.left)*C/box.width)+offsetX;
  const y=Math.floor((event.clientY-box.top)*C/box.height)+offsetY;
  return x>=offsetX&&y>=offsetY&&x<offsetX+C&&y<offsetY+C?{x,y}:null;
 }
 function draw(){
  if(!ctx)return;
  const width=canvas.width,height=canvas.height,cell=width/C;
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle="#102b35";ctx.fillRect(0,0,width,height);
  if(!state)return;
  const max=state.unlockedSize,origin=state.unlockedOrigin;
  for(let y=0;y<C;y++)for(let x=0;x<C;x++){
   const gx=x+offsetX,gy=y+offsetY;
   const inside=gx>=origin&&gy>=origin&&gx<origin+max&&gy<origin+max;
   ctx.fillStyle=inside?((x+y)%2===0?"#1a4044":"#1d484b"):"#18222b";
   ctx.fillRect(x*cell,y*cell,cell,cell);
   ctx.strokeStyle="#ffffff19";ctx.strokeRect(x*cell,y*cell,cell,cell);
  }
  const visible=state.buildings.filter(b=>b.grid_x+b.width>offsetX&&b.grid_y+b.height>offsetY&&b.grid_x<offsetX+C&&b.grid_y<offsetY+C);
  for(const b of visible){
   const x=(b.grid_x-offsetX)*cell,y=(b.grid_y-offsetY)*cell,w=b.width*cell,h=b.height*cell;
   ctx.fillStyle=palette[b.category]||"#ad9459";
   ctx.fillRect(x+2,y+2,w-4,h-4);
   ctx.strokeStyle=selectedId===b.id?"#fff2a3":"#f0dfbc";
   ctx.lineWidth=selectedId===b.id?5:2;ctx.strokeRect(x+2,y+2,w-4,h-4);
   if(Date.parse(b.finishes_at)>Date.now()){
    ctx.fillStyle="#070b10aa";ctx.fillRect(x+2,y+2,w-4,h-4);
   }
   const text=String(b.name||b.building_type).slice(0,b.width>2?13:8);
   ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
   ctx.font="bold "+Math.min(17,Math.max(11,w/6))+"px system-ui";
   if(w>44&&h>30)ctx.fillText(text,x+w/2,y+h/2,Math.max(16,w-6));
  }
  let dimensions=null,x=hover?.x,y=hover?.y,exceptId=null;
  if(modeSelect.value==="place"&&typeSelect.value)dimensions=footprint(typeSelect.value);
  if(modeSelect.value==="move"&&selectedId){
   const b=state.buildings.find(v=>v.id===selectedId);
   if(b){dimensions=footprint(b.building_type);exceptId=b.id;}
  }
  if(dimensions&&hover){
   const valid=fits(x,y,dimensions.width,dimensions.height,exceptId);
   ctx.fillStyle=valid?"#35ff7980":"#ff535a88";
   ctx.fillRect((x-offsetX)*cell+1,(y-offsetY)*cell+1,dimensions.width*cell-2,dimensions.height*cell-2);
   ctx.strokeStyle=valid?"#73ffc6":"#ff8383";ctx.lineWidth=4;
   ctx.strokeRect((x-offsetX)*cell+1,(y-offsetY)*cell+1,dimensions.width*cell-2,dimensions.height*cell-2);
  }
  panText.textContent="Setor "+offsetX+"–"+(offsetX+C-1)+" / "+offsetY+"–"+(offsetY+C-1)+" · Liberado "+max+"×"+max+" de 50×50";
 }
 function renderDetails(){
  population.textContent="População "+state.population.total+" · disponíveis "+state.population.available+
   " · alocados "+state.population.assigned+" · felicidade "+state.population.happiness+"%";
  stock.textContent=Object.entries(state.stock).filter(([k])=>!k.includes("credit")).map(([k,n])=>k+": "+Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:2})).join(" · ");
  const b=state.buffs;
  bonuses.textContent="Ataque +"+Math.round(b.attack_bonus*100)+"% · Produção +"+
   Math.round(b.production_bonus*100)+"% · Armazém +"+Math.round(b.storage_bonus*100)+"% · Visual do castelo: tier "+state.castleTier;
  elements.replaceChildren();
  for(const s of state.buildings){
   const item=document.createElement("div");item.className="city-grid-item";
   const heading=document.createElement("span");
   heading.innerHTML="<strong>"+escapeHtml(s.name)+"</strong> <small>["+s.grid_x+","+s.grid_y+"]</small>"+
    (Date.parse(s.finishes_at)>Date.now()?" <small>até "+escapeHtml(labelDate(s.finishes_at))+"</small>":"");
   item.append(heading);
   if(Number(s.workers_required)>0){
    const tools=document.createElement("span");tools.className="city-grid-item-actions";
    for(const delta of [-1,1]){
     const btn=document.createElement("button");btn.type="button";btn.textContent=delta<0?"−":"+";
     btn.setAttribute("aria-label",delta<0?"Retirar trabalhador":"Alocar trabalhador");
     btn.disabled=busy||s.workers_assigned+delta<0||s.workers_assigned+delta>s.workers_required;
     btn.addEventListener("click",()=>{void commit("/workers",{structureId:s.id,workers:s.workers_assigned+delta},"Trabalhadores atualizados.");});
     tools.append(btn);
    }
    const number=document.createElement("small");number.textContent=" "+s.workers_assigned+"/"+s.workers_required;tools.append(number);item.append(tools);
   }
   elements.append(item);
  }
 }
 function renderTypes(){
  const previous=typeSelect.value;
  const types=state.types.filter(t=>Number(t.placeable));
  typeSelect.replaceChildren(new Option("Escolha um edifício",""));
  for(const t of types)typeSelect.add(new Option(t.name+" · "+t.width+"×"+t.height+" · madeira "+t.cost_wood+" / pedra "+t.cost_stone,t.type));
  if(types.some(t=>t.type===previous))typeSelect.value=previous;
 }
 async function reload(quiet=false){
  if(!token())return;
  try{
   state=await api("");
   if(!initializedMap){offsetX=state.unlockedOrigin;offsetY=state.unlockedOrigin;initializedMap=true;}
   offsetX=Math.max(0,Math.min(30,offsetX));offsetY=Math.max(0,Math.min(30,offsetY));
   window.__coiAdvancedCityStructures=state.buildings.filter(b=>!b.core_building_type);
   renderTypes();renderDetails();draw();
   window.dispatchEvent(new CustomEvent("coi:advanced-city-state",{detail:{buildings:window.__coiAdvancedCityStructures}}));
   if(!quiet)status("Grade e recursos sincronizados com o servidor.");
  }catch(error){status(error.message||"Não foi possível sincronizar a cidade.",true);}
 }
 async function commit(path,body,message){
  if(busy)return;
  busy=true;
  try{const result=await api(path,body);await reload(true);status(message);return result;}
  catch(error){status(error.message||"Operação recusada.",true);return null;}
  finally{busy=false;if(state)renderDetails();}
 }
 async function tap(tile){
  if(!tile||busy||!state)return;
  const mode=modeSelect.value;
  if(mode==="place"){
   const type=typeSelect.value;
   if(!type){status("Escolha o edifício antes de posicionar.",true);return;}
   const size=footprint(type);
   if(!fits(tile.x,tile.y,size.width,size.height)){status("Área ocupada ou bloqueada.",true);return;}
   const requestKey=pendingKey||(pendingKey=(crypto.randomUUID?.()||("coi"+Date.now()+Math.random())).replace(/[^a-zA-Z0-9_-]/g,""));
   const result=await commit("/place",{buildingType:type,gridX:tile.x,gridY:tile.y,rotation,requestKey},
    "Construção autorizada. Aguarde a conclusão no servidor.");
   if(result)pendingKey=null;
  }else if(mode==="move"){
   if(!selectedId){
    const b=occupant(tile.x,tile.y);
    if(!b){status("Toque em um edifício para selecionar a mudança.");return;}
    selectedId=b.id;status("Edifício selecionado. Toque na célula de destino.");
   }else{
    const b=state.buildings.find(s=>s.id===selectedId);
    if(!b){selectedId=null;return;}
    const size=footprint(b.building_type);
    if(!fits(tile.x,tile.y,size.width,size.height,b.id)){status("Destino ocupado ou bloqueado.",true);return;}
    const result=await commit("/move",{structureId:b.id,gridX:tile.x,gridY:tile.y,rotation},
     "Edifício reposicionado.");
    if(result)selectedId=null;
   }
  }else if(mode==="remove"){
   const b=occupant(tile.x,tile.y);
   if(!b){status("Toque na estrutura que deseja remover.");return;}
   if(b.core_building_type){status("Edifícios originais não podem ser removidos.",true);return;}
   if(confirm("Remover "+b.name+"? O reembolso é 50% dos materiais originais.")){
    await commit("/remove",{structureId:b.id},"Edifício removido; recursos reembolsados.");
   }
  }else{
   const b=occupant(tile.x,tile.y);
   if(!b){status("Toque em um edifício para ver os trabalhadores.");return;}
   const total=Number(b.workers_required)||0;
   selectedId=b.id;draw();
   status(total?"Alocação: "+b.name+" ("+b.workers_assigned+"/"+total+"). Ajuste com + ou − na lista abaixo.":
    b.name+" não precisa de trabalhadores.");
   bListFocus();
  }
  draw();
 }
 function bListFocus(){elements.scrollIntoView({block:"nearest",behavior:"smooth"});}
 canvas.addEventListener("pointermove",event=>{hover=pointerTile(event);draw();});
 canvas.addEventListener("pointerleave",()=>{hover=null;draw();});
 canvas.addEventListener("pointerup",event=>{hover=pointerTile(event);void tap(hover);});
 canvas.addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter"].includes(event.key))return;
  if(event.key==="Enter"){void tap(hover||{x:offsetX,y:offsetY});return;}
  event.preventDefault();
  const dx=event.key==="ArrowRight"?1:event.key==="ArrowLeft"?-1:0;
  const dy=event.key==="ArrowDown"?1:event.key==="ArrowUp"?-1:0;
  hover={x:Math.max(offsetX,Math.min(offsetX+C-1,(hover?.x??offsetX)+dx)),
   y:Math.max(offsetY,Math.min(offsetY+C-1,(hover?.y??offsetY)+dy))};draw();
 });
 modeSelect.addEventListener("change",()=>{selectedId=null;pendingKey=null;rotation=0;draw();});
 typeSelect.addEventListener("change",()=>{pendingKey=null;draw();});
 rotateButton.addEventListener("click",()=>{rotation=(rotation+90)%360;draw();status("Rotação: "+rotation+"°");});
 root.querySelectorAll("[data-city-pan]").forEach(button=>{
  button.addEventListener("click",()=>{
   if(!state)return;
   const max=30,direction=button.dataset.cityPan;
   if(direction==="east")offsetX=Math.min(max,offsetX+10);
   if(direction==="west")offsetX=Math.max(0,offsetX-10);
   if(direction==="south")offsetY=Math.min(max,offsetY+10);
   if(direction==="north")offsetY=Math.max(0,offsetY-10);
   hover=null;draw();
  });
 });
 document.getElementById("cityGridReload").addEventListener("click",()=>{void reload();});
 window.addEventListener("coi:kingdom-connected",()=>{if(token()!==lastToken){lastToken=token();void reload();}});
 if(token()){lastToken=token();void reload(true);}
 window.addEventListener("resize",()=>draw(),{passive:true});
 draw();
}
