const API="/api";
let adminToken=sessionStorage.getItem("coi_admin_token")||"",selectedPlayerId=null;
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=value=>Number(value||0).toLocaleString("pt-BR");
function notice(message,type=""){const el=$("notice");el.textContent=message;el.className="notice"+(type?" "+type:"");}
async function api(path,payload={}){
 const response=await fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json",...(adminToken?{Authorization:"Bearer "+adminToken}:{})},body:JSON.stringify(payload)});
 const data=await response.json().catch(()=>({error:"Resposta inválida do servidor."}));
 if(!response.ok){if(response.status===401&&adminToken){adminToken="";sessionStorage.removeItem("coi_admin_token");showLogin();}throw new Error(data.error||"Falha na solicitação.");}
 return data;
}
function showLogin(){ $("login").classList.remove("hidden");$("app").classList.add("hidden");$("toolbar").classList.add("hidden"); }
function showApp(){ $("login").classList.add("hidden");$("app").classList.remove("hidden");$("toolbar").classList.remove("hidden"); }
async function login(email,password){
 const response=await fetch(API+"/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
 const data=await response.json().catch(()=>({error:"Resposta inválida do servidor."}));
 if(!response.ok)throw new Error(data.error||"Não foi possível entrar.");
 adminToken=data.token;sessionStorage.setItem("coi_admin_token",adminToken);showApp();await loadDashboard();
}
async function loadOverview(){
 const data=await api("/admin/overview");
 const cards=[["Jogadores",data.overview.players],["Reinos",data.overview.kingdoms],["Alianças",data.overview.alliances],["Marchas ativas",data.overview.activeMarches],["Eventos · 24h",data.overview.events24h]];
 $("overview").innerHTML=cards.map(([label,value])=>'<article class="stat"><small>'+esc(label)+'</small><strong>'+fmt(value)+'</strong></article>').join("");
 renderAudit(data.audit||[]);
}
async function loadDashboard(){showApp();await Promise.all([loadOverview(),loadCatalog()]);notice("Painel conectado ao servidor do jogo.","ok");}
function renderAudit(rows){
 $("auditList").innerHTML=rows.length?rows.map(row=>{let details={};try{details=JSON.parse(row.details_json||"{}")}catch{}return '<div class="row"><div><strong>'+esc(row.action)+'</strong><div class="muted">'+esc(row.created_at)+' · '+esc(row.actor)+' · '+esc(row.target_player_id||"Sistema")+'</div><small>'+esc(JSON.stringify(details))+'</small></div></div>'}).join(""):'<p class="muted">Nenhuma ação administrativa registrada.</p>';
}
async function loadCatalog(){
 try{const response=await fetch(API+"/store/catalog");const data=await response.json();if(!response.ok)throw new Error(data.error||"Catálogo indisponível.");
  $("skinChoice").innerHTML=(data.skins||[]).map(s=>'<option value="'+esc(s.name)+'">'+esc(s.name)+' · R$ '+Number(s.price_brl||0).toFixed(2)+'</option>').join("")||'<option value="">Nenhuma skin cadastrada</option>';
  $("catalogView").innerHTML='<div class="item"><strong>Skins</strong><div class="muted">'+(data.skins||[]).length+' cadastradas</div>'+((data.skins||[]).slice(0,30).map(s=>'<div class="row">'+esc(s.name)+' <small>R$ '+Number(s.price_brl||0).toFixed(2)+'</small></div>').join(""))+'</div><div class="item"><strong>Pacotes VIP</strong><div class="muted">'+(data.packages||[]).length+' cadastrados</div>'+((data.packages||[]).map(p=>'<div class="row">'+esc(p.name)+' <small>R$ '+Number(p.price_brl||0).toFixed(2)+' · '+fmt(p.gems)+' gemas</small></div>').join(""))+'</div>';
 }catch(error){$("catalogView").textContent=error.message;}
}
async function searchPlayers(query){
 const data=await api("/admin/player-search",{query});
 const rows=data.players||[];
 $("results").innerHTML=rows.length?rows.map(p=>'<button class="player-result" type="button" data-player-id="'+esc(p.player_id)+'"><span><strong>'+esc(p.kingdom_name||p.name||"Reino sem nome")+'</strong><small>'+esc(p.name)+' · '+esc(p.player_id)+'</small></span><span><small>Castelo '+fmt(p.castle_level)+' · Poder '+fmt(p.power)+'</small><small>💎 '+fmt(p.gems)+'</small></span></button>').join(""):'<p class="muted">Nenhum jogador encontrado.</p>';
}
function renderState(state){
 if(!state){$("playerState").innerHTML='<p class="muted">Estado do reino indisponível.</p>';return;}
 const k=state.kingdom||{},p=state.player||{};
 const resources=[["Comida",k.food],["Madeira",k.wood],["Pedra",k.stone],["Ferro",k.iron],["Ouro",k.gold],["Gemas",p.gems]];
 const sections=[
  ["Edifícios",state.buildings||[],x=>(x.building_type||"")+" · nível "+fmt(x.level)],
  ["Tropas",state.troops||[],x=>(x.unit_type||"")+" · T"+fmt(x.tier)+" · "+fmt(x.quantity)+" · feridos "+fmt(x.wounded)],
  ["Heróis",state.heroInventory?.length?state.heroInventory:(state.heroes||[]),x=>(x.name||x.hero_name||x.hero_key||"Herói")+" · nível "+fmt(x.level)+" · "+(x.rarity_label||x.rarity||"")],
  ["Dragão",state.dragon?[state.dragon]:[],x=>(x.dragon_name||x.dragon_key||"Dragão")+" · nível "+fmt(x.level)+" · vínculo "+fmt(x.bond)+"/100"],
  ["Pesquisas",state.research||[],x=>(x.research_key||"Pesquisa")+" · nível "+fmt(x.level)],
  ["Marchas",state.marches||[],x=>(x.march_type||"")+" · "+(x.status||"")+" · "+(x.arrives_at||"")],
  ["Relatórios de batalha",state.battleReports||[],x=>(x.battle_type||"Batalha")+" · "+(x.created_at||"")+" · força "+fmt(x.attacker_power)+"/"+fmt(x.defender_power)],
  ["Inventário",state.inventoryItems||[],x=>(x.item_key||"Item")+" · "+fmt(x.quantity)]
 ];
 $("playerState").innerHTML='<div class="kv">'+resources.map(([label,value])=>'<div><small>'+label+'</small><strong>'+fmt(value)+'</strong></div>').join("")+'</div>'+sections.map(([title,rows,format])=>'<div class="item" style="margin-top:9px"><strong>'+title+' ('+rows.length+')</strong><div class="list">'+(rows.length?rows.slice(0,40).map(x=>'<div class="row">'+esc(format(x))+'</div>').join(""):'<small>Sem registros.</small>')+'</div></div>').join("")+'<details style="margin-top:10px"><summary>Ver dados completos do jogador (JSON)</summary><pre>'+esc(JSON.stringify(state,null,2))+'</pre></details>';
}
async function openPlayer(id){
 selectedPlayerId=id;notice("Carregando ficha do jogador…");
 const data=await api("/admin/player-detail",{playerId:id}),p=data.player||{},k=data.state?.kingdom||{};
 $("playerPanel").classList.remove("hidden");
 $("playerSummary").innerHTML='<div class="kv"><div><small>Nick</small><strong>'+esc(p.name)+'</strong></div><div><small>Nome do reino</small><strong>'+esc(p.kingdom_name||"—")+'</strong></div><div><small>ID</small><strong>'+esc(p.player_id)+'</strong></div><div><small>Castelo / poder</small><strong>'+fmt(p.castle_level)+' / '+fmt(p.power)+'</strong></div><div><small>Gemas</small><strong>'+fmt(p.gems)+'</strong></div><div><small>Criado em</small><strong>'+esc(p.created_at)+'</strong></div></div>';
 $("kingdomName").value=p.kingdom_name||"";
 renderState(data.state);notice("Ficha de "+(p.kingdom_name||p.name)+" carregada.","ok");
}
async function refreshSelected(){if(selectedPlayerId)await openPlayer(selectedPlayerId);await loadOverview();}
async function mutate(path,payload,message){
 await api(path,payload);notice(message,"ok");await refreshSelected();
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();try{await login($("email").value.trim(),$("password").value);$("password").value="";}catch(error){adminToken="";sessionStorage.removeItem("coi_admin_token");showLogin();notice(error.message,"error");}});
$("logout").addEventListener("click",()=>{adminToken="";selectedPlayerId=null;sessionStorage.removeItem("coi_admin_token");$("playerPanel").classList.add("hidden");showLogin();notice("Sessão administrativa encerrada.");});
$("refresh").addEventListener("click",async()=>{try{await loadDashboard();if(selectedPlayerId)await openPlayer(selectedPlayerId);}catch(error){notice(error.message,"error");}});
$("searchForm").addEventListener("submit",async e=>{e.preventDefault();try{await searchPlayers($("searchQuery").value.trim());}catch(error){notice(error.message,"error");}});
$("results").addEventListener("click",async e=>{const button=e.target.closest("[data-player-id]");if(!button)return;try{await openPlayer(button.dataset.playerId);}catch(error){notice(error.message,"error");}});
$("resourceForm").addEventListener("submit",async e=>{e.preventDefault();if(!selectedPlayerId)return;const amount=Number($("resourceAmount").value);if(!Number.isSafeInteger(amount)||amount===0){notice("Informe uma quantidade inteira diferente de zero.","error");return;}if(!confirm("Aplicar "+amount+" de "+$("resource").value+" ao jogador?"))return;try{await mutate("/admin/resource-adjust",{playerId:selectedPlayerId,resource:$("resource").value,amount},"Recurso atualizado e registrado na auditoria.");}catch(error){notice(error.message,"error");}});
$("renameForm").addEventListener("submit",async e=>{e.preventDefault();if(!selectedPlayerId)return;try{await mutate("/admin/rename-kingdom",{playerId:selectedPlayerId,name:$("kingdomName").value.trim()},"Nome do reino atualizado.");}catch(error){notice(error.message,"error");}});
$("skinUnlockForm").addEventListener("submit",async e=>{e.preventDefault();if(!selectedPlayerId)return;const skin=$("skinChoice").value;if(!skin)return;try{await api("/admin/unlock-skin",{playerId:selectedPlayerId,skin});notice("Skin liberada para o jogador.","ok");await refreshSelected();}catch(error){notice(error.message,"error");}});
$("newSkinForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/admin/skins",{name:$("newSkinName").value.trim(),price:Number($("newSkinPrice").value)});$("newSkinForm").reset();await loadCatalog();await loadOverview();notice("Skin cadastrada no catálogo.","ok");}catch(error){notice(error.message,"error");}});
$("vipForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/admin/vip-packages",{name:$("vipName").value.trim(),price:Number($("vipPrice").value),gems:Number($("vipGems").value)});$("vipForm").reset();await loadCatalog();await loadOverview();notice("Pacote VIP cadastrado.","ok");}catch(error){notice(error.message,"error");}});
document.querySelectorAll("nav [data-tab]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("nav [data-tab]").forEach(x=>x.setAttribute("aria-selected",String(x===button)));document.querySelectorAll(".section").forEach(x=>x.classList.toggle("active",x.id==="section-"+button.dataset.tab));}));
async function boot(){if(!adminToken){showLogin();return;}try{await loadDashboard();}catch(error){adminToken="";sessionStorage.removeItem("coi_admin_token");showLogin();notice(error.message,"error");}}
boot();
