// Equipamentos persistentes: o Worker é a única autoridade para ouro, nível e bloqueio.
(() => {
  const API="/api";
  let token=null,state=null,selected="coroa_izzy",busy=false;
  const $=id=>document.getElementById(id);
  const fmt=value=>Number(value||0).toLocaleString("pt-BR");
  const labels={defense:"Defesa",health:"Vida",attack:"Ataque",resourceBonus:"Bônus de recursos"};
  function setStatus(message,error=false){
    let node=$("equipment-status");
    if(!node){node=document.createElement("p");node.id="equipment-status";node.setAttribute("role","status");node.style.cssText="color:#f5d58a;line-height:1.45;margin:12px 0";document.querySelector(".mobile-equipment-container")?.append(node);}
    node.textContent=message;node.style.color=error?"#ffb4a9":"#f5d58a";
  }
  async function request(path,options={}){
    const response=await fetch(API+path,{...options,headers:{...(options.headers||{}),...(token?{Authorization:"Bearer "+token}:{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Falha ao sincronizar equipamentos.");
    return data;
  }
  function render(){
    const item=(state?.equipment||[]).find(x=>x.id===selected)||(state?.equipment||[])[0];
    if(!item){setStatus("Nenhum equipamento disponível neste reino.",true);return;}
    selected=item.id;
    $("item-name").textContent=item.name;
    $("current-level").textContent=item.level;
    $("next-level").textContent=item.level<item.maxLevel?item.level+1:"MÁX.";
    const current=item.stats||{},next=item.nextLevelStats||{};
    $("current-def").textContent=Object.entries(current).map(([k,v])=>labels[k]+": "+(k==="resourceBonus"?v+"%":fmt(v))).join(" · ")||"—";
    $("next-def").textContent=Object.entries(next).map(([k,v])=>labels[k]+": "+(k==="resourceBonus"?v+"%":fmt(v))).join(" · ")||"Nível máximo";
    $("current-res").textContent=item.isLocked?"Equipamento bloqueado":"Equipamento disponível";
    $("next-res").textContent="Máximo: nível "+item.maxLevel;
    $("upgrade-cost").textContent=fmt(item.upgradeCost);
    $("player-gold").textContent=fmt(state.kingdom?.gold);
    const lock=$("lock-btn");lock.textContent=item.isLocked?"🔒 Travado":"🔓 Destravado";
    lock.setAttribute("aria-pressed",String(item.isLocked));
    const upgrade=document.querySelector(".upgrade-btn-mobile");
    upgrade.disabled=busy||item.isLocked||item.level>=item.maxLevel;
    upgrade.textContent=item.level>=item.maxLevel?"NÍVEL MÁXIMO":item.isLocked?"DESTRAVE PARA EVOLUIR":"⚒️ EVOLUIR EQUIPAMENTO";
  }
  async function refresh(){
    token=localStorage.getItem("coi_game_token")||sessionStorage.getItem("coi_game_token");
    if(!token){setStatus("Entre no seu reino primeiro. Depois volte para evoluir seus equipamentos.",true);return;}
    const response=await request("/game/state");
    state=response.state;render();
  }
  window.upgradeEquipment=async itemId=>{
    if(busy)return;busy=true;render();
    try{const result=await request("/game/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"equipment_upgrade",itemId:itemId||selected})});state=result.state;setStatus("Equipamento evoluído e salvo no servidor.");}
    catch(error){setStatus(error.message,true);try{await refresh()}catch{}}
    finally{busy=false;render();}
  };
  window.toggleLock=async itemId=>{
    if(busy)return;busy=true;render();
    try{const result=await request("/game/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"equipment_lock",itemId:itemId||selected})});state=result.state;setStatus("Bloqueio do equipamento atualizado no servidor.");}
    catch(error){setStatus(error.message,true);try{await refresh()}catch{}}
    finally{busy=false;render();}
  };
  document.addEventListener("DOMContentLoaded",()=>{refresh().catch(error=>setStatus(error.message,true));});
})();
