// Read-only field guide for persisted beta monsters. Never dispatch a march.
const root=document.getElementById("worldMonsterPreview");
const list=document.getElementById("worldMonsterList");
const status=document.getElementById("worldMonsterStatus");
const ICONS=Object.freeze({ash_wolf:"🐺",iron_boar:"🐗",frost_bear:"🐻",marsh_wyrm:"🐍",stone_golem:"🗿",ember_drake:"🐲"});
function token(){
 for(const key of ["localStorage","sessionStorage"]){
  try{const value=window[key]?.getItem("coi_game_token");if(value)return value;}catch{}
 }
 return "";
}
function element(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el;}
let busy=false;
async function refresh(){
 const bearer=token();if(!bearer||busy||!root||!list||!status)return;
 busy=true;
 try{
  const response=await fetch("/api/game/world-monsters",{headers:{Authorization:"Bearer "+bearer},cache:"no-store",redirect:"error"});
  if(!response.ok)throw Error("Consulta indisponível");
  const data=await response.json();
  if(!data.enabled){root.hidden=true;return;}
  root.hidden=false;
  const rows=Array.isArray(data.monsters)?data.monsters:[];
  list.replaceChildren();
  for(const monster of rows){
   const item=element("article");item.className="stat";
   const max=Math.max(1,Number(monster.max_hp)||1);
   const hp=Math.max(0,Math.min(max,Number(monster.hp)||0));
   item.append(element("b",(ICONS[monster.monster_key]||"◆")+" "+monster.name+" · Nv. "+monster.level));
   const meter=element("progress");meter.max=max;meter.value=hp;meter.setAttribute("aria-label","Vida de "+monster.name);
   item.append(meter,element("span",hp+" / "+max+" PV · X "+monster.x+" / Z "+monster.z));
   item.append(element("span",hp>0?"Disponível para visualização":"Aguardando reaparecimento"));
   list.append(item);
  }
  status.textContent=rows.length+" criaturas no seu reino · prévia; caça ainda não liberada.";
 }catch{root.hidden=false;list.replaceChildren();status.textContent="Não foi possível carregar os monstros. Tente atualizar.";}
 finally{busy=false;}
}
document.getElementById("worldMonsterRefresh")?.addEventListener("click",refresh);
void refresh();
