(() => {
  "use strict";
  if (window.__COI_MARKET__) return;
  window.__COI_MARKET__ = true;
  const $ = id => document.getElementById(id);
  const fmt = value => Number(value || 0).toLocaleString("pt-BR");
  const labels = {food:"Comida",wood:"Madeira",stone:"Pedra",iron:"Ferro",gold:"Ouro",gems:"Diamantes"};
  const icons = {food:"🌾",wood:"🪵",stone:"🪨",iron:"⛓️",gold:"🪙",gems:"💎"};
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
  let state = null, busy = false;
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
      cache:"no-store"
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Não foi possível concluir a operação.");
    return data;
  }
  function node(tag,className,text){
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text!==undefined)element.textContent=String(text);
    return element;
  }
  function button(text,action,data,disabled=false){
    const element=node("button","market-action",text);
    element.type="button";element.dataset.action=action;
    for(const [key,value] of Object.entries(data||{}))element.dataset[key]=String(value);
    element.disabled=busy||disabled;
    return element;
  }
  function setStatus(message,kind="info"){
    const element=$("market-status");
    element.textContent=message;element.dataset.kind=kind==="error"?"error":"info";
  }
  function costText(costs){
    return Object.entries(costs||{}).filter(([,amount])=>Number(amount)>0)
      .map(([key,amount])=>(icons[key]||"")+" "+fmt(amount)+" "+(labels[key]||key)).join(" + ");
  }
  function hasCosts(costs){
    return Object.entries(costs||{}).every(([key,amount])=>Number(state?.kingdom?.[key]||0)>=Number(amount||0));
  }
  function refreshBalances(){
    for(const key of Object.keys(labels)){
      const element=$("balance-"+key);
      if(element)element.textContent=fmt(key==="gems"?state?.player?.gems:state?.kingdom?.[key]);
    }
  }
  function renderExchange(){
    const root=$("merchant-exchanges");root.replaceChildren();
    const offers=state?.shop?.exchangeOffers||[];
    if(!offers.length){root.append(node("p","empty-state","Nenhuma troca disponível nesta rotação."));return;}
    for(const offer of offers){
      const card=node("article","market-card");
      card.append(node("div","market-icon","⚖️"),node("h3","",offer.name),node("p","",offer.description));
      card.append(node("p","market-price","Entrega: "+(state.shop.items?.[offer.reward?.item]?.name||offer.rewardName||offer.reward?.item)+" × "+fmt(offer.reward?.quantity||1)));
      card.append(node("p","market-meta","Custo: "+costText(offer.costs)));
      card.append(node("p","market-meta","Estoque restante: "+fmt(offer.stock)));
      card.append(button("TROCAR RECURSOS","exchange",{offerId:offer.id},offer.stock<=0||!hasCosts(offer.costs)));
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
      card.append(node("p","market-price","💎 "+fmt(offer.price)+" diamantes · "+fmt(offer.discount)+"% de desconto"));
      card.append(node("p","market-meta","Estoque: "+fmt(offer.stock)));
      card.append(button("COMPRAR OFERTA","buy",{item:offer.id,source:"merchant"},offer.stock<=0||Number(state.player?.gems||0)<Number(offer.price||0)));
      root.append(card);
    }
  }
  function renderHeroRecruitment(){
    const root=$("hero-recruitment");root.replaceChildren();
    const options=[
      {quantity:1,cost:100,label:"Convocação individual",description:"Uma chance de recrutar um novo comandante ou receber fragmentos de um repetido."},
      {quantity:10,cost:900,label:"Convocação em lote",description:"Dez convocações com desconto sobre o preço individual."}
    ];
    for(const option of options){
      const card=node("article","market-card");
      card.append(node("div","market-icon","📜"),node("h3","",option.label),node("p","",option.description));
      card.append(node("p","market-price","💎 "+fmt(option.cost)+" diamantes"));
      card.append(node("p","market-meta","Probabilidades por convocação: 70% Comum · 25% Raro · 5% Lendário"));
      card.append(button(option.quantity===1?"CONVOCAR 1 HERÓI":"CONVOCAR 10 HERÓIS","hero-summon",{quantity:option.quantity},Number(state.player?.gems||0)<option.cost));
      root.append(card);
    }
  }
  function renderHeroShop(){
    const root=$("hero-offers");root.replaceChildren();
    const offers=state?.heroShop?.offers||[];
    if(!offers.length){root.append(node("p","empty-state","Recrute um herói para habilitar a compra de fragmentos. Nenhum herói será criado pela loja de fragmentos sem recrutamento."));return;}
    for(const offer of offers){
      const card=node("article","market-card");
      const rarity={white:"Branco · Comum",blue:"Azul · Raro",purple:"Roxo · Épico",gold:"Dourado · Lendário"}[offer.rarity]||"Raridade não informada";
      card.dataset.heroRarity=["white","blue","purple","gold"].includes(offer.rarity)?offer.rarity:"unknown";
      const icon={white:"⚔️",blue:"🛡️",purple:"✦",gold:"👑"}[offer.rarity]||"⚔️";
      card.append(node("div","market-icon",icon),node("h3","",offer.name),node("p","",rarity+" · "+fmt(offer.stars)+" estrela(s)"));
      card.append(node("p","market-price","Fragmentos: "+fmt(offer.fragments)+" → +"+fmt(offer.quantity)));
      card.append(node("p","market-meta","Custo: "+costText(offer.costs)));
      card.append(node("p","market-meta","Estoque da rotação: "+fmt(offer.stock)));
      card.append(button("COMPRAR FRAGMENTOS","hero-buy",{heroKey:offer.heroKey},offer.stock<=0||!hasCosts(offer.costs)));
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
      const remaining=Math.max(0,(Date.parse(queue.completes_at)-Date.now())/1000);
      info.append(node("h4","",title+" · "+(queue.target_key||"Projeto")),node("p","","Tempo restante aproximado: "+durationText(remaining)));
      const controls=node("div","queue-actions");
      for(const itemId of compatible[queue.queue_type]||[]){
        const count=inventory.get(itemId)||0;
        if(count<=0)continue;
        const meta=state.shop.items?.[itemId];
        const action=node("button","",(meta?.name||itemId)+" × "+fmt(count));
        action.type="button";action.dataset.action="speedup";action.dataset.queueId=String(queue.id);action.dataset.item=itemId;
        action.disabled=busy;controls.append(action);
      }
      if(!controls.childElementCount)controls.append(node("span","market-meta","Sem aceleradores compatíveis no inventário."));
      card.append(info,controls);root.append(card);
    }
  }
  function renderOfficialShop(){
    const root=$("official-products");root.replaceChildren();
    const items=Object.entries(state?.shop?.items||{});
    const featured=items.filter(([,item])=>["accelerators","special","packages"].includes(item.category));
    for(const [id,item] of featured){
      const card=node("article","market-card");
      card.append(node("div","market-icon",item.icon||"🎁"),node("h3","",item.name),node("p","",item.desc||"Item do catálogo do reino."));
      const currency=item.currency==="gems"?"diamantes":"ouro";
      card.append(node("p","market-price",fmt(item.price)+" "+currency));
      const enough=Number(item.currency==="gems"?state.player?.gems:state.kingdom?.gold)>=Number(item.price||0);
      card.append(button("COMPRAR","buy",{item:id,source:"shop"},!enough));
      root.append(card);
    }
    if(!root.childElementCount)root.append(node("p","empty-state","Catálogo indisponível."));
  }
  function render(){
    if(!state)return;
    refreshBalances();
    const next=Number(state.shop?.refreshAt||0);
    $("merchant-refresh").textContent=next?"Próxima rotação: "+new Date(next).toLocaleString("pt-BR"):"Rotação periódica";
    renderExchange();renderMerchantSpecials();renderHeroRecruitment();renderHeroShop();renderAcceleratorInventory();renderQueues();renderOfficialShop();
  }
  async function refresh(){
    const result=await request("/api/game/state");state=result.state;render();
  }
  async function perform(action,success){
    if(busy)return;
    busy=true;render();
    try{
      const result=await request("/api/game/action",{method:"POST",body:action});
      state=result.state;setStatus(success,"info");
    }catch(error){
      setStatus(error.message||"Operação não concluída.", "error");
      try{await refresh();}catch{}
    }finally{busy=false;render();}
  }
  document.addEventListener("click",event=>{
    const target=event.target.closest("button[data-action]");
    if(!target||busy)return;
    const action=target.dataset.action;
    if(action==="exchange")perform({type:"merchant_exchange",offerId:target.dataset.offerId},"Troca concluída. O acelerador foi enviado ao inventário.");
    else if(action==="hero-buy")perform({type:"hero_shop_buy",heroKey:target.dataset.heroKey},"Fragmentos comprados e creditados ao herói.");
    else if(action==="hero-summon")perform({type:"hero_summon",quantity:Number(target.dataset.quantity)},"Convocação concluída. Novos heróis e fragmentos foram sincronizados.");
    else if(action==="buy")perform({type:"shop_buy",item:target.dataset.item,source:target.dataset.source},"Compra concluída e item enviado ao inventário.");
    else if(action==="speedup")perform({type:"queue_speedup",queueId:Number(target.dataset.queueId),itemId:target.dataset.item,quantity:1},"Acelerador aplicado à fila. O tempo foi recalculado pelo servidor.");
  });
  $("market-refresh").addEventListener("click",()=>refresh().then(()=>setStatus("Mercado e inventário atualizados.")).catch(error=>setStatus(error.message,"error")));
  refresh().then(()=>setStatus("Mercado sincronizado com o reino.")).catch(error=>setStatus(error.message,"error"));
})();