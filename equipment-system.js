// Equipamentos persistentes: inventário e loadout são validados pelo Worker.
(() => {
  const API="/api";
  let token=null,state=null,selected="iron_sword",selectedHeroId=null,busy=false,searchFocusApplied=false,lastSummonResults=[];
  const requestedSkinSearch=new URLSearchParams(location.search).get("search")||"";
  const normalizeSearch=value=>String(value||"").normalize("NFKD").replace(/[\p{M}]/gu,"").toLocaleLowerCase("pt-BR");
  const $=id=>document.getElementById(id);
  const fmt=value=>Number(value||0).toLocaleString("pt-BR");
  const labels={defense:"Defesa",health:"Vida",attack:"Ataque",resourceBonus:"Produção",critical:"Acerto crítico",march:"Velocidade de marcha"};
  function formatGearStat(key,value){
    const number=Number(value)||0;
    if(key==="attack"||key==="defense")return (number/10).toFixed(1)+"%";
    if(key==="health")return (number/25).toFixed(1)+"%";
    return number.toFixed(2).replace(/\.?0+$/,"")+"%";
  }
  const slotLabels={weapon:"Arma",helmet:"Capacete",armor:"Armadura",boots:"Botas",accessory:"Acessório"};
  const rarityLabels={comum:"Comum",raro:"Raro",epico:"Épico",lendario:"Lendário"};
  function setStatus(message,error=false){
    const node=$("equipment-status");
    if(node){node.textContent=message;node.style.color=error?"#ffb4a9":"#f5d58a";}
  }
  async function request(path,options={}){
    const response=await fetch(API+path,{...options,headers:{...(options.headers||{}),...(token?{Authorization:"Bearer "+token}:{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Falha ao sincronizar equipamentos.");
    return data;
  }
  function renderForge(){
    const research=state?.equipmentResearch||[],levels=new Map(research.map(item=>[item.id,Number(item.level)||0]));
    const academy=Number((state?.buildings||[]).find(item=>item.building_type==="academy")?.level||0);
    const researchGrid=$("forge-research-list");
    if(researchGrid){
      researchGrid.replaceChildren(...research.map(item=>{
        const card=document.createElement("article");card.className="forge-card";
        const title=document.createElement("h3");title.textContent=(item.icon||"⚒️")+" "+item.name;
        const description=document.createElement("p");description.textContent=item.description;
        const level=document.createElement("strong");level.textContent="Nível "+item.level+"/"+item.maxLevel+" · +"+item.perLevel+"% por nível em "+item.effect;
        const cost=document.createElement("p");cost.className="forge-cost";cost.textContent="Próxima pesquisa: "+fmt(item.nextCost?.wood)+" madeira · "+fmt(item.nextCost?.stone)+" pedra · "+fmt(item.nextCost?.iron)+" ferro";
        const requiredAcademy=Math.ceil((Number(item.level)+1)/3);
        const gate=document.createElement("small");gate.textContent="Centro de Pesquisa Militar: nível "+requiredAcademy;
        const button=document.createElement("button");button.type="button";button.className="forge-action";
        button.disabled=busy||item.level>=item.maxLevel||academy<requiredAcademy;
        button.textContent=item.level>=item.maxLevel?"PESQUISA MÁXIMA":academy<requiredAcademy?"MELHORE A ACADEMIA":"PESQUISAR";
        button.addEventListener("click",()=>perform({type:"research",research:item.id},"Pesquisa "+item.name+" evoluída."));
        card.append(title,description,level,cost,gate,button);return card;
      }));
    }
    const progressionRoot=$("equipment-progression-grid");
    if(progressionRoot){
      progressionRoot.replaceChildren();
      for(const path of (state?.equipmentProgression||[])){
        const lane=document.createElement("section");lane.className="equipment-progression-lane";
        const heading=document.createElement("h3");heading.textContent=path.label;
        const stages=document.createElement("div");stages.className="equipment-progression-stages";
        for(const stage of path.stages||[]){
          const card=document.createElement("article");card.className="equipment-tier-card rarity-"+stage.rarity;
          const rarity=document.createElement("span");rarity.className="equipment-tier-rarity";rarity.textContent=stage.tierLabel||stage.rarity;
          const title=document.createElement("strong");title.textContent=(stage.icon||"⚔️")+" "+stage.name;
          const status=document.createElement("small");
          status.textContent=stage.owned?(stage.isLocked?"Possuída · bloqueada":"Adquirida · Nv. "+stage.level):stage.available?"Disponível para forjar":"Aguardando raridade anterior";
          const stats=document.createElement("p");
          const base=stage.base||{};
          stats.textContent="Ataque "+formatGearStat("attack",base.attack||0)+" · Defesa "+formatGearStat("defense",base.defense||0)+" · Vida "+formatGearStat("health",base.health||0);
          card.append(rarity,title,status,stats);
          if(!stage.owned&&stage.available&&stage.craft){
            const requirements=Object.entries(stage.requiredResearch||{});
            const missing=requirements.filter(([key,required])=>(levels.get(key)||0)<required);
            const enough=Number(state?.kingdom?.gold||0)>=Number(stage.craft.gold||0)&&Number(state?.kingdom?.iron||0)>=Number(stage.craft.iron||0);
            const action=document.createElement("button");action.type="button";action.className="forge-action";
            action.disabled=busy||missing.length>0||!enough;
            action.textContent=!enough?"RECURSOS INSUFICIENTES":missing.length?"PESQUISE PRIMEIRO":"⚒️ FORJAR";
            action.addEventListener("click",()=>perform({type:"equipment_craft",itemId:stage.id},"Equipamento "+stage.name+" forjado. A próxima raridade foi liberada."));
            card.append(action);
            if(missing.length){
              const gate=document.createElement("small");
              gate.textContent="Pesquisa necessária: "+missing.map(([key,required])=>(research.find(x=>x.id===key)?.name||key)+" Nv. "+required).join(", ");
              card.append(gate);
            }else{
              const cost=document.createElement("small");
              cost.textContent="Custo: "+fmt(stage.craft.gold)+" ouro · "+fmt(stage.craft.iron)+" ferro";
              card.append(cost);
            }
          }else if(stage.requiresItem&&!stage.owned){
            const dependency=document.createElement("small");
            dependency.textContent="Requer: "+(state?.equipmentCatalog||[]).find(x=>x.id===stage.requiresItem)?.name;
            card.append(dependency);
          }
          stages.append(card);
        }
        lane.append(heading,stages);progressionRoot.append(lane);
      }
    }
    const pathItemIds=new Set((state?.equipmentProgression||[]).flatMap(path=>(path.stages||[]).map(stage=>stage.id)));
    const catalogGrid=$("forge-catalog-list");
    if(catalogGrid){
      const available=(state?.equipmentCatalog||[]).filter(item=>item.craft&&!item.owned&&!pathItemIds.has(item.id));
      catalogGrid.replaceChildren(...(available.length?available.map(item=>{
        const card=document.createElement("article");card.className="forge-card";
        const title=document.createElement("h3");title.textContent=(item.icon||"⚔️")+" "+item.name;
        const rarity=document.createElement("small");rarity.textContent=(item.tierLabel||item.rarity||"").toUpperCase()+" · "+(slotLabels[item.slot]||item.slot);
        const description=document.createElement("p");description.textContent=item.description||"Equipamento forjado no reino.";
        const stats=document.createElement("p");stats.className="forge-stats";stats.textContent="Atributos iniciais: "+Object.entries(item.base||{}).map(([key,value])=>(labels[key]||key)+": "+formatGearStat(key,value)).join(" · ");
        const requirements=Object.entries(item.requiredResearch||{});
        const missing=requirements.filter(([key,required])=>(levels.get(key)||0)<required);
        const predecessor=item.requiresItem?(state?.equipment||[]).find(x=>x.id===item.requiresItem):null;
        const missingPredecessor=Boolean(item.requiresItem&&!predecessor);
        const requirementText=document.createElement("small");
        requirementText.textContent=missingPredecessor?"Requer: "+((state?.equipmentCatalog||[]).find(x=>x.id===item.requiresItem)?.name||item.requiresItem):missing.length?"Pesquisa necessária: "+missing.map(([key,required])=>(research.find(x=>x.id===key)?.name||key)+" Nv. "+required).join(", "):"Requisitos atendidos";
        const cost=document.createElement("p");cost.className="forge-cost";cost.textContent="Custo: "+fmt(item.craft.gold)+" ouro · "+fmt(item.craft.iron)+" ferro";
        const enough=Number(state?.kingdom?.gold||0)>=Number(item.craft.gold||0)&&Number(state?.kingdom?.iron||0)>=Number(item.craft.iron||0);
        const button=document.createElement("button");button.type="button";button.className="forge-action";
        button.disabled=busy||missing.length>0||!enough||missingPredecessor;
        button.textContent=missingPredecessor?"FORJE A PEÇA ANTERIOR":!enough?"RECURSOS INSUFICIENTES":missing.length?"PESQUISE PRIMEIRO":"⚒️ FORJAR";
        button.addEventListener("click",()=>perform({type:"equipment_craft",itemId:item.id},"Equipamento "+item.name+" forjado."));
        card.append(title,rarity,description,stats,requirementText,cost,button);return card;
      }):[(()=>{const empty=document.createElement("p");empty.textContent="Nenhum projeto alternativo disponível.";return empty;})()]));
    }
    const bonus=state?.equipmentBonuses||{};
    const summary=$("equipment-bonus-summary"),skinSummary=$("castle-skin-bonus-summary"),skin=state?.activeCastleSkin;
    if(summary){
      const setText=bonus.legendarySetActive===true?" · Conjunto completo: +1% Ataque / +1% Defesa / +0,5% Vida":"";
      summary.textContent="Bônus do herói em combate: Ataque +"+Number(bonus.attackPercent||0).toFixed(1)+"% · Defesa +"+Number(bonus.defensePercent||0).toFixed(1)+"% · Vida +"+Number(bonus.healthPercent||0).toFixed(1)+"% · Crítico +"+Number(bonus.criticalChancePercent||0).toFixed(1)+"% · Marcha +"+Number(bonus.marchSpeedPercent||0).toFixed(1)+"% · Produção +"+Number(bonus.resourcePercent||0).toFixed(1)+"%"+setText;
    }
    if(skinSummary){
      skinSummary.textContent=skin?.id
        ?"Skin equipada: "+skin.name+" · Ataque +"+Number(skin.attackPercent||0).toFixed(2)+"% · Defesa +"+Number(skin.defensePercent||0).toFixed(2)+"%. Aplicada apenas enquanto esta skin continuar equipada."
        :"Nenhuma skin paga equipada. Visuais cosméticos de coleção continuam sem bônus de combate.";
    }
  }
  function renderNorseSkins(){
    const cosmetics=state?.cosmetics||{},catalog=cosmetics.skins||{},owned=new Set((cosmetics.owned||[]).map(item=>item.item_id));
    const skins=Object.entries(catalog).filter(([,skin])=>skin.theme==="Panteão Nórdico");
    const grid=$("norse-skin-list");
    if(!grid)return;
    grid.replaceChildren(...skins.map(([id,skin])=>{
      const card=document.createElement("article");card.className="norse-skin-card";
      const title=document.createElement("h3");title.textContent=skin.icon+" "+skin.name;
      const rarity=document.createElement("span");rarity.className="skin-rarity";rarity.textContent=skin.rarity;
      const description=document.createElement("p");description.textContent=skin.visual||"Visual cosmético exclusivo.";
      const button=document.createElement("button");button.type="button";button.className="skin-buy-btn";
      const hasSkin=owned.has(id);button.disabled=busy||hasSkin;
      button.textContent=hasSkin?"ADQUIRIDA":"Comprar · "+fmt(skin.price)+" gemas";
      button.addEventListener("click",()=>perform({type:"cosmetic_buy",skin:id},"Skin "+skin.name+" adquirida."));
      card.append(title,rarity,description,button);return card;
    }));
    if(requestedSkinSearch&&!searchFocusApplied){
      const needle=normalizeSearch(requestedSkinSearch);
      const matches=[...grid.children].filter(card=>normalizeSearch(card.textContent).includes(needle));
      if(matches.length){
        matches[0].style.outline="3px solid #ffe09a";
        matches[0].scrollIntoView({behavior:"smooth",block:"center"});
        setStatus("Skin localizada pela busca global: "+requestedSkinSearch+".");
      }else setStatus("A skin pesquisada não foi encontrada no catálogo cosmético atual.");
      searchFocusApplied=true;
    }
    $("skin-gems").textContent="Gemas: "+fmt(state?.player?.gems);
    $("skin-shards").textContent="Fragmentos: "+fmt(cosmetics.shards);
    const collection=cosmetics.collections?.find(item=>item.id==="col_norse");
    const complete=Boolean(collection?.skins?.every(id=>owned.has(id)));
    const claimed=(cosmetics.claimed||[]).includes("col_norse");
    const claim=$("claim-norse-collection");
    claim.disabled=busy||!complete||claimed;
    claim.textContent=claimed?"RECOMPENSA RESGATADA":complete?"RESGATAR COLEÇÃO · +5.000 GEMAS / 200 FRAGMENTOS":"COLEÇÃO "+skins.filter(([id])=>owned.has(id)).length+"/6";
  }
  function renderHeroGallery(){
    const root=$("hero-roster-grid"),count=$("hero-roster-count");
    if(!root)return;
    const roster=Array.isArray(state?.heroInventory)?state.heroInventory:[];
    const owned=Array.isArray(state?.heroes)?state.heroes:[];
    if(count)count.textContent=roster.length+" herói(s) no inventário";
    root.replaceChildren();
    if(!roster.length){
      const empty=document.createElement("p");
      empty.textContent="Nenhum herói encontrado. A coleção será exibida aqui depois da primeira convocação.";
      root.append(empty);
      return;
    }
    const statLabels={hp:"Vida",attack:"Ataque",defense:"Defesa",speed:"Velocidade"};
    for(const hero of roster){
      const boundHero=owned.find(row=>row.hero_key===hero.hero_key);
      const heroId=Number(boundHero?.id)||null;
      const selected=Boolean(heroId&&heroId===selectedHeroId);
      const card=document.createElement("article");
      card.className="hero-roster-card"+(selected?" is-selected":"");
      const portrait=document.createElementNS("http://www.w3.org/2000/svg","svg");
      portrait.setAttribute("class","hero-roster-portrait");
      portrait.setAttribute("viewBox","0 0 320 480");
      portrait.setAttribute("role","img");
      portrait.setAttribute("aria-label",hero.portrait_alt||hero.name||"Retrato de herói");
      const use=document.createElementNS("http://www.w3.org/2000/svg","use");
      use.setAttribute("href","/assets/art/heroes/portraits.svg#"+String(hero.portrait_symbol||"commander"));
      use.setAttribute("width","320");
      use.setAttribute("height","480");
      portrait.append(use);

      const copy=document.createElement("div");
      copy.className="hero-roster-copy";
      const name=document.createElement("h3");
      name.className="hero-roster-name";
      name.textContent=hero.name||hero.hero_key||"Herói";
      const title=document.createElement("p");
      title.className="hero-roster-title";
      title.textContent=hero.title||"Campeão de Eldoria";
      const meta=document.createElement("div");
      meta.className="hero-roster-meta";
      const level=document.createElement("span");
      level.textContent="Nv. "+Number(hero.level||1)+"/"+Number(hero.max_level||1);
      const rarity=document.createElement("span");
      rarity.textContent=hero.rarity_label||"Comum";
      const stars=document.createElement("span");
      stars.className="hero-roster-stars";
      stars.textContent="★".repeat(Math.max(1,Number(hero.stars)||1))+"☆".repeat(Math.max(0,Number(hero.max_stars||1)-Number(hero.stars||1)));
      stars.setAttribute("aria-label",Number(hero.stars||1)+" de "+Number(hero.max_stars||1)+" estrelas");
      meta.append(level,rarity,stars);

      const stats=document.createElement("div");
      stats.className="hero-roster-stats";
      for(const [key,label] of Object.entries(statLabels)){
        const value=Number(hero.stats?.[key]);
        if(!Number.isFinite(value))continue;
        const line=document.createElement("span");
        line.textContent=label+": "+Math.floor(value).toLocaleString("pt-BR");
        stats.append(line);
      }
      const bonuses=hero.combat_bonuses||{};
      const combat=document.createElement("p");
      combat.className="hero-roster-combat";
      combat.textContent="Passivos de batalha: ATQ +"+Number(bonuses.attackPercent||0).toFixed(1)+
        "% · DEF +"+Number(bonuses.defensePercent||0).toFixed(1)+
        "% · Vida +"+Number(bonuses.healthPercent||0).toFixed(1)+
        "% · Crítico +"+Number(bonuses.criticalChancePercent||0).toFixed(1)+"%";
      const skill=document.createElement("p");
      skill.className="hero-roster-skill";
      const skillName=document.createElement("strong");
      skillName.textContent=(hero.skill||"Talento")+" · ";
      const skillDesc=document.createTextNode(hero.skill_description||"Habilidade do herói");
      skill.append(skillName,skillDesc);
      const fragments=document.createElement("p");
      fragments.className="hero-roster-fragments";
      fragments.textContent="Fragmentos: "+Number(hero.fragments||0).toLocaleString("pt-BR")+
        (hero.fragments_to_next?" · Próxima estrela: "+hero.fragments_to_next:" · Estrelas máximas");
      copy.append(name,title,meta,stats,combat,skill,fragments);

      const button=document.createElement("button");
      button.type="button";
      button.className="hero-roster-select";
      button.textContent=selected?"Selecionado para equipamento":"Usar para equipar";
      button.disabled=!heroId||busy||selected;
      button.setAttribute("aria-pressed",String(selected));
      button.addEventListener("click",()=>{
        if(!heroId)return;
        selectedHeroId=heroId;
        const picker=$("hero-select");
        if(picker)picker.value=String(heroId);
        render();
      });
      const details=document.createElement("div");
      details.append(copy,button);
      card.append(portrait,details);
      root.append(card);
    }
  }
  function renderSummonControls(){
    const gems=$("hero-gem-balance"),one=$("hero-summon-one"),ten=$("hero-summon-ten");
    const balance=Math.max(0,Number(state?.player?.gems)||0);
    if(gems)gems.textContent="Gemas: "+fmt(balance);
    if(one)one.disabled=busy||balance<100;
    if(ten)ten.disabled=busy||balance<900;
  }
  function renderSummonResults(){
    const root=$("hero-summon-results");
    if(!root)return;
    root.replaceChildren();
    if(!lastSummonResults.length)return;
    for(const summon of lastSummonResults){
      const card=document.createElement("div");
      card.className="hero-summon-result";
      const name=document.createElement("strong");
      name.textContent=summon.name||summon.hero_key||"Herói";
      const rarity=document.createElement("span");
      rarity.textContent=({white:"Comum",blue:"Raro",purple:"Lendário"})[summon.rarity]||summon.rarity||"Herói";
      const outcome=document.createElement("small");
      outcome.textContent=summon.result_type==="duplicate"
        ? "Duplicado · +"+Number(summon.fragments||0)+" fragmentos"
        : "Novo herói recrutado";
      card.append(name,rarity,outcome);
      root.append(card);
    }
  }
  function render(){
    const container=document.querySelector(".mobile-equipment-container");
    const equipment=Array.isArray(state?.equipment)?state.equipment:[];
    const heroes=Array.isArray(state?.heroes)?state.heroes:[];
    let picker=$("equipment-select");
    if(!picker&&container){
      picker=document.createElement("select");picker.id="equipment-select";picker.setAttribute("aria-label","Selecionar equipamento");
      picker.style.cssText="width:100%;padding:10px;margin:8px 0 14px;border-radius:8px;background:#17283c;color:#fff;border:1px solid #b88b45";
      container.insertBefore(picker,container.firstChild);
      picker.addEventListener("change",()=>{selected=picker.value;render()});
    }
    if(picker){
      picker.replaceChildren(...equipment.map(entry=>{const option=document.createElement("option");option.value=entry.id;option.textContent=entry.name+" · Nv. "+entry.level;option.selected=entry.id===selected;return option;}));
    }
    const item=equipment.find(x=>x.id===selected)||equipment[0];
    if(!item){setStatus("Nenhum equipamento disponível neste reino.",true);return;}
    selected=item.id;
    if(!selectedHeroId||!heroes.some(hero=>Number(hero.id)===selectedHeroId)){
      selectedHeroId=Number(item.equippedHeroId)||Number(heroes[0]?.id)||null;
    }
    const heroPicker=$("hero-select");
    heroPicker.replaceChildren();
    if(!heroes.length){
      const option=document.createElement("option");option.value="";option.textContent="Convoque um herói primeiro";heroPicker.append(option);
    }else{
      for(const hero of heroes){
        const option=document.createElement("option");option.value=String(hero.id);
        option.textContent=(hero.hero_name||hero.hero_key||"Herói")+" · Nv. "+hero.level;
        heroPicker.append(option);
      }
      heroPicker.value=selectedHeroId?String(selectedHeroId):"";
    }
    heroPicker.disabled=busy||!heroes.length;
    const selectedHero=heroes.find(hero=>Number(hero.id)===selectedHeroId);
    renderHeroGallery();
    renderSummonControls();
    renderSummonResults();
    $("item-name").textContent=item.name;
    $("current-level").textContent=item.level;
    $("next-level").textContent=item.level<item.maxLevel?item.level+1:"MÁX.";
    const current=item.stats||{},next=item.nextLevelStats||{};
    $("current-def").textContent=Object.entries(current).map(([key,value])=>(labels[key]||key)+": "+formatGearStat(key,value)).join(" · ")||"—";
    $("next-def").textContent=Object.entries(next).map(([key,value])=>(labels[key]||key)+": "+formatGearStat(key,value)).join(" · ")||"Nível máximo";
    $("current-res").textContent=item.equippedHeroId?"Equipado em "+(heroes.find(hero=>Number(hero.id)===Number(item.equippedHeroId))?.hero_name||"herói"):"Não equipado";
    $("next-res").textContent="Slot: "+(slotLabels[item.slot]||item.slot)+" · Máximo: nível "+item.maxLevel;
    $("upgrade-cost").textContent=fmt(item.upgradeCost);
    $("player-gold").textContent=fmt(state.kingdom?.gold);
    const rarity=$("rarity-badge");
    rarity.textContent=rarityLabels[item.rarity]||item.rarity;
    rarity.className="rarity-badge "+item.rarity;
    const lock=$("lock-btn");lock.textContent=item.isLocked?"🔒 Travado":"🔓 Destravado";lock.setAttribute("aria-pressed",String(item.isLocked));
    const upgrade=$("upgrade-btn");upgrade.disabled=busy||item.isLocked||item.level>=item.maxLevel;
    upgrade.textContent=item.level>=item.maxLevel?"NÍVEL MÁXIMO":item.isLocked?"DESTRAVE PARA EVOLUIR":"⚒️ EVOLUIR EQUIPAMENTO";
    const equip=$("equip-btn");equip.disabled=busy||!selectedHeroId||Number(item.equippedHeroId)===selectedHeroId;
    equip.textContent=Number(item.equippedHeroId)===selectedHeroId?"EQUIPADO NESTE HERÓI":"EQUIPAR NESTE HERÓI";
    $("unequip-btn").disabled=busy||!item.equippedHeroId;
    if(!heroes.length)setStatus("Convoque um herói para usar seus equipamentos. O inventário já está salvo.",true);
    else if(selectedHero)setStatus("Herói selecionado: "+(selectedHero.hero_name||selectedHero.hero_key)+". Cada slot aceita um item.");
    renderNorseSkins();
    renderForge();
  }
  async function refresh(){
    token=localStorage.getItem("coi_game_token")||sessionStorage.getItem("coi_game_token");
    if(!token){setStatus("Entre no seu reino primeiro. Depois volte para equipar seus heróis.",true);return;}
    const response=await request("/game/state");state=response.state;render();
  }
  async function perform(action,success){
    if(busy)return;busy=true;render();
    try{
      const result=await request("/game/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action)});
      state=result.state;
      if(action.type==="hero_summon"){
        lastSummonResults=Array.isArray(result.battle?.summons)?result.battle.summons:[];
        const status=$("hero-summon-status");
        if(status){
          const newCount=lastSummonResults.filter(item=>item.result_type==="new").length;
          const duplicateCount=lastSummonResults.length-newCount;
          status.textContent="Convocação concluída: "+newCount+" herói(s) novo(s) e "+duplicateCount+" duplicado(s).";
        }
      }else setStatus(success);
    }
    catch(error){
      if(action.type==="hero_summon"){
        const status=$("hero-summon-status");if(status)status.textContent=error.message;
      }else setStatus(error.message,true);
      try{await refresh()}catch{}
    }
    finally{busy=false;render();}
  }
  window.upgradeEquipment=()=>perform({type:"equipment_upgrade",itemId:selected},"Equipamento evoluído e salvo no servidor.");
  window.toggleLock=()=>perform({type:"equipment_lock",itemId:selected},"Bloqueio do equipamento atualizado no servidor.");
  window.equipEquipment=()=>selectedHeroId?perform({type:"equipment_equip",itemId:selected,heroId:selectedHeroId},"Equipamento atribuído ao herói."):setStatus("Selecione um herói válido.",true);
  window.unequipEquipment=()=>{
    const item=(state?.equipment||[]).find(x=>x.id===selected);
    if(item?.equippedHeroId)return perform({type:"equipment_unequip",itemId:selected,heroId:Number(item.equippedHeroId)},"Equipamento removido do herói.");
  };
  window.claimNorseCollection=()=>perform({type:"cosmetic_claim",collection:"col_norse"},"Recompensa do Panteão de Asgard resgatada.");
  document.addEventListener("DOMContentLoaded",()=>{
    $("hero-select").addEventListener("change",event=>{selectedHeroId=Number(event.target.value)||null;render();});
    $("upgrade-btn").addEventListener("click",()=>window.upgradeEquipment());
    $("lock-btn").addEventListener("click",()=>window.toggleLock());
    $("equip-btn").addEventListener("click",()=>window.equipEquipment());
    $("unequip-btn").addEventListener("click",()=>window.unequipEquipment());
    $("claim-norse-collection").addEventListener("click",()=>window.claimNorseCollection());
    $("hero-summon-one").addEventListener("click",()=>perform({type:"hero_summon",quantity:1},"Convocação realizada."));
    $("hero-summon-ten").addEventListener("click",()=>perform({type:"hero_summon",quantity:10},"Convocação realizada."));
    refresh().catch(error=>setStatus(error.message,true));
  });
})();
