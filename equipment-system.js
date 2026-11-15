// Equipamentos persistentes: inventário e loadout são validados pelo Worker.
(() => {
  const API="/api";
  let token=null,state=null,selected="coroa_izzy",selectedHeroId=null,busy=false;
  const $=id=>document.getElementById(id);
  const fmt=value=>Number(value||0).toLocaleString("pt-BR");
  const labels={defense:"Defesa",health:"Vida",attack:"Ataque",resourceBonus:"Bônus de recursos"};
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
    $("skin-gems").textContent="Gemas: "+fmt(state?.player?.gems);
    $("skin-shards").textContent="Fragmentos: "+fmt(cosmetics.shards);
    const collection=cosmetics.collections?.find(item=>item.id==="col_norse");
    const complete=Boolean(collection?.skins?.every(id=>owned.has(id)));
    const claimed=(cosmetics.claimed||[]).includes("col_norse");
    const claim=$("claim-norse-collection");
    claim.disabled=busy||!complete||claimed;
    claim.textContent=claimed?"RECOMPENSA RESGATADA":complete?"RESGATAR COLEÇÃO · +5.000 GEMAS / 200 FRAGMENTOS":"COLEÇÃO "+skins.filter(([id])=>owned.has(id)).length+"/6";
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
    $("item-name").textContent=item.name;
    $("current-level").textContent=item.level;
    $("next-level").textContent=item.level<item.maxLevel?item.level+1:"MÁX.";
    const current=item.stats||{},next=item.nextLevelStats||{};
    $("current-def").textContent=Object.entries(current).map(([key,value])=>labels[key]+": "+(key==="resourceBonus"?value+"%":fmt(value))).join(" · ")||"—";
    $("next-def").textContent=Object.entries(next).map(([key,value])=>labels[key]+": "+(key==="resourceBonus"?value+"%":fmt(value))).join(" · ")||"Nível máximo";
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
  }
  async function refresh(){
    token=localStorage.getItem("coi_game_token")||sessionStorage.getItem("coi_game_token");
    if(!token){setStatus("Entre no seu reino primeiro. Depois volte para equipar seus heróis.",true);return;}
    const response=await request("/game/state");state=response.state;render();
  }
  async function perform(action,success){
    if(busy)return;busy=true;render();
    try{const result=await request("/game/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action)});state=result.state;setStatus(success);}
    catch(error){setStatus(error.message,true);try{await refresh()}catch{}}
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
    refresh().catch(error=>setStatus(error.message,true));
  });
})();
