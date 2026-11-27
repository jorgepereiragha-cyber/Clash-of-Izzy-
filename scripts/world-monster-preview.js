import {createEntityArtElement} from "./kingdom-2d-art-atlas.js";
// Read-only field guide for persisted beta monsters. Never dispatch a march.
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
let pins=new Map(),cards=new Map(),selected=null;
function projectPins(){
 for(const {button,monster} of pins.values()){
  const x=Number(monster.x),z=Number(monster.z);
  const point=!mapHost?.classList.contains("map-3d-fallback")?window.__coiWorldMap3D?.projectPoint?.(x,z):null;
  button.style.left=point?point.left+"px":Math.max(9,Math.min(91,50+x*.9))+"%";
  button.style.top=point?point.top+"px":Math.max(10,Math.min(90,50-z*.9))+"%";
 }
}
function clearPins(){for(const {button} of pins.values())button.remove();pins.clear();cards.clear();}
function selectMonster(id,showGuide=false){
 selected=id;
 for(const [key,{button}] of pins){button.classList.toggle("selected",key===id);button.setAttribute("aria-pressed",String(key===id));}
 for(const [key,card] of cards)card.classList.toggle("monster-selected",key===id);
 if(showGuide)cards.get(id)?.scrollIntoView({block:"nearest",behavior:"auto"});
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
let busy=false;
async function refresh(){
 const bearer=token();if(!bearer||busy||!root||!list||!status)return;
 busy=true;
 try{
  const response=await fetch("/api/game/world-monsters",{headers:{Authorization:"Bearer "+bearer},cache:"no-store",redirect:"error"});
  if(!response.ok)throw Error("Consulta indisponível");
  const data=await response.json();
  if(!data.enabled){root.hidden=true;clearPins();list.replaceChildren();return;}
  root.hidden=false;
  const rows=Array.isArray(data.monsters)?data.monsters:[];
  clearPins();list.replaceChildren();
  for(const monster of rows){
   const id=String(monster.id);
   const item=element("article");item.className="stat";
   const max=Math.max(1,Number(monster.max_hp)||1);
   const hp=Math.max(0,Math.min(max,Number(monster.hp)||0));
   const heading=element("b");heading.className="monster-heading";heading.append(monsterArt(monster.monster_key),element("span",monster.name+" · Nv. "+monster.level));item.append(heading);
   const meter=element("progress");meter.max=max;meter.value=hp;meter.setAttribute("aria-label","Vida de "+monster.name);
   item.append(meter,element("span",hp+" / "+max+" PV · X "+monster.x+" / Z "+monster.z));
   item.append(element("span",hp>0?"Disponível para visualização":"Aguardando reaparecimento"));
   const button=element("button","Localizar no mapa");button.type="button";button.className="secondary";
   button.addEventListener("click",()=>{selectMonster(id);mapHost?.scrollIntoView({block:"nearest",behavior:"auto"});pins.get(id)?.button.focus({preventScroll:true});});
   item.append(button);list.append(item);cards.set(id,item);addPin(monster,id,hp);
  }
  selectMonster(pins.has(selected)?selected:null);projectPins();
  status.textContent=rows.length+" criaturas no seu reino · prévia; caça ainda não liberada.";
 }catch{root.hidden=false;clearPins();list.replaceChildren();status.textContent="Não foi possível carregar os monstros. Tente atualizar.";}
 finally{busy=false;}
}
document.getElementById("worldMonsterRefresh")?.addEventListener("click",refresh);
void refresh();
