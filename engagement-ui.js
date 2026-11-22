/* Engajamento 4X: progresso salvo pelo D1, não pelo armazenamento do navegador. */
(() => {
  "use strict";
  const onboarding = document.getElementById("coi-onboarding");
  const daily = document.getElementById("coi-daily");
  if (!onboarding || !daily) return;
  let loading = false, lastRefresh = 0;
  const token = () => { try { return localStorage.getItem("coi_game_token") || sessionStorage.getItem("coi_game_token"); } catch { return null; } };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp","<":"&lt",">":"&gt",'"':"&quot","'":"&#39;"}[ch]));
  const steps = [
    { key:"name", label:"Escolha seu nome", detail:"Salve seu nickname na seção Jogadores do mundo.", href:"#nicknameForm" },
    { key:"farm", label:"Melhore a fazenda", detail:"Inicie uma melhoria da Fazenda na lista de edifícios.", href:"#buildings" },
    { key:"training", label:"Treine soldados", detail:"Inicie o treinamento de pelo menos um soldado no quartel.", href:"#trainingForm" }
  ];
  const event = async (name, data = {}) => {
    const auth = token(); if (!auth) return;
    try { await fetch("/api/game/analytics",{method:"POST",headers:{Authorization:"Bearer "+auth,"Content-Type":"application/json"},body:JSON.stringify({event:name,data})}); } catch {}
  };
  async function api(url, method = "GET") {
    const auth=token(); if(!auth)throw Error("Entre no seu reino para carregar as recompensas.");
    const response=await fetch("/api/game/"+url,{method,headers:{Authorization:"Bearer "+auth},cache:"no-store"});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||"Não foi possível consultar o servidor.");
    return result;
  }
  function renderOnboarding(status){
    if(status.claimed){onboarding.hidden=true;return;}
    onboarding.hidden=false;
    const complete=steps.filter(step=>status[step.key]).length;
    const next=steps.find(step=>!status[step.key]);
    document.getElementById("coi-onboarding-progress").textContent=complete+" de 3 tarefas concluídas";
    document.getElementById("coi-onboarding-steps").innerHTML=steps.map(step=>
      '<li>'+(status[step.key]?'✓ ': '○ ')+esc(step.label)+(status[step.key]?'': ' — <a href="'+step.href+'">Ir à tarefa</a>')+'</li>').join("");
    const action=document.getElementById("coi-onboarding-claim");
    action.hidden=!status.eligible;
    action.disabled=!status.eligible;
    const hint=document.getElementById("coi-onboarding-hint");
    hint.textContent=next?next.detail:"Todas as tarefas foram verificadas pelo servidor. Resgate seu bônus.";
  }
  function formatReward(reward){
    const values=[];
    if(reward.gems)values.push(reward.gems+" gemas");
    if(reward.wood)values.push(reward.wood+" madeira");
    if(reward.stone)values.push(reward.stone+" pedra");
    if(reward.iron)values.push(reward.iron+" ferro");
    if(reward.heroFragments)values.push(reward.heroFragments+" fragmento comum na mochila");
    return values.join(" + ");
  }
  function renderDaily(status){
    daily.hidden=false;
    document.getElementById("coi-daily-progress").textContent=
      "Dia "+status.day+"/7 — "+formatReward(status.reward)+". Renovação: 00:00 UTC.";
    const action=document.getElementById("coi-daily-claim");
    action.disabled=Boolean(status.claimed);
    action.textContent=status.claimed?"Resgatado hoje":"Resgatar recompensa diária";
  }
  async function refresh(force=false){
    if(loading||!token()||document.hidden||!document.getElementById("game")||document.getElementById("game").hidden)return;
    if(!force&&Date.now()-lastRefresh<15000)return;
    loading=true;lastRefresh=Date.now();
    const status=document.getElementById("coi-reward-status");
    try{
      const [progress,reward]=await Promise.all([api("onboarding"),api("daily-reward")]);
      renderOnboarding(progress);renderDaily(reward);
      status.textContent="Progresso sincronizado.";
    }catch(e){status.textContent=e.message||"Recompensas indisponíveis.";}
    finally{loading=false;}
  }
  async function claim(kind,button){
    if(loading)return;
    loading=true;button.disabled=true;
    const status=document.getElementById("coi-reward-status");
    try{
      const result=await api(kind,"POST");
      status.textContent=result.message||"Recompensa recebida.";
      await event(kind==="onboarding"?"onboarding.completed":"daily_reward.claimed",{phase:"complete"});
      lastRefresh=0;
    }catch(e){status.textContent=e.message||"Erro ao resgatar.";}
    finally{loading=false;void refresh(true);}
  }
  document.getElementById("coi-onboarding-claim").addEventListener("click",e=>claim("onboarding",e.currentTarget));
  document.getElementById("coi-daily-claim").addEventListener("click",e=>claim("daily-reward",e.currentTarget));
  window.addEventListener("coi:command-state",()=>{void refresh();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)void refresh(true);});
  document.getElementById("coi-refresh-rewards").addEventListener("click",()=>refresh(true));
})();
