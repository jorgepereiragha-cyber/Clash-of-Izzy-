import { renderWorldEventCards, loadValhallaEventConfig } from "./event-catalog.js";

const API="/api";
const $=id=>document.getElementById(id);
function readEventSession(){
 let readable=false;
 for(const getStore of [()=>window.localStorage,()=>window.sessionStorage]){
  try{const saved=getStore().getItem("coi_game_token");readable=true;if(saved)return {token:saved,blocked:false};}catch{}
 }
 return {token:"",blocked:!readable};
}
const eventSession=readEventSession();
const token=eventSession.token;
const unitNames={militia:"Milícia",swordsman:"Espadachim",spearman:"Lanceiro",archer:"Arqueiro",crossbowman:"Besteiro",cavalry:"Cavalaria",knight:"Cavaleiro",catapult:"Catapulta",ram:"Aríete",trebuchet:"Trabuquete"};
let state=null,eventState=null,valhallaConfig=null,busy=false,selected={},pendingRequestId=null,pendingAttackUnits=null,pendingEventId=null;
let refreshGeneration=0;
try{
 pendingRequestId=sessionStorage.getItem("coi_angel_death_request")||null;
 const storedEventId=Number(sessionStorage.getItem("coi_angel_death_event_id"));
 if(pendingRequestId&&Number.isSafeInteger(storedEventId)&&storedEventId>0)pendingEventId=storedEventId;
 const storedUnits=sessionStorage.getItem("coi_angel_death_units");
 if(pendingRequestId&&storedUnits){
  const parsed=JSON.parse(storedUnits);
  if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed)&&Object.keys(parsed).length>0)
   pendingAttackUnits=parsed;
 }
}catch{}
const fmt=value=>Number(value||0).toLocaleString("pt-BR");
function make(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;}
function message(text,error=false){$("message").textContent=text;$("message").style.color=error?"#ffb4a9":"#f3d99f";}
async function request(path,options={}){const response=await fetch(API+path,{...options,headers:{...(options.headers||{}),...(token?{Authorization:"Bearer "+token}:{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Falha ao comunicar com o servidor.");return data;}
function dateLabel(value){return value?new Date(value).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"—";}
function renderCountdown(){const event=eventState?.event;if(!event){$("countdown").textContent="Próximo ciclo será criado automaticamente.";return;}const start=Date.parse(event.starts_at),end=Date.parse(event.ends_at),now=Date.now();const target=event.status==="scheduled"?start:end;const seconds=Math.max(0,Math.floor((target-now)/1000));const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;const left=[days?days+"d":"",hours+"h",minutes+"m",secs+"s"].filter(Boolean).join(" ");$("countdown").textContent=event.status==="scheduled"?"Começa em "+left:event.status==="completed"?"Evento encerrado":"Termina em "+left;}
function renderTroops(){const root=$("troops");root.replaceChildren();const troops=(state?.troops||[]).filter(row=>Number(row.quantity)>0);if(!troops.length){root.append(make("div","muted","Você não possui tropas disponíveis. Treine tropas no seu reino antes do evento."));return;}for(const unit of troops){const key=unit.unit_type+"_"+unit.tier;const row=make("div","troop");const label=make("label","",(unitNames[unit.unit_type]||unit.unit_type)+" · T"+unit.tier);label.append(make("small","","Disponíveis: "+fmt(unit.quantity)));const input=make("input");input.type="number";input.min="0";input.max=String(unit.quantity);input.step="1";input.inputMode="numeric";input.setAttribute("aria-label","Quantidade de "+(unitNames[unit.unit_type]||unit.unit_type)+" nível "+unit.tier);input.value=String(Math.min(Number(selected[key]||0),Number(unit.quantity)));input.addEventListener("input",()=>{selected[key]=Math.max(0,Math.min(Number(unit.quantity),Math.floor(Number(input.value)||0)));input.value=String(selected[key]);updateAttackButton();});row.append(label,input);root.append(row);}}
function renderLeaderboard(){const root=$("leaderboard");root.replaceChildren();const rows=eventState?.leaderboard||[];if(!rows.length){root.append(make("div","muted","Ainda não há pontuação. Seja o primeiro a enfrentar o Anjo da Morte."));return;}const table=make("table","leaderboard"),head=make("thead"),hr=make("tr");for(const label of ["Pos.","Jogador / Reino","Pontuação"]){hr.append(make("th","",label));}head.append(hr);table.append(head);const body=make("tbody");rows.forEach((player,index)=>{const tr=make("tr"),position=make("td","",index+1+"º"),name=make("td","",player.display_name+" · "+player.kingdom_name),score=make("td","",fmt(player.score));tr.append(position,name,score);body.append(tr);});table.append(body);root.append(table);}
function updateAttackButton(){const event=eventState?.event;const retry=Boolean(pendingRequestId&&pendingAttackUnits);const legacy=Boolean(pendingRequestId&&!pendingEventId);const units=retry?pendingAttackUnits:selected;const selectedCount=Object.values(units).reduce((sum,value)=>sum+Number(value||0),0);$("attack").textContent=legacy?"⚠️ CONFIRA TENTATIVA ANTERIOR":retry?"↻ REENVIAR ATAQUE PENDENTE":"⚔️ ATACAR O ANJO DA MORTE";$("attack").disabled=busy||legacy||!event||event.status!=="active"||Number(event.boss_hp_remaining)<=0||selectedCount<1;$("discardPendingAttack").hidden=!pendingRequestId;$("discardPendingAttack").disabled=busy;}
function render(){renderWorldEventCards({eventState,valhallaConfig});const event=eventState?.event;if(!event){$("eventStatus").textContent="Evento aguardando calendário";$("bossHpText").textContent="O calendário mundial será sincronizado em instantes.";updateAttackButton();return;}const active=event.status==="active"&&Number(event.boss_hp_remaining)>0;const status=event.status==="scheduled"?"AGENDADO":event.status==="completed"?"ENCERRADO":Number(event.boss_hp_remaining)<=0?"CHEFE DERROTADO":"EM ANDAMENTO";$("eventStatus").textContent=status;$("schedule").textContent=dateLabel(event.starts_at)+" até "+dateLabel(event.ends_at)+" · Horário de Brasília";const hp=Math.max(0,Number(event.boss_hp_remaining||0)),max=Math.max(1,Number(event.boss_hp_total||1)),percent=Math.max(0,Math.min(100,hp/max*100));$("bossHpBar").style.width=percent+"%";$("bossHpText").textContent=fmt(hp)+" / "+fmt(max)+" pontos de vida · "+percent.toFixed(4).replace(".",",")+"% restantes";const p=eventState.participant||{};$("myScore").textContent=fmt(p.score);$("myRank").textContent=p.rank?fmt(p.rank)+"º":"—";$("myAttacks").textContent=fmt(p.attacks);$("myLosses").textContent=fmt(p.troops_lost);const essence=(state?.inventoryItems||[]).find(item=>item.item_key==="death_essence");$("myEssence").textContent=fmt(essence?.quantity);renderLeaderboard();renderCountdown();renderTroops();updateAttackButton();if(!active&&event.status==="active")message("O chefe foi derrotado. A classificação permanece aberta até o encerramento do fim de semana.");}
async function refresh(force=false){if(busy&&!force)return;const generation=++refreshGeneration;try{const [game,event,seasonConfig]=await Promise.all([request("/game/state"),request("/game/event"),loadValhallaEventConfig().catch(()=>valhallaConfig)]);if(generation!==refreshGeneration)return;state=game.state||game;eventState=event;valhallaConfig=seasonConfig;
 const currentEventId=Number(eventState?.event?.id);
 if(pendingRequestId&&pendingEventId&&Number.isSafeInteger(currentEventId)&&currentEventId>0&&currentEventId!==pendingEventId){
  // A completed weekend's idempotency key must never be reused in a new event.
  pendingRequestId=null;pendingAttackUnits=null;pendingEventId=null;
  try{sessionStorage.removeItem("coi_angel_death_request");sessionStorage.removeItem("coi_angel_death_units");sessionStorage.removeItem("coi_angel_death_event_id");}catch{}
  message("Tentativa pendente de outro ciclo descartada. Consulte o resultado anterior antes de enviar novas tropas.");
 }
 render();return true;}catch(error){if(generation===refreshGeneration)message(error.message,true);return false;}}
async function attack(){
 if(busy)return;
 const pendingReplay=Boolean(pendingRequestId&&pendingAttackUnits);
 const units=pendingReplay?pendingAttackUnits:Object.fromEntries(Object.entries(selected).filter(([,quantity])=>Number(quantity)>0));
 if(!Object.keys(units).length)return;
 const total=Object.values(units).reduce((sum,value)=>sum+Number(value),0);
 const explanation=pendingReplay
  ?"Há uma tentativa anterior de "+fmt(total)+" tropas sem confirmação. Reenviar a MESMA composição? Se o ataque já foi registrado, ele não será duplicado. Caso contrário, poderá ser executado agora e causar perdas permanentes."
  :"Você enviará "+fmt(total)+" tropas. As baixas deste evento são permanentes. Deseja confirmar o ataque?";
 if(!confirm(explanation))return;
 busy=true;++refreshGeneration;updateAttackButton();
 if(!pendingRequestId)pendingRequestId=crypto.randomUUID();
 if(!pendingAttackUnits)pendingAttackUnits={...units};
 if(!pendingEventId)pendingEventId=Number(eventState?.event?.id)||null;
 try{
  sessionStorage.setItem("coi_angel_death_request",pendingRequestId);
  sessionStorage.setItem("coi_angel_death_units",JSON.stringify(pendingAttackUnits));
  if(pendingEventId)sessionStorage.setItem("coi_angel_death_event_id",String(pendingEventId));
 }catch{}
 message(pendingReplay?"Reenviando a solicitação original; a primeira execução poderá ocorrer agora…":"O exército está avançando contra o Anjo da Morte…");
 try{
  const result=await request("/game/event/attack",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({requestId:pendingRequestId,units:pendingAttackUnits})});
  try{sessionStorage.removeItem("coi_angel_death_request");sessionStorage.removeItem("coi_angel_death_units");sessionStorage.removeItem("coi_angel_death_event_id");}catch{}
  pendingRequestId=null;pendingAttackUnits=null;pendingEventId=null;selected={};
  const losses=Object.entries(result.losses||{}).filter(([,value])=>Number(value)>0)
   .map(([key,value])=>key.replace("_"," T")+" × "+fmt(value)).join(", ");
  const resultMessage="Dano: "+fmt(result.damage)+" · Tropas perdidas: "+fmt(result.troopsLost)+(losses?" ("+losses+")":"");
  message(resultMessage);
  const refreshed=await refresh(true);
  if(!refreshed)message(resultMessage+" · O ataque foi confirmado, mas o placar não pôde ser atualizado. Use Atualizar.",true);
 }catch(error){message(error.message,true);}
 finally{busy=false;updateAttackButton();}
}
$("attack").addEventListener("click",attack);
$("discardPendingAttack").addEventListener("click",()=>{
 if(!pendingRequestId||busy)return;
 if(!confirm("Descartar a tentativa de reenvio salva neste dispositivo? Um ataque anterior pode ter sido processado. Confira primeiro pontuação e tropas. Descartar NÃO desfaz baixas já aplicadas."))return;
 pendingRequestId=null;pendingAttackUnits=null;pendingEventId=null;
 try{sessionStorage.removeItem("coi_angel_death_request");sessionStorage.removeItem("coi_angel_death_units");sessionStorage.removeItem("coi_angel_death_event_id");}catch{}
 updateAttackButton();
 message("Tentativa de reenvio descartada neste dispositivo. Confira os resultados antes de iniciar outro ataque.");
});
$("refresh").addEventListener("click",refresh);
let countdownTimer = null;
let eventRefreshTimer = null;
function stopEventTimers(){
 if(countdownTimer!==null){clearInterval(countdownTimer);countdownTimer=null;}
 if(eventRefreshTimer!==null){clearInterval(eventRefreshTimer);eventRefreshTimer=null;}
}
function startEventTimers(){
 if(document.hidden)return;
 if(countdownTimer===null)countdownTimer=window.setInterval(renderCountdown,1000);
 if(eventRefreshTimer===null)eventRefreshTimer=window.setInterval(refresh,20000);
}
if(!token){
 if(eventSession.blocked){
  $("eventStatus").textContent="Sessão indisponível";
  const notice=$("message");
  notice.replaceChildren(document.createTextNode("O navegador bloqueou o armazenamento da sessão. Autorize os dados do site e "));
  const account=make("a","","acesse sua conta");account.href="/account.html";notice.append(account);
  $("attack").disabled=true;
 }else location.replace("/kingdom.html");
}else{
 refresh();
 startEventTimers();
 document.addEventListener("visibilitychange",()=>{
  if(document.hidden)stopEventTimers();
  else{renderCountdown();refresh();startEventTimers();}
 });
 window.addEventListener("coi:app-resume",event=>{if(event.detail?.reason==="online")refresh();});
 window.addEventListener("pagehide",stopEventTimers);
 window.addEventListener("pageshow",event=>{if(event.persisted&&!document.hidden){renderCountdown();refresh();startEventTimers();}});
}
