import {createEntityArtElement} from "./kingdom-2d-art-atlas.js";
// A seleção do bestiário usa o mesmo painel de formação das demais marchas.
const root=document.getElementById("worldMonsterPreview");
const list=document.getElementById("worldMonsterList");
const status=document.getElementById("worldMonsterStatus");
const MONSTER_KEYS=Object.freeze(["ash_wolf","iron_boar","frost_bear","marsh_wyrm","stone_golem","ember_drake"]);
function monsterArt(key){
 if(!MONSTER_KEYS.includes(key))return element("span","◆");
 const svg=createEntityArtElement({kind:"symbol",src:"/assets/art/eldoria/monsters.svg#"+key,viewBox:"0 0 64 64"},document);
 svg.classList.add("monster-portrait");return svg;
}
function token(){
 for(const key of ["localStorage","sessionStorage"]){
  try{const value=window[key]?.getItem("coi_game_token");if(value)return value;}catch{}
 }
 return "";
}
function element(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el;}
const map=document.getElementById("mapContent");
const mapHost=document.getElementById("worldMap");
const pins=new Map(),cards=new Map();
let selected=null,monsterRows=[],progress=null,combatEnabled=false,lastSnapshot="",snapshotBearer="";
function syncMonsterModels(){window.__coiWorldMap3D?.setMonsters?.(monsterRows);}
function projectPins(){
 for(const {button,monster} of pins.values()){
  const x=Number(monster.x),z=Number(monster.z);
  const point=!mapHost?.classList.contains("map-3d-fallback")?window.__coiWorldMap3D?.projectPoint?.(x,z):null;
  button.style.left=point?point.left+"px":Math.max(9,Math.min(91,50+x*.9))+"%";
  button.style.top=point?point.top+"px":Math.max(10,Math.min(90,50-z*.9))+"%";
 }
}
function clearPins(){for(const {button} of pins.values())button.remove();pins.clear();cards.clear();}
function selectMonster(id,openFormation=false,emit=true){
 selected=id;
 for(const [key,{button}] of pins){button.classList.toggle("selected",key===id);button.setAttribute("aria-pressed",String(key===id));}
 for(const [key,card] of cards)card.classList.toggle("monster-selected",key===id);
 if(emit){
  const monster=monsterRows.find(row=>String(row.id)===id);
  window.dispatchEvent(new CustomEvent("coi:monster-selected",{detail:{monster,progress,combatEnabled,openFormation}}));
 }
}
function addPin(monster,id,hp){
 if(!map||!Number.isFinite(Number(monster.x))||!Number.isFinite(Number(monster.z)))return;
 const button=element("button");button.type="button";button.className="world-monster-pin"+(hp===0?" defeated":"");
 button.append(monsterArt(monster.monster_key),element("small","Nv. "+monster.level));
 button.title=monster.name+" · Nv. "+monster.level+" · "+hp+" PV";
 button.setAttribute("aria-label",button.title);button.setAttribute("aria-pressed","false");
 button.addEventListener("pointerdown",event=>event.stopPropagation());
 button.addEventListener("click",()=>selectMonster(id,true));
 map.append(button);pins.set(id,{button,monster});
}
for(const event of ["coi:world-map-3d-ready","coi:world-map-projection-changed","coi:world-map-2d-fallback"])window.addEventListener(event,projectPins);
window.addEventListener("coi:world-map-3d-ready",syncMonsterModels);
window.addEventListener("coi:territory-selected",()=>selectMonster(null,false,false));
let busy=false,timer=null,suspended=false,enabled=null;
function stopRefresh(){
 if(timer!==null)clearTimeout(timer);
 timer=null;
}
function clearSnapshot(){
 lastSnapshot="";snapshotBearer="";monsterRows=[];progress=null;combatEnabled=false;
 if(selected)selectMonster(null);
 clearPins();list.replaceChildren();syncMonsterModels();
 document.getElementById("worldMonsterProgress")?.replaceChildren();
}
function scheduleRefresh(){
 stopRefresh();
 if(!document.hidden&&!suspended&&enabled!==false&&token())timer=setTimeout(refresh,30000);
}
async function refresh(){
 if(document.hidden||suspended||busy||!root||!list||!status)return;
 stopRefresh();
 const bearer=token();
 if(snapshotBearer&&snapshotBearer!==bearer)clearSnapshot();
 if(!bearer){root.hidden=true;return;}
 busy=true;
 try{
  const response=await fetch("/api/game/world-monsters",{headers:{Authorization:"Bearer "+bearer},cache:"no-store",redirect:"error"});
  if(response.status===401||response.status===403){clearSnapshot();root.hidden=true;enabled=false;return;}
  if(!response.ok)throw Error("Consulta indisponível");
  const data=await response.json();
  if(token()!==bearer||suspended)return;
  enabled=data.enabled===true;
  if(!enabled){clearSnapshot();root.hidden=true;return;}
  snapshotBearer=bearer;
  root.hidden=false;
  const snapshot=JSON.stringify(data);
  if(snapshot===lastSnapshot)return;
  progress=data.progress;
  combatEnabled=data.combatEnabled===true;
  const progressBox=document.getElementById("worldMonsterProgress");
  if(progressBox){
   progressBox.replaceChildren();
   if(progress){
    const meter=element("progress");meter.max=progress.maxEnergy;meter.value=progress.energy;meter.setAttribute("aria-label","Energia de caça");
    progressBox.append(element("b","Energia de caça: "+progress.energy+" / "+progress.maxEnergy),meter,element("span","Maior nível liberado: "+progress.unlockedLevel+" · +1 energia a cada "+Math.floor(progress.recoverySeconds/60)+" min"));
   }else progressBox.append(element("span","Progresso de caça indisponível."));
  }
  const rows=Array.isArray(data.monsters)?data.monsters:[];
  const focused=[...pins].find(([,entry])=>entry.button===document.activeElement)?.[0];
  clearPins();list.replaceChildren();
  for(const monster of rows){
   const id=String(monster.id);
   const item=element("article");item.className="stat";
   const max=Math.max(1,Number(monster.max_hp)||1);
   const hp=Math.max(0,Math.min(max,Number(monster.hp)||0));
   const heading=element("b");heading.className="monster-heading";heading.append(monsterArt(monster.monster_key),element("span",monster.name+" · Nv. "+monster.level));item.append(heading);
   const meter=element("progress");meter.max=max;meter.value=hp;meter.setAttribute("aria-label","Vida de "+monster.name);
   item.append(meter,element("span",hp+" / "+max+" PV · X "+monster.x+" / Z "+monster.z));
   item.append(element("span",hp>0?"Criatura ativa":"Reaparece às "+new Date(monster.respawn_at*1000).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})));
   if(progress){
    const cost=progress.energyCosts?.[monster.level];
    const locked=Number(monster.level)>Number(progress.unlockedLevel);
    item.append(element("span",locked?"Nível bloqueado · derrote o anterior":"Custo previsto: "+cost+" energia"));
   }
   const button=element("button","Ver expedição");button.type="button";button.className="secondary";
   button.addEventListener("click",()=>selectMonster(id,true));
   item.append(button);list.append(item);cards.set(id,item);addPin(monster,id,hp);
  }
  monsterRows=rows;syncMonsterModels();
  if(selected)selectMonster(pins.has(selected)?selected:null);
  projectPins();
  if(focused)pins.get(focused)?.button.focus({preventScroll:true});
  status.textContent=rows.length+" criaturas neste mundo.";
  lastSnapshot=snapshot;
 }catch{
  if(token()!==bearer||suspended)return;
  root.hidden=false;lastSnapshot="";combatEnabled=false;
  if(selected)selectMonster(selected);
  status.textContent="Não foi possível sincronizar as criaturas. Tente atualizar.";
 }
 finally{busy=false;scheduleRefresh();}
}
document.getElementById("worldMonsterRefresh")?.addEventListener("click",refresh);
window.addEventListener("coi:refresh-monsters",refresh);
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopRefresh();else if(enabled!==false)void refresh();});
window.addEventListener("pagehide",()=>{suspended=true;stopRefresh();});
window.addEventListener("pageshow",event=>{suspended=false;if(event.persisted)void refresh();});
window.addEventListener("storage",event=>{
 if(event.key!=="coi_game_token"&&event.key!==null)return;
 clearSnapshot();root.hidden=true;enabled=null;void refresh();
});
void refresh();
