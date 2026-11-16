(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const token = (() => {
    try { return localStorage.getItem("coi_game_token") || sessionStorage.getItem("coi_game_token") || ""; }
    catch { return ""; }
  })();
  const API = "/api/game/advanced/";
  const UNIT_NAMES = {
    militia:"Milícia",swordsman:"Espadachim",spearman:"Lanceiro",archer:"Arqueiro",
    cavalry:"Cavalaria",knight:"Cavaleiro",crossbowman:"Besteiro",mage:"Mago",
    catapult:"Catapulta",ram:"Aríete",trebuchet:"Trabuquete"
  };
  const durationLabels = new Map([
    [60,"1 minuto"],[300,"5 minutos"],[900,"15 minutos"],[1800,"30 minutos"],
    [3600,"1 hora"],[14400,"4 horas"],[28800,"8 horas"],[86400,"24 horas"]
  ]);
  const cache = { speedups:[],queues:{queues:[],marches:[]},choices:{troops:[],heroes:[]},formations:[] };
  const el = (tag,cls,text) => {
    const item=document.createElement(tag);
    if(cls)item.className=cls;
    if(text!==undefined&&text!==null)item.textContent=String(text);
    return item;
  };
  const fmt = value => Number(value||0).toLocaleString("pt-BR");
  const pct = value => Math.round(Number(value||0)*100)+"%";
  const duration = seconds => {
    let n=Math.max(0,Math.floor(Number(seconds)||0));
    const days=Math.floor(n/86400);n%=86400;
    const hours=Math.floor(n/3600);n%=3600;
    const minutes=Math.floor(n/60);const secs=n%60;
    return [days?days+"d":null,hours?hours+"h":null,minutes?minutes+"m":null,(!days&&!hours&&!minutes)?secs+"s":null].filter(Boolean).join(" ");
  };
  const setStatus = (message,error=false) => {
    const root=$("advanced-status");
    if(root){root.textContent=message;root.style.color=error?"#ffb3ad":"#a8ddb8";}
  };
  async function api(path,method="GET",body){
    if(!token)throw new Error("Entre no seu reino antes de abrir a Academia.");
    const response=await fetch(path.startsWith("/api/")?path:API+path,{
      method,
      headers:{
        Authorization:"Bearer "+token,
        ...(body?{"Content-Type":"application/json"}:{})
      },
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||("Falha HTTP "+response.status));
    return data;
  }
  function showError(root,error){
    root.replaceChildren(el("p","muted",error.message||"Não foi possível carregar esta seção."));
  }
  function addItem(root,title,description,meta,action){
    const row=el("article","item-row");
    const main=el("div","item-row-main");
    main.append(el("strong","",title));
    if(description)main.append(el("small","",description));
    if(meta)main.append(el("small","",meta));
    row.append(main);
    if(action){
      const actions=el("div","item-row-meta");
      if(action.node)actions.append(action.node);
      row.append(actions);
    }
    root.append(row);
    return row;
  }
  function actionButton(label,callback,disabled=false){
    const button=el("button","",label);
    button.type="button";button.disabled=disabled;
    button.addEventListener("click",async()=>{
      if(button.disabled)return;
      button.disabled=true;
      try{await callback();}
      catch(error){setStatus(error.message,true);}
      finally{button.disabled=disabled;}
    });
    return button;
  }
  async function refreshAfter(message){
    setStatus(message||"Salvo. Atualizando dados do reino…");
    await load();
  }

  function renderVIP(vip){
    $("vip-level").textContent="VIP "+Number(vip.vip_level||0);
    const root=$("vip-summary");root.replaceChildren();
    const labels=[
      ["Construção",vip.benefits?.build_speed],["Treinamento",vip.benefits?.train_speed],
      ["Pesquisa",vip.benefits?.research_speed],["Produção",vip.benefits?.resource_bonus],
      ["Marcha",vip.benefits?.march_speed]
    ];
    for(const [label,value] of labels){
      const box=el("div","benefit");
      box.append(el("small","",label),el("strong","",pct(value)));
      root.append(box);
    }
    root.append(el("p","muted","EXP VIP: "+fmt(vip.vip_exp)+" · "+(vip.vip_expires?"Expira em "+new Date(Number(vip.vip_expires)*1000).toLocaleDateString("pt-BR"):"Sem expiração cadastrada")));
    const note=el("p","muted",vip.note||"Benefícios aplicados pelo servidor.");
    root.append(note);
  }

  function renderTech(data){
    const root=$("technology-list");root.replaceChildren();
    const techs=data.technologies||[];
    const active=techs.find(item=>Number(item.research_end_time)>0);
    $("tech-status").textContent=active?"Pesquisa ativa: "+active.name:"Fila disponível";
    if(!techs.length){root.append(el("p","muted","Nenhuma tecnologia cadastrada."));return;}
    for(const tech of techs){
      const level=Number(tech.level||0),max=Number(tech.max_level||10);
      const cost=Number(tech.base_cost_gold||0)*(level+1);
      const time=Number(tech.base_research_time||0)*(level+1);
      const running=Number(tech.research_end_time||0)>0;
      const prereq=tech.prerequisite_tech;
      const prereqTech=prereq?techs.find(item=>item.id===prereq):null;
      const canStart=!running&&!active&&level<max&&(!prereqTech||Number(prereqTech.level)>=3);
      const category=tech.category==="military"?"Militar":tech.category==="defense"?"Defesa":"Economia";
      let meta="Nível "+level+"/"+max+" · "+category+" · Próximo custo: "+fmt(cost)+" Ouro · "+duration(time);
      if(running)meta="Pesquisa em andamento · conclusão "+new Date(Number(tech.research_end_time)*1000).toLocaleString("pt-BR");
      if(prereq&&Number(prereqTech?.level||0)<3)meta+=" · Requer "+prereq+" nível 3";
      const button=actionButton(running?"Pesquisando…":level>=max?"Máximo":active?"Fila ocupada":"Pesquisar",async()=>{
        const result=await api("tech/research","POST",{tech_id:tech.id});
        setStatus("Pesquisa iniciada: "+tech.name+". Custo "+fmt(result.cost)+" Ouro.");
        await load();
      },!canStart);
      addItem(root,tech.name,tech.description,meta,{node:button});
    }
  }

  function renderSpeedups(items){
    cache.speedups=items||[];
    const root=$("speedup-inventory");root.replaceChildren();
    if(!items?.length){root.append(el("p","muted","Seu inventário ainda não possui aceleradores. Eles podem ser recebidos em missões e recompensas."));}
    for(const item of items||[]){
      addItem(root,item.speedup_type.toUpperCase()+" · "+(durationLabels.get(Number(item.duration_seconds))||duration(item.duration_seconds)),
        "Aceleradores disponíveis", "Quantidade: "+fmt(item.quantity));
    }
    renderSpeedupOptions();
  }
  function renderSpeedupOptions(){
    const type=$("speedup-type").value;
    const durationSelect=$("speedup-duration"),targetSelect=$("speedup-target");
    durationSelect.replaceChildren();targetSelect.replaceChildren();
    const owned=cache.speedups.filter(item=>item.speedup_type===type&&Number(item.quantity)>0);
    for(const item of owned){
      const option=el("option","",durationLabels.get(Number(item.duration_seconds))+" · "+item.quantity+" un.");
      option.value=String(item.duration_seconds);durationSelect.append(option);
    }
    const targetRows=type==="march"?cache.queues.marches:cache.queues.queues.filter(item=>
      item.queue_type===(type==="build"?"construction":type==="train"?"training":"research")
    );
    targetSelect.append(new Option(targetRows.length?"Selecione uma ordem":"Nenhuma ordem ativa",""));
    for(const item of targetRows){
      const title=type==="march"
        ?("Marcha "+item.march_type+" · "+item.target_territory_id)
        :(item.queue_type+" · "+item.target_key+" · "+item.id);
      const option=el("option","",title+" · até "+new Date(item.completes_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));
      option.value=String(item.id);targetSelect.append(option);
    }
    $("speedup-form").querySelector('button[type="submit"]').disabled=!owned.length||!targetRows.length;
  }

  function renderTasks(data){
    const root=$("task-list");root.replaceChildren();
    if(!data.tasks?.length){root.append(el("p","muted","Nenhuma missão disponível."));return;}
    for(const task of data.tasks){
      const row=el("article","item-row"),main=el("div","item-row-main");
      main.append(el("strong","",task.title),el("small","",task.description));
      const progress=Math.min(100,Math.round(Number(task.progress||0)/Math.max(1,Number(task.target_count))*100));
      main.append(el("small","",fmt(task.progress)+"/"+fmt(task.target_count)+" · Recompensa: "+JSON.stringify(task.reward||{})));
      const track=el("div","progress-track"),fill=el("span");
      fill.style.width=progress+"%";track.append(fill);main.append(track);
      row.append(main);
      const button=actionButton(task.claimed?"Resgatada":task.completed?"Resgatar":"Em andamento",async()=>{
        await api("tasks/claim","POST",{task_id:task.id});
        await refreshAfter("Recompensa da missão recebida.");
      },!task.completed||task.claimed);
      const actions=el("div","item-row-meta");actions.append(button);row.append(actions);root.append(row);
    }
  }

  function renderMail(data){
    const root=$("mail-list");root.replaceChildren();
    if(!data.mail?.length){root.append(el("p","muted","Seu correio está vazio."));return;}
    for(const mail of data.mail){
      const desc=mail.body+" · "+mail.sender_name+" · "+new Date(Number(mail.created_at)*1000).toLocaleString("pt-BR");
      const attachment=mail.attachment&&Object.keys(mail.attachment).length?JSON.stringify(mail.attachment):"Sem anexos";
      const button=mail.attachment&&!mail.is_claimed
        ?actionButton("Resgatar anexos",async()=>{
          await api("mail/claim","POST",{mail_id:mail.id});
          await refreshAfter("Anexos recebidos.");
        }):null;
      addItem(mail.subject,desc,mail.is_claimed?"Anexos resgatados":attachment,button?{node:button}:null);
    }
  }

  function renderAchievements(data){
    const root=$("achievement-list");root.replaceChildren();
    if(!data.achievements?.length){root.append(el("p","muted","Nenhuma conquista cadastrada."));return;}
    for(const item of data.achievements){
      const button=actionButton(item.claimed?"Resgatada":item.completed?"Resgatar":"Em andamento",async()=>{
        await api("achievements/claim","POST",{achievement_id:item.id});
        await refreshAfter("Recompensa da conquista recebida.");
      },!item.completed||item.claimed);
      addItem(item.title,item.description,
        "Progresso "+fmt(item.progress)+"/"+fmt(item.requirement_value)+" · Tier "+item.tier+" · "+JSON.stringify(item.reward||{}),
        {node:button});
    }
  }

  function renderFormations(data){
    cache.formations=data.formations||[];
    const root=$("formation-list");root.replaceChildren();
    if(!cache.formations.length)root.append(el("p","muted","Nenhuma formação salva. Configure abaixo até cinco formações."));
    for(const item of cache.formations){
      const troops=Object.entries(item.troops||{}).map(([type,count])=>(UNIT_NAMES[type]||type)+" "+fmt(count)).join(" · ");
      addItem("Slot "+item.slot_number+" · "+item.formation_name,troops||"Sem unidades",
        (item.is_active?"Formação ativa":"Salva")+(item.hero_name?" · Herói: "+item.hero_name:""));
    }
  }

  function renderFormationChoices(data){
    cache.choices=data;
    const root=$("formation-units");root.replaceChildren();
    for(const unit of data.troops||[]){
      const row=el("label","",UNIT_NAMES[unit.unit_type]||unit.unit_type);
      const input=el("input");
      input.type="number";input.min="0";input.max=String(unit.quantity);input.step="1";input.value="0";
      input.dataset.unitType=unit.unit_type;input.dataset.max=String(unit.quantity);
      input.setAttribute("aria-label",(UNIT_NAMES[unit.unit_type]||unit.unit_type)+" na formação");
      row.append(input,el("small","muted","/ "+fmt(unit.quantity)));root.append(row);
    }
    const heroes=(data.heroes||[]);
    if(heroes.length){
      const label=el("label","","Herói");
      const select=el("select");select.id="formation-hero";
      select.append(new Option("Sem herói",""));
      for(const hero of heroes)select.append(new Option(hero.hero_name+" · Nv. "+hero.level,String(hero.id)));
      label.append(select);root.append(label);
    }
    if(!(data.troops||[]).length)root.append(el("p","muted","Treine tropas permanentes para salvar uma formação."));
  }

  function renderMounts(data){
    const root=$("mount-list");root.replaceChildren();
    if(!data.mounts?.length){root.append(el("p","muted","Nenhuma montaria disponível."));return;}
    for(const mount of data.mounts){
      const button=actionButton(mount.is_equipped?"Equipado":"Equipar",async()=>{
        await api("mounts/equip","POST",{mount_id:mount.id});
        await refreshAfter("Montaria equipada.");
      },Number(mount.is_equipped)===1);
      addItem(mount.icon+" "+mount.name,mount.description,
        mount.rarity+" · Velocidade "+pct(mount.speed_bonus)+" · Ataque "+pct(mount.attack_bonus)+" · Defesa "+pct(mount.defense_bonus),
        {node:button});
    }
  }

  function renderCosmetics(data){
    const root=$("cosmetic-list");root.replaceChildren();
    for(const item of data.city_skins||[]){
      addItem(item.icon+" "+item.name,item.description,item.rarity+" · "+(item.owned?"Desbloqueada":"Bloqueada"));
    }
    for(const item of data.portraits||[]){
      addItem("🧑 "+item.name,item.description,item.rarity+" · "+(item.owned?"Desbloqueado":"Bloqueado"));
    }
    if(!root.children.length)root.append(el("p","muted","Catálogo vazio."));
  }

  function renderVisuals(data){
    const form=$("visual-form"),settings=data.settings||{};
    for(const key of ["particles_enabled","screen_shake_enabled","damage_numbers_enabled","day_night_cycle_enabled","bloom_enabled"]){
      form.elements[key].checked=Number(settings[key]??1)===1;
    }
    form.elements.quality_level.value=settings.quality_level||"high";
  }

  function renderRanking(data){
    const root=$("ranking-list");root.replaceChildren();
    if(!data.ranking?.length){root.append(el("p","muted","O ranking ainda não possui reinos."));return;}
    for(const item of data.ranking.slice(0,25)){
      const row=el("div","ranking-row");
      row.append(el("span","rank","#"+item.power_rank),el("strong","",item.kingdom_name));
      row.append(el("small","", "Nv. "+item.castle_level+" · "+fmt(item.power)+" poder"+(item.alliance_tag?" · ["+item.alliance_tag+"]":"")));
      root.append(row);
    }
  }

  async function load(){
    if(!token){setStatus("Sessão não encontrada. Entre no reino para acessar a Academia.",true);return;}
    $("refresh-advanced").disabled=true;
    setStatus("Sincronizando recursos avançados…");
    const paths=[
      "tech","vip","speedups","tasks","mail","achievements","ranking","formations",
      "formation-choices","mounts","visuals","cosmetics","queues"
    ];
    const results=await Promise.allSettled(paths.map(path=>api(path)));
    const values={};let failures=0;
    paths.forEach((path,index)=>{
      const result=results[index];
      if(result.status==="fulfilled")values[path]=result.value;
      else{failures++;console.warn("advanced_load_failed",path,result.reason);}
    });
    if(values.tech)renderTech(values.tech);else showError($("technology-list"),new Error("Falha ao carregar a árvore de tecnologias."));
    if(values.vip)renderVIP(values.vip);else showError($("vip-summary"),new Error("Falha ao carregar o VIP."));
    if(values.speedups)renderSpeedups(values.speedups.speedups);else showError($("speedup-inventory"),new Error("Falha ao carregar aceleradores."));
    if(values.queues)cache.queues=values.queues;
    if(values.speedups)renderSpeedupOptions();
    if(values.tasks)renderTasks(values.tasks);else showError($("task-list"),new Error("Falha ao carregar missões."));
    if(values.mail)renderMail(values.mail);else showError($("mail-list"),new Error("Falha ao carregar correio."));
    if(values.achievements)renderAchievements(values.achievements);else showError($("achievement-list"),new Error("Falha ao carregar conquistas."));
    if(values.formations)renderFormations(values.formations);else showError($("formation-list"),new Error("Falha ao carregar formações."));
    if(values["formation-choices"])renderFormationChoices(values["formation-choices"]);else showError($("formation-units"),new Error("Falha ao carregar tropas."));
    if(values.mounts)renderMounts(values.mounts);else showError($("mount-list"),new Error("Falha ao carregar montarias."));
    if(values.visuals)renderVisuals(values.visuals);else showError($("visual-form"),new Error("Falha ao carregar preferências visuais."));
    if(values.cosmetics)renderCosmetics(values.cosmetics);else showError($("cosmetic-list"),new Error("Falha ao carregar catálogo."));
    if(values.ranking)renderRanking(values.ranking);else showError($("ranking-list"),new Error("Falha ao carregar ranking."));
    $("refresh-advanced").disabled=false;
    setStatus(failures?"Sincronização parcial: "+failures+" seção(ões) indisponíveis.":"● Academia sincronizada com o servidor.");
  }

  $("speedup-type").addEventListener("change",renderSpeedupOptions);
  $("speedup-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const type=$("speedup-type").value,seconds=Number($("speedup-duration").value),target=Number($("speedup-target").value);
    if(!seconds||!target){setStatus("Escolha um acelerador e uma ordem ativa.",true);return;}
    try{
      await api("speedups/use","POST",{speedup_type:type,duration_seconds:seconds,target_id:target});
      await refreshAfter("Acelerador aplicado pelo servidor.");
    }catch(error){setStatus(error.message,true);}
  });

  $("formation-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const troopData={};
    $("formation-units").querySelectorAll("input[data-unit-type]").forEach(input=>{
      const value=Math.max(0,Math.floor(Number(input.value)||0));
      if(value>0)troopData[input.dataset.unitType]=Math.min(value,Number(input.dataset.max));
    });
    const hero=$("formation-hero");
    const body={
      slot_number:Number($("formation-slot").value),
      formation_name:$("formation-name").value.trim(),
      troop_data:troopData,
      is_active:$("formation-active").checked,
      hero_id:hero?.value||null
    };
    try{
      await api("formations/save","POST",body);
      await refreshAfter("Formação salva.");
    }catch(error){setStatus(error.message,true);}
  });

  $("visual-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const body={};
    for(const key of ["particles_enabled","screen_shake_enabled","damage_numbers_enabled","day_night_cycle_enabled","bloom_enabled"]){
      body[key]=form.elements[key].checked;
    }
    body.quality_level=form.elements.quality_level.value;
    try{
      const result=await api("visuals","PUT",body);
      window.dispatchEvent(new CustomEvent("coi:visuals:update",{detail:result.settings}));
      renderVisuals({settings:result.settings});
      setStatus("Preferências visuais salvas.");
    }catch(error){setStatus(error.message,true);}
  });

  $("refresh-advanced").addEventListener("click",()=>load().catch(error=>setStatus(error.message,true)));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)load().catch(error=>setStatus(error.message,true));});
  load().catch(error=>setStatus(error.message,true));
})();