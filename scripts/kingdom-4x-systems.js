/* Interface 4X progressiva: usa a sessão, estado e /game/action existentes. */
const root=document.getElementById("coiFourXPanel");
if(root){
 const canvas=document.getElementById("coiDefenseGrid"),ctx=canvas?.getContext("2d");
 const type=document.getElementById("coiDefenseType");
 const x=document.getElementById("coiDefenseX"),z=document.getElementById("coiDefenseZ");
 const place=document.getElementById("coiDefensePlace");
 const status=document.getElementById("coiDefenseStatus");
 const stock=document.getElementById("coiIndustryStock");
 const progress=document.getElementById("coiProgressionStatus");
 const defenseList=document.getElementById("coiDefenseList");
 const state=()=>window.__coiCityLayoutState?.();
 let pending=false,positionDirty=false;
 const f=n=>Number(n||0).toLocaleString("pt-BR");
 function intersect(ax,az,aw,ah,bx,bz,bw,bh){
  return ax<bx+bw && ax+aw>bx && az<bz+bh && az+ah>bz;
 }
 function position(){
  const s=state(),fp=s?.defenseCatalog?.[type.value],cx=Number(x.value),cz=Number(z.value);
  if(!fp)return {valid:false};
  const buildings=s?.buildings||[],defenses=s?.cityDefenses||[];
  const valid=Number.isSafeInteger(cx)&&Number.isSafeInteger(cz)&&cx>=-25&&cz>=-25&&
   cx+fp.width<=25&&cz+fp.height<=25&&
   buildings.every(b=>{
    const size=s?.cityLayout?.footprints?.[b.building_type];
    return Boolean(size)&&!intersect(cx,cz,fp.width,fp.height,Number(b.position_x),Number(b.position_z),size.width,size.height);
   })&&defenses.every(d=>!intersect(cx,cz,fp.width,fp.height,Number(d.grid_x),Number(d.grid_z),Number(d.width),Number(d.height)));
  return {valid,fp,cx,cz};
 }
 function preview(){
  const p=position();
  window.dispatchEvent(new CustomEvent("coi:defense-preview",{detail:{
   type:p.fp?type.value:null,gridX:p.cx,gridZ:p.cz,width:p.fp?.width,height:p.fp?.height,valid:p.valid
  }}));
  return p;
 }
 function draw(){
  if(!ctx||!state()?.advanced4xEnabled)return;
  const layout=state().cityLayout,rows=state().buildings||[],defenses=state().cityDefenses||[];
  const min=Number(layout?.min??-25),max=Number(layout?.max??25),unit=canvas.width/(max-min);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#20382f";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="rgba(210,230,201,.14)";
  for(let i=0;i<=max-min;i+=5){
   ctx.beginPath();ctx.moveTo(i*unit,0);ctx.lineTo(i*unit,canvas.height);
   ctx.moveTo(0,i*unit);ctx.lineTo(canvas.width,i*unit);ctx.stroke();
  }
  for(const b of rows){
   const fp=layout?.footprints?.[b.building_type];if(!fp)continue;
   ctx.fillStyle="#5887ae";ctx.fillRect((Number(b.position_x)-min)*unit,(Number(b.position_z)-min)*unit,fp.width*unit,fp.height*unit);
  }
  for(const d of defenses){
   ctx.fillStyle="#d4a75b";ctx.fillRect((Number(d.grid_x)-min)*unit,(Number(d.grid_z)-min)*unit,Number(d.width)*unit,Number(d.height)*unit);
  }
  const p=preview();
  if(p.fp&&Number.isFinite(p.cx)&&Number.isFinite(p.cz)){
   ctx.fillStyle=p.valid?"rgba(71,218,119,.55)":"rgba(233,75,75,.55)";
   ctx.fillRect((p.cx-min)*unit,(p.cz-min)*unit,p.fp.width*unit,p.fp.height*unit);
  }
  place.disabled=pending||!p.valid;
 }
 function render(){
  const s=state();
  if(!s?.advanced4xEnabled){root.hidden=true;return;}
  root.hidden=false;
  const industry=s.intermediateResources||{};
  stock.textContent="Trigo: "+f(industry.wheat)+" · Farinha: "+f(industry.flour)+
   " · Moinho Nv. "+f(industry.mill_level)+" · Padaria Nv. "+f(industry.bakery_level);
  const p=s.playerProgression;
  progress.textContent=p?"Progressão "+p.phase+" · Nível "+p.level+"/80 · XP "+f(p.xp)+
   (p.xpAtNextLevel==null?" (nível máximo)":" / "+f(p.xpAtNextLevel))+
   " · VIP do Castelo permanece independente.":"Progressão indisponível.";
  const current=type.value;
  const catalog=s.defenseCatalog||{};
  if(type.options.length!==Object.keys(catalog).length){
   type.replaceChildren();
   for(const [key,spec] of Object.entries(catalog)){
    const option=document.createElement("option");option.value=key;option.textContent=spec.name;type.append(option);
   }
   if(Object.hasOwn(catalog,current))type.value=current;
  }
  defenseList.replaceChildren();
  for(const d of s.cityDefenses||[]){
   const label=document.createElement("span");label.className="coi-defense-chip";
   label.textContent=(catalog[d.defense_type]?.name||d.defense_type)+
    " · X "+d.grid_x+" Z "+d.grid_z+" · Nv. "+d.level;
   defenseList.append(label);
  }
  if(!(s.cityDefenses||[]).length)defenseList.textContent="Nenhuma defesa posicionada.";
  for(const button of root.querySelectorAll("[data-coi-industry]")){
   const kind=button.dataset.coiIndustry;
   const lv=Number(kind==="mill"?industry.mill_level:industry.bakery_level)||1;
   button.disabled=pending||lv>=30||Number(s.kingdom?.castle_level||1)<=lv;
   button.textContent=(kind==="mill"?"Evoluir moinho":"Evoluir padaria")+
    " · Nv. "+(lv+1)+" · madeira "+f((lv+1)*120)+" · pedra "+f((lv+1)*80);
  }
  draw();
 }
 async function submit(payload,success){
  if(pending||typeof window.__coi4xAction!=="function")return;
  pending=true;status.textContent="Sincronizando com o servidor…";render();
  try{
   await window.__coi4xAction(payload);
   status.textContent=success;positionDirty=false;
  }catch(e){status.textContent=String(e?.message||"Operação rejeitada.");}
  finally{pending=false;render();}
 }
 place.addEventListener("click",()=>{const p=position();if(p.valid)void submit({type:"city_defense_place",defense:type.value,gridX:p.cx,gridZ:p.cz},"Defesa registrada e sincronizada.");});
 for(const button of root.querySelectorAll("[data-coi-industry]"))
  button.addEventListener("click",()=>void submit({type:"industry_upgrade",industry:button.dataset.coiIndustry},"Indústria evoluída."));
 for(const control of [type,x,z])control.addEventListener("input",()=>{positionDirty=true;draw();});
 canvas.addEventListener("pointerdown",event=>{
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  x.value=String(Math.floor((event.clientX-rect.left)/rect.width*50)-25);
  z.value=String(Math.floor((event.clientY-rect.top)/rect.height*50)-25);
  positionDirty=true;draw();
 });
 window.addEventListener("coi:kingdom-render",render);
 render();
}
