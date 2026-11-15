const API="/api";
const BUILDINGS={castle:"Castelo",barracks:"Quartel",farm:"Fazenda",quarry:"Pedreira",lumber_mill:"Serraria",iron_mine:"Mina de ferro",market:"Mercado",academy:"Academia",wall:"Muralha",hospital:"Hospital",watchtower:"Torre de vigia",stable:"Estábulo",archery_range:"Campo de arqueiros",siege_workshop:"Oficina de cerco",embassy:"Embaixada",warehouse:"Armazém"};
const UNITS={militia:"Milícia",swordsman:"Espadachim",spearman:"Lanceiro",archer:"Arqueiro",crossbowman:"Besteiro",cavalry:"Cavalaria",knight:"Cavaleiro",mage:"Mago",catapult:"Catapulta",ram:"Aríete",trebuchet:"Trabuquete"};
const RESEARCH={economy:"Economia",military:"Doutrina militar",construction:"Construção",defense:"Defesa"};
let state=null,token=null,busy=false;
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=value=>Number(value||0).toLocaleString("pt-BR");
function notice(message,type=""){const el=$("notice");el.textContent=message;el.className="notice"+(type?" "+type:"")}
function setConnection(message){$("connection").textContent=message}
async function request(path,options={}){const response=await fetch(API+path,{...options,headers:{...(options.headers||{}),...(token?{Authorization:"Bearer "+token}:{})}});const data=await response.json().catch(()=>({error:"Resposta inválida do servidor."}));if(!response.ok)throw new Error(data.error||"Falha de comunicação.");return data}
async function connect(){
 token=localStorage.getItem("coi_game_token")||sessionStorage.getItem("coi_game_token");
 try{
  let data;
  if(token){try{data=await request("/game/state")}catch{localStorage.removeItem("coi_game_token");sessionStorage.removeItem("coi_game_token");token=null}}
  if(!data){data=await request("/game/start",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});token=data.token;if(token){localStorage.setItem("coi_game_token",token);sessionStorage.setItem("coi_game_token",token)}}
  state=data.state;setConnection("🏰 "+(state.kingdom?.kingdom_name||"Reino conectado")+" · Sessão autenticada no servidor.");render();notice("Seu reino está conectado.","ok");
 }catch(error){setConnection("⚠ Não foi possível conectar: "+error.message);notice("Verifique a conexão e a configuração do servidor.","error")}
}
function render(){
 if(!state)return;
 const k=state.kingdom||{},p=state.player||{};
 $("resources").innerHTML=[["🌾","Comida",k.food],["🪵","Madeira",k.wood],["🪨","Pedra",k.stone],["⛓","Ferro",k.iron],["🪙","Ouro",k.gold],["💎","Gemas",p.gems]].map(([icon,label,value])=>'<div class="resource"><small>'+icon+" "+label+'</small><strong>'+n(value)+'</strong></div>').join("");
 $("summary").innerHTML=[["🏰 Castelo","Nível "+n(k.castle_level)],["⚔ Tropas",n(state.totalTroops)],["🐉 Dragão","Nível "+n(state.dragon?.level)],["🛡 Aliança",state.alliance?esc(state.alliance.tag):"Sem aliança"]].map(([label,value])=>'<div class="tile"><small>'+label+'</small><strong>'+value+"</strong></div>").join("");
 renderBuildings();renderTroops();renderResearch();renderWorld();renderHeroes();renderDragon();renderAlliance();renderBattles();
}
function renderBuildings(){
 const rows=state.buildings||[];
 $("buildings").innerHTML=rows.map(b=>{const name=BUILDINGS[b.building_type]||b.building_type;const level=Number(b.level||1);const cap=b.building_type==="castle"?30:Math.min(30,Number(state.kingdom?.castle_level||1));return '<article class="item"><h3>'+esc(name)+'</h3><div class="muted">Nível '+level+' · '+(level>=cap?"Limite atual atingido":"Próximo nível: "+(level+1))+'</div><div class="row"><span class="pill">'+(b.building_type==="castle"?"Centro do reino":"Estrutura")+'</span><button data-upgrade="'+esc(b.building_type)+'" '+(level>=cap?"disabled":"")+'>'+(level>=cap?"No limite":"Melhorar")+"</button></div></article>"}).join("")||'<div class="empty">Nenhuma construção retornada pelo servidor.</div>';
}
function renderTroops(){
 const rows=state.troops||[];
 $("troops").innerHTML=rows.map(u=>'<article class="item"><h3>'+esc(UNITS[u.unit_type]||u.unit_type)+'</h3><div class="muted">Nível '+n(u.tier)+' · Feridos '+n(u.wounded)+'</div><div class="row"><strong>'+n(u.quantity)+' unidades</strong><span class="pill">Reserva</span></div></article>').join("")||'<div class="empty">Seu exército está vazio. Treine sua primeira unidade.</div>';
 const options=rows.filter(u=>Number(u.quantity)>0&&Number(u.tier)===1).map(u=>'<option value="'+esc(u.unit_type)+'">'+esc(UNITS[u.unit_type]||u.unit_type)+' · '+n(u.quantity)+'</option>').join("");
 $("marchUnit").innerHTML=options||'<option value="militia">Milícia</option>';
}
function renderResearch(){
 $("researchList").innerHTML=Object.entries(RESEARCH).map(([key,label])=>{const level=Number((state.research||[]).find(x=>x.research_key===key)?.level||0);return '<article class="item"><h3>'+label+'</h3><div class="muted">Nível atual: '+level+' / 30</div><div class="row"><span class="pill">Tecnologia do reino</span><button data-research="'+key+'" '+(level>=30?"disabled":"")+'>Pesquisar</button></div></article>'}).join("");
}
function renderWorld(){
 const marches=state.marches||[];
 $("marches").innerHTML=marches.length?marches.slice(0,8).map(m=>'<div class="item"><b>Marcha #'+n(m.id)+'</b><div class="muted">'+esc(m.march_type)+' · '+esc(m.status)+' · chegada '+esc(m.arrives_at||"")+'</div></div>').join(""):'<div class="empty">Nenhuma marcha recente.</div>';
 const territories=state.territories||[],ownId=Number(state.kingdom?.id);
 $("territories").innerHTML=territories.map(t=>{const owned=Number(t.owner_kingdom_id)===ownId;const neutral=!t.owner_kingdom_id;const owner=owned?"Seu território":neutral?"Neutro":"Ocupado";return '<article class="item"><h3>'+esc(t.name||"Território")+'</h3><div class="muted">'+esc(t.terrain||"Terreno")+' · Nível '+n(t.level)+' · '+esc(t.resource_type||"Sem recurso")+' · '+n(t.resource_rate)+'/h</div><div class="row"><span class="pill">'+owner+'</span><span class="muted">#'+n(t.id)+'</span></div><div class="row"><button data-march="gather" data-target="'+n(t.id)+'" '+(!owned&&!neutral?"disabled":"")+'>Coletar</button><button data-march="scout" data-target="'+n(t.id)+'" '+(!owned&&!neutral?"disabled":"")+'>Explorar</button><button data-march="attack" data-target="'+n(t.id)+'" '+(!neutral?"disabled":"")+'>Atacar</button></div></article>'}).join("")||'<div class="empty">Mapa indisponível.</div>';
}
function renderHeroes(){
 const heroes=state.heroInventory||[];
 $("heroes").innerHTML=heroes.map(h=>'<article class="item"><h3>'+esc(h.name||h.hero_key)+'</h3><div class="muted">'+esc(h.title||"Herói")+' · '+esc(h.rarity_label||h.rarity)+'</div><div class="row"><strong>Nível '+n(h.level)+' · '+n(h.stars)+'★</strong><span class="pill">'+n(h.fragments)+' fragmentos</span></div>'+(h.fragments_to_next?'<div class="row"><span class="muted">Próxima estrela: '+n(h.fragments_to_next)+'</span><button data-evolve="'+esc(h.hero_key)+'">Evoluir</button></div>':"")+'</article>').join("")||'<div class="empty">Sua coleção ainda está vazia. Use Invocar para recrutar heróis.</div>';
}
function renderDragon(){const d=state.dragon;$("dragon").innerHTML=d?'<div class="item"><h3>'+esc(d.dragon_name||d.dragon_key||"Dragão do Reino")+'</h3><div class="muted">Nível '+n(d.level)+' · Experiência '+n(d.experience)+' · Vínculo '+n(d.bond)+'/100</div></div>':'<div class="empty">Nenhum dragão foi vinculado a este reino ainda.</div>';$("dragonUpgrade").disabled=!d||Number(d.level)>=100}
function renderAlliance(){
 const a=state.alliance;
 $("allianceInfo").innerHTML=a?'<div class="item"><h3>['+esc(a.tag)+'] '+esc(a.name)+'</h3><div class="muted">'+n(a.member_count)+' membros · Nível '+n(a.level)+' · '+n(a.territory_count)+' territórios</div><div class="muted">Seu cargo: '+esc(a.rank||a.role||"membro")+'</div></div>':'<div class="empty">Você ainda não pertence a uma aliança. Crie uma ou entre usando a sigla.</div>';
 $("allianceCreate").hidden=!!a;$("allianceJoin").hidden=!!a;$("warForm").hidden=!a||!["lider","co_lider","oficial"].includes(a.rank);
 const msgs=a?.chat||[];$("chatMessages").innerHTML=msgs.length?msgs.map(m=>'<div class="msg"><b>'+esc(m.kingdom_name||"Jogador")+'</b><div>'+esc(m.message)+'</div><small>'+esc(m.created_at||"")+'</small></div>').join(""):'<div class="empty">Sem mensagens. O chat é atualizado ao recarregar o painel.</div>';
}
function renderBattles(){const rows=state.battleReports||[];$("battles").innerHTML=rows.slice(0,5).map(b=>'<div class="item"><b>'+esc(b.battle_type||"Batalha")+'</b><div class="muted">Força '+n(b.attacker_power)+' · Inimigo '+n(b.defender_power)+' · '+esc(b.created_at||"")+'</div></div>').join("")||'<div class="muted">Nenhuma batalha registrada.</div>'}
async function refresh(){if(busy)return;try{const data=await request("/game/state");state=data.state;render();setConnection("🏰 Estado atualizado · "+(state.kingdom?.kingdom_name||"Reino"));}catch(error){notice(error.message,"error")}}
async function act(body,success){
 if(busy)return;busy=true;notice("Executando comando…");
 try{const data=await request("/game/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});state=data.state;render();notice(success||data.battle?.message||"Comando concluído.","ok");return data}
 catch(error){notice(error.message,"error");throw error}
 finally{busy=false}
}
$("tabs").addEventListener("click",event=>{const button=event.target.closest("[data-tab]");if(!button)return;document.querySelectorAll("#tabs button").forEach(x=>x.setAttribute("aria-selected",String(x===button)));document.querySelectorAll(".section").forEach(x=>x.classList.toggle("active",x.id==="section-"+button.dataset.tab))});
document.body.addEventListener("click",async event=>{
 const up=event.target.closest("[data-upgrade]");if(up){try{await act({type:"upgrade",building:up.dataset.upgrade},"Estrutura melhorada.")}catch{}return}
 const research=event.target.closest("[data-research]");if(research){try{await act({type:"research",research:research.dataset.research},"Pesquisa concluída.")}catch{}return}
 const evolve=event.target.closest("[data-evolve]");if(evolve){try{await act({type:"hero_evolve",hero:evolve.dataset.evolve},"Herói evoluído.")}catch{}return}
 const march=event.target.closest("[data-march]");if(march){const unit=$("marchUnit").value,qty=Math.max(1,Math.min(10000,Math.floor(Number($("marchQty").value)||1)));try{await act({type:"march",targetId:Number(march.dataset.target),marchType:march.dataset.march,units:{[unit]:qty}},"Ordem de marcha enviada.")}catch{}return}
});
$("trainForm").addEventListener("submit",async e=>{e.preventDefault();try{await act({type:"train",unit:$("unitType").value,quantity:Math.max(1,Math.min(100,Math.floor(Number($("trainQty").value)||1)))},"Treinamento registrado.")}catch{}});
$("battle").addEventListener("click",async()=>{try{const data=await act({type:"battle"});if(data?.battle)notice(data.battle.message+(data.battle.won?" Recompensas recebidas.":""),data.battle.won?"ok":"")}catch{}});
$("summonOne").addEventListener("click",async()=>{try{await act({type:"hero_summon",quantity:1},"Invocação concluída.")}catch{}});
$("summonTen").addEventListener("click",async()=>{try{await act({type:"hero_summon",quantity:10},"Invocação em lote concluída.")}catch{}});
$("dragonUpgrade").addEventListener("click",async()=>{try{await act({type:"dragon_upgrade"},"Dragão evoluído.")}catch{}});
$("allianceCreate").addEventListener("submit",async e=>{e.preventDefault();try{await act({type:"alliance_create",name:$("allianceName").value,tag:$("allianceTag").value},"Aliança criada.")}catch{}});
$("allianceJoin").addEventListener("submit",async e=>{e.preventDefault();try{await act({type:"alliance_join",tag:$("joinTag").value},"Você entrou na aliança.")}catch{}});
$("warForm").addEventListener("submit",async e=>{e.preventDefault();if(!confirm("Declarar guerra contra esta aliança?"))return;try{await act({type:"alliance_war_declare",targetTag:$("warTag").value},"Declaração de guerra enviada.")}catch{}});
$("chatForm").addEventListener("submit",async e=>{e.preventDefault();const message=$("chatText").value.trim();if(!message)return;try{await act({type:"alliance_chat",message},"Mensagem enviada.");$("chatText").value=""}catch{}});
$("refresh").addEventListener("click",refresh);
connect();
