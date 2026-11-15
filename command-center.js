const API="/api";
const BUILDINGS={castle:"Castelo",barracks:"Quartel",farm:"Fazenda",quarry:"Pedreira",lumber_mill:"Serraria",iron_mine:"Mina de ferro",market:"Mercado",academy:"Academia",wall:"Muralha",hospital:"Hospital",watchtower:"Torre de vigia",stable:"Estábulo",archery_range:"Campo de arqueiros",siege_workshop:"Oficina de cerco",embassy:"Embaixada",warehouse:"Armazém"};
const UNITS={militia:"Milícia",swordsman:"Espadachim",spearman:"Lanceiro",archer:"Arqueiro",crossbowman:"Besteiro",cavalry:"Cavalaria",knight:"Cavaleiro",mage:"Mago",catapult:"Catapulta",ram:"Aríete",trebuchet:"Trabuquete"};
const RESEARCH={economy:"Economia",military:"Doutrina militar",construction:"Construção",defense:"Defesa"};
let state=null,token=null,busy=false,serverNowBase=0,performanceBase=0;
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
function renderTasks(){
 const rows=state.activeTasks||[];
 const labels={construction:"Construção",training:"Treinamento",research:"Pesquisa"};
 $("activeTasks").innerHTML=rows.length?rows.map(task=>{
  let payload={};try{payload=JSON.parse(task.payload_json||"{}")}catch{}
  const detail=task.task_type==="construction"?(BUILDINGS[payload.building]||payload.building)+" · nível "+payload.toLevel:task.task_type==="training"?n(payload.quantity)+" × "+(UNITS[payload.unit]||payload.unit): (RESEARCH[payload.research]||payload.research)+" · nível "+payload.toLevel;
  return '<article class="item"><h3>⏳ '+esc(labels[task.task_type]||task.task_type)+'</h3><div class="muted">'+esc(detail)+'</div><div class="row"><span class="pill" data-task-clock="'+esc(task.id)+'" data-completes="'+esc(task.completes_at)+'">Calculando…</span><span class="muted">Conclusão automática</span></div></article>';
 }).join(""):'<div class="empty">Nenhuma fila ocupada. O reino está pronto para novas ordens.</div>';
}
function renderTaskClocks(){
 document.querySelectorAll("[data-task-clock]").forEach(el=>{
  const remaining=Math.max(0,Math.ceil((Date.parse(el.dataset.completes)-(serverNowBase+(performance.now()-performanceBase)))/1000));
  const h=Math.floor(remaining/3600),m=Math.floor((remaining%3600)/60),s=remaining%60;
  el.textContent=remaining===0?"Aguardando confirmação do servidor":(h?String(h).padStart(2,"0")+":":"")+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")+" restantes";
 });
}
function render(){
 if(!state)return;
 serverNowBase=Date.parse(state.serverTime||new Date().toISOString());performanceBase=performance.now();
 const k=state.kingdom||{},p=state.player||{};
 $("resources").innerHTML=[["🌾","Comida",k.food],["🪵","Madeira",k.wood],["🪨","Pedra",k.stone],["⛓","Ferro",k.iron],["🪙","Ouro",k.gold],["💎","Gemas",p.gems]].map(([icon,label,value])=>'<div class="resource"><small>'+icon+" "+label+'</small><strong>'+n(value)+'</strong></div>').join("");
 $("summary").innerHTML=[["🏰 Castelo","Nível "+n(k.castle_level)],["⚔ Tropas",n(state.totalTroops)],["🐉 Dragão","Nível "+n(state.dragon?.level)],["🛡 Aliança",state.alliance?esc(state.alliance.tag):"Sem aliança"]].map(([label,value])=>'<div class="tile"><small>'+label+'</small><strong>'+value+"</strong></div>").join("");
 renderTasks();renderBuildings();renderTroops();renderResearch();renderWorld();renderHeroes();renderDragon();renderAlliance();renderBattles();renderDailyEvents();renderVeilArchive();
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
const VEIL_CLUES=[
 {id:"lens",title:"A lente sob o castelo",place:"Cripta das fundações",text:"Atrás de uma pedra sem inscrição repousa uma lente azulada. Ela não amplia objetos: revela riscos minúsculos que formam um mapa de túneis esquecidos.",hint:"Uma construção antiga sempre esconde mais do que aparenta."},
 {id:"star",title:"A estrela deslocada",place:"Observatório abandonado",text:"No teto, sete estrelas foram talhadas em prata. Uma delas está fora de posição. Quando vista do pátio, aponta para uma torre que não consta em nenhum registro.",hint:"Nem toda constelação foi feita para olhar o céu."},
 {id:"ledger",title:"O livro sem autor",place:"Sala dos mapas",text:"Um livro registra guerras antes de acontecerem — mas suas páginas finais estão vazias. Na lombada, o discreto arco duplo da Vigília.",hint:"Os mapas mostram fronteiras; as margens contam segredos."}
];
const ORIGIN_STEPS=[
 {id:"offerings",title:"I — Duas ofertas",place:"Crônica dos Primeiros Dias",text:"Dois irmãos apresentam ofertas diferentes. A crônica não explica tudo: uma margem foi raspada e o escriba deixou apenas uma pergunta — o que fazemos quando a comparação se transforma em ressentimento?",hint:"Dois nomes aparecem na mesma página: Caim e Abel.",action:"Ler a crônica"},
 {id:"field",title:"II — O campo silencioso",place:"Campos além das muralhas",text:"O campo está vazio. Há marcas de passos, uma ferramenta caída e dois testemunhos que não concordam. A investigação não apaga a violência: procura compreender suas consequências.",hint:"A segunda página só pode ser lida depois da primeira.",action:"Investigar o campo"},
 {id:"mark",title:"III — A marca e o exílio",place:"Marco de pedra na estrada antiga",text:"A última página descreve a marca como sinal narrativo de proteção e memória, não como troféu. Caim parte, e o reino precisa decidir se lembrará apenas do crime ou também da responsabilidade de impedir novos ciclos de violência.",hint:"O caminho termina fora do campo, junto a uma pedra sem brasão.",action:"Examinar o marco"}
];
function readOriginProgress(){
 try{return JSON.parse(localStorage.getItem("coi_origin_campaign_v1")||'{"steps":[],"basilisk":false,"technology":false}')}
 catch{return {steps:[],basilisk:false,technology:false}}
}
function saveOriginProgress(progress){localStorage.setItem("coi_origin_campaign_v1",JSON.stringify(progress))}
function renderOriginCampaign(){
 const host=$("originCampaign");if(!host)return;
 const castleLevel=Number(state?.kingdom?.castle_level||1),progress=readOriginProgress(),done=new Set(progress.steps||[]);
 if(castleLevel<3){
  host.innerHTML='<article class="item"><h3>🔒 A Primeira Fenda</h3><p class="muted">Esta campanha começa no Castelo nível 3. Continue desenvolvendo seu reino; a crônica ficará guardada.</p><span class="pill">Requisito: Castelo 3</span></article>';
  return;
 }
 const cards=ORIGIN_STEPS.map((step,index)=>{
  const unlocked=index===0||done.has(ORIGIN_STEPS[index-1].id),complete=done.has(step.id);
  return '<article class="item"><h3>'+esc(step.title)+'</h3><div class="muted">'+esc(step.place)+'</div><p class="muted">'+(complete?esc(step.text):esc(step.hint))+'</p><div class="row"><span class="pill">'+(complete?"Capítulo registrado":unlocked?"Disponível":"Ainda selado")+'</span><button type="button" data-origin-step="'+esc(step.id)+'" '+(!unlocked||complete?"disabled":"")+'>'+(complete?"Concluído":esc(step.action))+'</button></div></article>';
 }).join("");
 const chaptersComplete=ORIGIN_STEPS.every(step=>done.has(step.id));
 const beast=chaptersComplete?'<article class="item"><h3>🐍 Bestiário — Basilisco das galerias</h3><p class="muted">'+(progress.basilisk?"Registro: uma criatura lendária descrita em bestiários medievais. No mundo do jogo, seus olhos petrificantes são fantasia e não zoologia.":"Um mineiro encontrou escamas vitrificadas sob a torre. Examine o vestígio para abrir a primeira página do bestiário.")+'</p><div class="row"><span class="pill">'+(progress.basilisk?"Fera catalogada":"Vestígio encontrado")+'</span><button type="button" data-origin-beast="basilisk" '+(progress.basilisk?"disabled":"")+'>'+(progress.basilisk?"Catalogado":"Catalogar vestígio")+'</button></div></article>':"";
 const technology=progress.basilisk?'<article class="item"><h3>✧ Tecnologia descoberta — Cartografia das Fundações</h3><p class="muted">'+(progress.technology?"Registro arquivado: mapas antigos ajudam a localizar ruínas e passagens no universo do jogo.":"Um desenho escondido sob a escama mostra fundações esquecidas. Arquive o conhecimento para concluir esta primeira descoberta.")+'</p><div class="row"><span class="pill">'+(progress.technology?"Descoberta arquivada":"Conhecimento revelado")+'</span><button type="button" data-origin-tech="foundations" '+(progress.technology?"disabled":"")+'>'+(progress.technology?"Arquivado":"Arquivar descoberta")+'</button></div></article>':"";
 host.innerHTML='<div class="muted" style="margin-bottom:9px">Campanha introdutória · requisito Castelo 3 · '+done.size+'/3 capítulos</div><div class="grid">'+cards+beast+technology+'</div><p class="muted" style="margin-top:10px">Protótipo narrativo local: progresso salvo neste dispositivo. Ainda não concede bônus, não altera pesquisas reais e não sincroniza com a conta. A narrativa é uma adaptação ficcional respeitosa de Gênesis 4, não uma interpretação religiosa oficial.</p>';
}
function renderVeilArchive(){
 const found=new Set(JSON.parse(localStorage.getItem("coi_veil_clues")||"[]"));
 $("veilClues").innerHTML=VEIL_CLUES.map(clue=>{
  const unlocked=found.has(clue.id);
  return '<article class="item"><h3>'+ (unlocked?"✧ ":"") +esc(clue.title)+'</h3><div class="muted">'+esc(clue.place)+'</div><p class="muted">'+(unlocked?esc(clue.text):esc(clue.hint))+'</p><div class="row"><span class="pill">'+(unlocked?"Fragmento arquivado":"Registro selado")+'</span><button type="button" data-veil-clue="'+esc(clue.id)+'" '+(unlocked?"disabled":"")+'>'+(unlocked?"Descoberto":"Examinar pista")+'</button></div></article>';
 }).join("");
 renderOriginCampaign();
}
function renderDailyEvents(){
 const data=state.dailyEvents||{},tasks=data.tasks||[];
 $("dailyReset").textContent=data.resetsAt?"Reinício no seu horário: "+new Date(data.resetsAt).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})+" · UTC: "+new Date(data.resetsAt).toISOString().slice(0,16).replace("T"," ")+"Z":"";
 $("dailyTasks").innerHTML=tasks.map(task=>{
  const reward=Object.entries(task.reward||{}).map(([key,value])=>n(value)+" "+({food:"comida",wood:"madeira",stone:"pedra",iron:"ferro",gold:"ouro"}[key]||key)).join(" · ");
  const ready=task.completed&&!task.claimed;
  return '<article class="item"><h3>'+esc(task.icon)+' '+esc(task.title)+'</h3><div class="muted">'+esc(task.description)+'</div><div class="row"><strong>'+n(task.progress)+' / '+n(task.target)+'</strong><span class="pill">'+(task.claimed?"Resgatada":ready?"Concluída":"Em andamento")+'</span></div><div style="height:7px;background:#07111d;border-radius:9px;overflow:hidden;margin:9px 0"><div style="height:100%;width:'+Math.min(100,task.progress/task.target*100)+'%;background:linear-gradient(90deg,#b77a35,#f3d184)"></div></div><div class="row"><span class="muted">Prêmio: '+esc(reward)+'</span><button data-event-claim="'+esc(task.id)+'" '+(!ready?"disabled":"")+'>'+(task.claimed?"Resgatada":ready?"Resgatar":"Continuar")+'</button></div></article>';
 }).join("")||'<div class="empty">Nenhuma missão diária disponível.</div>';
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
 const veil=event.target.closest("[data-veil-clue]");
 if(veil){
  const found=new Set(JSON.parse(localStorage.getItem("coi_veil_clues")||"[]"));
  found.add(veil.dataset.veilClue);
  localStorage.setItem("coi_veil_clues",JSON.stringify([...found]));
  renderVeilArchive();
  notice("Fragmento encontrado. A Vigília deixou mais um sinal.", "ok");
  return;
 }
 const originStep=event.target.closest("[data-origin-step]");
 if(originStep){
  const step=ORIGIN_STEPS.find(item=>item.id===originStep.dataset.originStep),progress=readOriginProgress(),index=ORIGIN_STEPS.findIndex(item=>item.id===step?.id);
  if(step&&index>=0&&(index===0||(progress.steps||[]).includes(ORIGIN_STEPS[index-1].id))){
   progress.steps=[...new Set([...(progress.steps||[]),step.id])];saveOriginProgress(progress);renderOriginCampaign();notice("Capítulo registrado no Arquivo das Origens.","ok");
  }return;
 }
 const originBeast=event.target.closest("[data-origin-beast]");
 if(originBeast){const progress=readOriginProgress();if(ORIGIN_STEPS.every(step=>(progress.steps||[]).includes(step.id))){progress.basilisk=true;saveOriginProgress(progress);renderOriginCampaign();notice("Primeira fera catalogada no bestiário.","ok")}return}
 const originTech=event.target.closest("[data-origin-tech]");
 if(originTech){const progress=readOriginProgress();if(progress.basilisk){progress.technology=true;saveOriginProgress(progress);renderOriginCampaign();notice("Cartografia das Fundações arquivada. Sem efeito de jogo nesta versão.","ok")}return}
 const claim=event.target.closest("[data-event-claim]");if(claim){try{await act({type:"event_claim",taskId:claim.dataset.eventClaim},"Recompensa diária resgatada.")}catch{}return}
 const up=event.target.closest("[data-upgrade]");if(up){try{await act({type:"upgrade",building:up.dataset.upgrade},"Melhoria iniciada; o reino continuará construindo offline.")}catch{}return}
 const research=event.target.closest("[data-research]");if(research){try{await act({type:"research",research:research.dataset.research},"Pesquisa iniciada; o servidor concluirá automaticamente.")}catch{}return}
 const evolve=event.target.closest("[data-evolve]");if(evolve){try{await act({type:"hero_evolve",hero:evolve.dataset.evolve},"Herói evoluído.")}catch{}return}
 const march=event.target.closest("[data-march]");if(march){const unit=$("marchUnit").value,qty=Math.max(1,Math.min(10000,Math.floor(Number($("marchQty").value)||1)));try{await act({type:"march",targetId:Number(march.dataset.target),marchType:march.dataset.march,units:{[unit]:qty}},"Ordem de marcha enviada.")}catch{}return}
});
$("trainForm").addEventListener("submit",async e=>{e.preventDefault();try{await act({type:"train",unit:$("unitType").value,quantity:Math.max(1,Math.min(100,Math.floor(Number($("trainQty").value)||1)))},"Treinamento iniciado; as tropas chegarão automaticamente.")}catch{}});
$("battle").addEventListener("click",async()=>{try{const data=await act({type:"battle"});if(data?.battle)notice(data.battle.message+(data.battle.won?" Recompensas recebidas.":""),data.battle.won?"ok":"")}catch{}});
$("summonOne").addEventListener("click",async()=>{if(!confirm("Invocar 1 herói por 100 gemas?"))return;try{await act({type:"hero_summon",quantity:1},"Invocação concluída.")}catch{}});
$("summonTen").addEventListener("click",async()=>{if(!confirm("Invocar 10 heróis por 900 gemas?"))return;try{await act({type:"hero_summon",quantity:10},"Invocação em lote concluída.")}catch{}});
$("dragonUpgrade").addEventListener("click",async()=>{try{await act({type:"dragon_upgrade"},"Dragão evoluído.")}catch{}});
$("allianceCreate").addEventListener("submit",async e=>{e.preventDefault();try{await act({type:"alliance_create",name:$("allianceName").value,tag:$("allianceTag").value},"Aliança criada.")}catch{}});
$("allianceJoin").addEventListener("submit",async e=>{e.preventDefault();try{await act({type:"alliance_join",tag:$("joinTag").value},"Você entrou na aliança.")}catch{}});
$("warForm").addEventListener("submit",async e=>{e.preventDefault();if(!confirm("Declarar guerra contra esta aliança?"))return;try{await act({type:"alliance_war_declare",targetTag:$("warTag").value},"Declaração de guerra enviada.")}catch{}});
$("chatForm").addEventListener("submit",async e=>{e.preventDefault();const message=$("chatText").value.trim();if(!message)return;try{await act({type:"alliance_chat",message},"Mensagem enviada.");$("chatText").value=""}catch{}});
$("refresh").addEventListener("click",refresh);
setInterval(renderTaskClocks,1000);
setInterval(()=>{if(!document.hidden)refresh()},30000);
connect();
