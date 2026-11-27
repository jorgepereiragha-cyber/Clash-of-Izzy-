import {createEntityArtElement, worldResourceArt} from "./scripts/kingdom-2d-art-atlas.js";

(() => {
  "use strict";
  if (window.__COI_MARKET__) return;
  window.__COI_MARKET__ = true;
  const $ = id => document.getElementById(id);
  const fmt = value => Number(value || 0).toLocaleString("pt-BR");
  const labels = {food:"Comida",wood:"Madeira",stone:"Pedra",iron:"Ferro",gold:"Ouro",gems:"Diamantes"};
  const nodeTypes = {food:"farm",wood:"forest",stone:"quarry",iron:"mine"};
  const rarityNames = {white:"Branco · Comum",blue:"Azul · Raro",purple:"Roxo · Épico",gold:"Dourado · Lendário"};
  const shieldItems = ["shield_8h","shield_3d"];
  const acceleratorSeconds = {
    acc_5min:300,acc_1h:3600,acc_8h:28800,acc_1d:86400,
    train_1h:3600,train_8h:28800,res_1h:3600,res_8h:28800
  };
  const queueTypes = {construction:"Construção",training:"Treinamento",research:"Pesquisa"};
  const compatible = {
    construction:["acc_5min","acc_1h","acc_8h","acc_1d"],
    training:["train_1h","train_8h"],
    research:["res_1h","res_8h"]
  };
  let state = null, busy = false, outdated = false, clockOffset = null, retryAfter = 0;
  function token(){
    let readable=false;
    // A falha de um armazenamento não pode ocultar uma sessão válida no outro.
    for(const storage of [()=>window.localStorage,()=>window.sessionStorage]){
      try{
        const value=storage().getItem("coi_game_token");
        readable=true;
        if(value)return value;
      }catch{}
    }
    if(!readable)throw new Error("O navegador bloqueou o armazenamento da sessão. Autorize este site e tente novamente.");
    return "";
  }
  async function request(path,options={}){
    const auth=token();
    if(!auth)throw new Error("Entre no seu reino antes de usar o mercado.");
    const response=await fetch(path,{
      method:options.method||"GET",
      headers:{"Authorization":"Bearer "+auth,...(options.body?{"Content-Type":"application/json"}:{})},
      body:options.body?JSON.stringify(options.body):undefined,
      cache:"no-store",
      signal:AbortSignal.timeout(15000)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Não foi possível concluir a operação.");
    return data;
  }
  function node(tag,className,text){
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(className==="market-icon")element.setAttribute("aria-hidden","true");
    if(text!==undefined)element.textContent=String(text);
    return element;
  }
  function button(text,action,data,disabled=false){
    const element=node("button","market-action",text);
    element.type="button";element.dataset.action=action;
    for(const [key,value] of Object.entries(data||{}))element.dataset[key]=String(value);
    element.disabled=busy||outdated||disabled;
    return element;
  }
  function setStatus(message,kind="info"){
    const element=$("market-status");
    element.textContent=message;element.dataset.kind=kind==="error"?"error":"info";
  }
  const balance = key => Number((key==="gems"?state?.player?.gems:state?.kingdom?.[key])||0);
  function costsLine(costs, className="market-costs"){
    const line=node("p",className);
    for(const [key,amount] of Object.entries(costs||{})){
      const part=node("span","market-amount",fmt(amount)+" "+(labels[key]||key).toLocaleLowerCase("pt-BR"));
      const art=worldResourceArt(key);
      if(art)part.prepend(art);
      line.append(part);
    }
    return line;
  }
  function shortfalls(costs){
    return Object.entries(costs||{}).map(([key,amount])=>[key,Number(amount)-balance(key)]).filter(([,missing])=>missing>0);
  }
  function offerStatus(card,stock,costs){
    const missing=shortfalls(costs);
    if(stock<=0)card.append(node("p","market-note","Esgotado nesta rotação."));
    else card.append(node("p","market-meta","Restam "+fmt(stock)+" nesta rotação."));
    if(stock>0&&missing.length){
      const deficit=node("p","market-note","Saldo insuficiente · faltam ");
      for(const [index,[key,amount]] of missing.entries()){
        if(index)deficit.append(" · ");
        const label=fmt(amount)+" "+(labels[key]||key).toLocaleLowerCase("pt-BR");
        if(Object.hasOwn(nodeTypes,key)){
          const link=node("a","",label);
          link.href="/world.html?coleta="+nodeTypes[key]+"#resource-nodes";
          deficit.append(link);
        }else deficit.append(label);
      }
      card.append(deficit);
    }
    return stock<=0||missing.length>0;
  }
  function refreshBalances(){
    for(const key of Object.keys(labels)){
      const element=$("balance-"+key);
      if(element)element.textContent=fmt(balance(key));
    }
  }
  function renderExchange(){
    const root=$("merchant-exchanges");root.replaceChildren();
    const available=state?.shop?.exchangeOffers||[];
    const affordable=$("merchant-affordable").checked;
    const offers=affordable?available.filter(offer=>offer.stock>0&&!shortfalls(offer.costs).length):available;
    if(!offers.length){root.append(node("p","empty-state",affordable?"Nenhuma troca ao alcance dos saldos atuais.":"Nenhuma troca disponível nesta rotação."));return;}
    for(const offer of offers){
      const card=node("article","market-card");
      const reward=state.shop.items?.[offer.reward?.item];
      card.append(node("div","market-icon",reward?.icon||"⚡"),node("h3","",offer.name));
      card.append(node("p","market-reward",(reward?.name||offer.rewardName||offer.reward?.item)+" × "+fmt(offer.reward?.quantity||1)));
      card.append(costsLine(offer.costs));
      const unavailable=offerStatus(card,offer.stock,offer.costs);
      card.append(button("TROCAR RECURSOS","exchange",{offerId:offer.id},unavailable||rotationExpired()));
      root.append(card);
    }
  }
  function renderMerchantSpecials(){
    const root=$("merchant-specials");root.replaceChildren();
    const offers=state?.shop?.offers||[];
    if(!offers.length){root.append(node("p","empty-state","Nenhuma oferta especial nesta rotação."));return;}
    for(const offer of offers){
      const card=node("article","market-card");
      card.append(node("div","market-icon",offer.icon||"🎁"),node("h3","",offer.name),node("p","",offer.desc||"Oferta temporária do mercador."));
      const costs={[offer.currency]:offer.price};
      const price=costsLine(costs);
      if(offer.originalPrice>offer.price){
        price.append(node("s","market-original",fmt(offer.originalPrice)),node("span","market-discount","−"+fmt(offer.discount)+"%"));
      }
      card.append(price);
      const locked=shieldItems.includes(offer.id)&&!state.shop.castleShield?.available;
      if(locked)card.append(node("p","market-note","Proteção PvP do castelo indisponível."));
      const unavailable=offerStatus(card,offer.stock,costs);
      card.append(button("COMPRAR OFERTA","buy",{item:offer.id,source:"merchant"},locked||unavailable||rotationExpired()));
      root.append(card);
    }
  }
  function renderHeroRecruitment(){
    const root=$("hero-recruitment");root.replaceChildren();
    const options=state.heroSummonOptions||[];
    const odds=$("summon-odds");
    const oddsText=(state.heroSummonOdds||[]).filter(({rarity})=>Object.hasOwn(rarityNames,rarity))
      .map(({rarity,chancePercent})=>fmt(chancePercent)+"% "+rarityNames[rarity].split(" · ")[1]).join(" · ");
    odds.hidden=!oddsText;
    if(oddsText)odds.textContent="Chances por convocação · "+oddsText;
    for(const option of options){
      const card=node("article","market-card");
      card.append(node("div","market-icon","📜"),node("h3","",option.quantity===1?"Convocação individual":"Convocação em lote"),
        node("p","","Heróis repetidos rendem fragmentos."),costsLine({gems:option.cost}));
      card.append(button(option.quantity===1?"CONVOCAR 1 HERÓI":"CONVOCAR 10 HERÓIS","hero-summon",{quantity:option.quantity},balance("gems")<option.cost));
      root.append(card);
    }
  }
  function heroPortrait(symbol){
    if(!/^[a-z0-9-]+$/.test(symbol||""))return node("div","market-icon","⚔️");
    const portrait=createEntityArtElement({kind:"symbol",src:"/assets/art/heroes/portraits.svg#"+symbol,viewBox:"0 0 320 480"});
    portrait.classList.add("market-portrait");
    return portrait;
  }
  function renderSummons(summons){
    const results=$("summon-results");
    results.replaceChildren();
    for(const hero of summons){
      const entry=node("li","",hero.name);
      entry.append(node("span","",hero.result_type==="duplicate"?"+"+fmt(hero.fragments)+" fragmentos":"Novo herói"));
      results.append(entry);
    }
    results.hidden=!summons.length;
  }
  function renderHeroShop(){
    const root=$("hero-offers");root.replaceChildren();
    const offers=state?.heroShop?.offers||[];
    if(!offers.length){root.append(node("p","empty-state","Recrute um herói para habilitar a compra de fragmentos. Nenhum herói será criado pela loja de fragmentos sem recrutamento."));return;}
    for(const offer of offers){
      const card=node("article","market-card");
      const hero=state.heroInventory?.find(item=>item.hero_key===offer.heroKey);
      const rarity=rarityNames[offer.rarity]||"Raridade não informada";
      card.dataset.heroRarity=["white","blue","purple","gold"].includes(offer.rarity)?offer.rarity:"unknown";
      card.append(heroPortrait(hero?.portrait_symbol),node("h3","",offer.name),node("p","",rarity+" · "+fmt(offer.stars)+" estrela(s)"));
      card.append(node("p","market-reward","+"+fmt(offer.quantity)+" fragmentos · "+fmt(offer.fragments)+" no herói"));
      card.append(costsLine(offer.costs));
      const unavailable=offerStatus(card,offer.stock,offer.costs);
      card.append(button("COMPRAR FRAGMENTOS","hero-buy",{heroKey:offer.heroKey},unavailable||rotationExpired()));
      root.append(card);
    }
  }
  function renderAcceleratorInventory(){
    const root=$("accelerator-inventory");root.replaceChildren();
    const items=state?.shop?.inventory||[];
    const owned=items.filter(item=>Number(item.quantity)>0&&acceleratorSeconds[item.item_id]);
    if(!owned.length){root.append(node("p","empty-state","Você ainda não possui aceleradores. Use as trocas do mercador ou a loja do reino."));return;}
    const grid=node("div","accel-grid");
    for(const item of owned){
      const meta=state.shop.items?.[item.item_id];
      const card=node("div","accel-item");
      card.append(node("span","",(meta?.icon||"⚡")+" "+(meta?.name||item.item_id)),node("strong","", "× "+fmt(item.quantity)));
      grid.append(card);
    }
    root.append(grid);
  }
  function durationText(seconds){
    const value=Math.max(0,Math.ceil(seconds));
    const h=Math.floor(value/3600),m=Math.floor((value%3600)/60),s=value%60;
    return [h?fmt(h)+"h":"",m?fmt(m)+"m":"",(!h&&!m)||s?fmt(s)+"s":""].filter(Boolean).join(" ");
  }
  function renderQueues(){
    const root=$("active-queues");root.replaceChildren();
    const active=(state?.queues||[]).filter(queue=>queue.status==="running");
    if(!active.length){root.append(node("p","empty-state","Nenhuma fila ativa no momento. Inicie uma construção, treinamento ou pesquisa para usar seus aceleradores."));return;}
    const inventory=new Map((state?.shop?.inventory||[]).map(item=>[item.item_id,Number(item.quantity)||0]));
    for(const queue of active){
      const card=node("article","accel-queue"),info=node("div","");
      const title=queueTypes[queue.queue_type]||queue.queue_type;
      const clock=node("p","");
      clock.dataset.queueDeadline=String(Date.parse(queue.completes_at));
      info.append(node("h4","",title+" · "+(queue.target_key||"Projeto")),clock);
      const controls=node("div","queue-actions");
      for(const itemId of compatible[queue.queue_type]||[]){
        const count=inventory.get(itemId)||0;
        if(count<=0)continue;
        const meta=state.shop.items?.[itemId];
        const action=node("button","",(meta?.name||itemId)+" × "+fmt(count));
        action.type="button";action.dataset.action="speedup";action.dataset.queueId=String(queue.id);action.dataset.item=itemId;
        action.disabled=busy||outdated;controls.append(action);
      }
      if(!controls.childElementCount)controls.append(node("span","market-meta","Sem aceleradores compatíveis no inventário."));
      card.append(info,controls);root.append(card);
    }
  }
  function renderSupplies(){
    const root=$("market-supplies");
    const selectedHero=$("exp-hero")?.value;
    root.replaceChildren();
    const inventory=new Map((state.shop?.inventory||[]).map(item=>[item.item_id,Number(item.quantity)]));
    const books=inventory.get("hero_exp")||0;
    const eligible=(state.heroInventory||[]).filter(hero=>hero.level<hero.max_level);
    const bookCard=node("article","market-card");
    bookCard.append(node("h3","",state.shop?.items?.hero_exp?.name||"Livro de EXP"),node("p","","10.000 EXP por livro · "+fmt(books)+" no inventário"));
    if(books>0&&eligible.length){
      const label=node("label","market-category","Herói");
      const select=node("select","");
      select.id="exp-hero";
      for(const hero of eligible){
        const option=node("option","",hero.name+" · Nv. "+fmt(hero.level));
        option.value=hero.hero_key;
        select.append(option);
      }
      if(eligible.some(hero=>hero.hero_key===selectedHero))select.value=selectedHero;
      label.append(select);
      bookCard.append(label,button("USAR LIVRO","exp-book"));
    }else if(books>0)bookCard.append(node("p","market-note","Nenhum herói abaixo do nível máximo."));
    root.append(bookCard);
    const shields=state.shop?.castleShield;
    const shieldCard=node("article","market-card");
    shieldCard.append(node("h3","","Proteção do castelo"));
    if(!shields?.available)shieldCard.append(node("p","market-note","Proteção PvP do castelo indisponível."));
    else if(shields.active)shieldCard.append(node("p","market-note","Seu castelo já está protegido."));
    for(const id of shieldItems){
      const count=inventory.get(id)||0;
      const name=state.shop?.items?.[id]?.name||(id==="shield_8h"?"Escudo 8 horas":"Escudo 3 dias");
      shieldCard.append(node("p","",name+" · "+fmt(count)+" no inventário"));
      if(count>0&&shields?.available&&!shields.active)shieldCard.append(button("Ativar "+name.toLocaleLowerCase("pt-BR"),"shield",{item:id}));
    }
    root.append(shieldCard);
  }
  function renderOfficialShop(){
    const root=$("official-products");root.replaceChildren();
    const items=Object.entries(state?.shop?.items||{});
    const category=$("market-category").value;
    const featured=category==="all"?items:items.filter(([,item])=>item.category===category);
    for(const [id,item] of featured){
      const card=node("article","market-card");
      card.append(node("div","market-icon",item.icon||"🎁"),node("h3","",item.name),node("p","",item.desc||"Item do catálogo do reino."));
      card.append(costsLine({[item.currency]:item.price}));
      const locked=shieldItems.includes(id)&&!state.shop.castleShield?.available;
      if(locked)card.append(node("p","market-note","Proteção PvP do castelo indisponível."));
      card.append(button("COMPRAR","buy",{item:id,source:"shop"},locked||balance(item.currency)<item.price));
      root.append(card);
    }
    if(!root.childElementCount)root.append(node("p","empty-state","Catálogo indisponível."));
  }
  function serverNow(){
    return clockOffset===null?Date.now():clockOffset+performance.now();
  }
  function rotationExpired(){
    return Boolean(state?.shop?.refreshAt&&state.shop.refreshAt<=serverNow());
  }
  function tick(){
    const next=Number(state?.shop?.refreshAt||0);
    if(next){
      const current=serverNow(),expired=next<=current;
      $("merchant-refresh").textContent=expired?"Nova rotação · sincronizando…":"Renova em "+durationText((next-current)/1000);
      if(expired&&!document.hidden&&!busy&&performance.now()>=retryAfter){
        retryAfter=performance.now()+15000;
        refresh("Nova rotação sincronizada.");
      }
    }
    for(const clock of $("active-queues").querySelectorAll("[data-queue-deadline]")){
      const remaining=(Number(clock.dataset.queueDeadline)-serverNow())/1000;
      clock.textContent=remaining>0?"Tempo restante · "+durationText(remaining):"Aguardando sincronização da fila";
      if(!(remaining>0))clock.closest("article").querySelectorAll("button").forEach(control=>{control.disabled=true;});
    }
  }
  function acceptState(result){
    if(!result.state)throw new Error("O reino retornou um estado incompleto.");
    state=result.state;
    outdated=false;
    clockOffset=Number.isFinite(state.shop?.serverTime)?state.shop.serverTime-performance.now():null;
  }
  function render(){
    if(!state)return;
    refreshBalances();
    renderExchange();renderMerchantSpecials();renderHeroRecruitment();renderHeroShop();renderAcceleratorInventory();renderQueues();renderSupplies();renderOfficialShop();
    tick();
  }
  function lock(){
    busy=true;
    $("market-refresh").disabled=true;
    document.querySelectorAll("button[data-action]").forEach(control=>{control.disabled=true;});
  }
  function unlock(previous){
    busy=false;
    $("market-refresh").disabled=false;
    render();
    if(previous?.dataset.action){
      const same=[...document.querySelectorAll("button[data-action]:not(:disabled)")].find(control=>
        Object.entries(previous.dataset).every(([key,value])=>control.dataset[key]===value));
      if(same&&document.activeElement===document.body)same.focus({preventScroll:true});
    }
  }
  async function refresh(message=""){
    if(busy)return;
    const previous=document.activeElement;
    lock();
    try{
      acceptState(await request("/api/game/state"));
      if(message)setStatus(message);
    }catch(error){
      outdated=true;
      retryAfter=performance.now()+15000;
      setStatus(error.message,"error");
    }finally{unlock(previous);}
  }
  async function perform(action,success,rotating=false){
    if(busy)return;
    if(rotating&&rotationExpired()){refresh("Nova rotação sincronizada. Confira a oferta atual.");return;}
    const previous=document.activeElement;
    lock();
    try{
      if(rotating&&Number.isSafeInteger(state.shop?.cycle))action.cycle=state.shop.cycle;
      const result=await request("/api/game/action",{method:"POST",body:action});
      acceptState(result);
      if(action.type==="hero_summon")renderSummons(result.battle?.summons||[]);
      setStatus(success);
    }catch(error){
      setStatus(error.message||"Operação não concluída.", "error");
      try{acceptState(await request("/api/game/state"));}
      catch{outdated=true;retryAfter=performance.now()+15000;}
    }finally{unlock(previous);}
  }
  document.addEventListener("click",event=>{
    const target=event.target.closest("button[data-action]");
    if(!target||target.disabled||busy||outdated)return;
    const action=target.dataset.action;
    if(action==="exchange")perform({type:"merchant_exchange",offerId:target.dataset.offerId},"Troca concluída. O acelerador foi enviado ao inventário.",true);
    else if(action==="hero-buy")perform({type:"hero_shop_buy",heroKey:target.dataset.heroKey},"Fragmentos comprados e creditados ao herói.",true);
    else if(action==="hero-summon")perform({type:"hero_summon",quantity:Number(target.dataset.quantity)},"Convocação concluída. Novos heróis e fragmentos foram sincronizados.");
    else if(action==="buy")perform({type:"shop_buy",item:target.dataset.item,source:target.dataset.source},"Compra concluída. Saldos e inventário atualizados.",target.dataset.source==="merchant");
    else if(action==="speedup")perform({type:"queue_speedup",queueId:Number(target.dataset.queueId),itemId:target.dataset.item,quantity:1},"Acelerador aplicado à fila. O tempo foi recalculado pelo servidor.");
    else if(action==="exp-book")perform({type:"hero_use_exp_book",heroKey:$("exp-hero").value},"Experiência aplicada ao herói.");
    else if(action==="shield")perform({type:"castle_shield_activate",itemId:target.dataset.item,requestId:crypto.randomUUID()},"Escudo ativado no castelo.");
  });
  for(const key of Object.keys(labels)){
    const art=worldResourceArt(key);
    if(art)$("balance-"+key).previousElementSibling.prepend(art);
  }
  $("merchant-affordable").addEventListener("change",()=>{if(state)renderExchange();});
  $("market-category").addEventListener("change",()=>{if(state)renderOfficialShop();});
  $("market-refresh").addEventListener("click",()=>refresh("Mercado e inventário atualizados."));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state)refresh();});
  setInterval(tick,1000);
  refresh("Mercado sincronizado com o reino.");
})();
