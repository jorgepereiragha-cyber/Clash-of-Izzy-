/* Engajamento do reino: o cliente apenas exibe; D1 valida e concede toda recompensa. */
(() => {
  "use strict";
  const tutorial = document.getElementById("onboardingPanel");
  const daily = document.getElementById("dailyRewardsPanel");
  if (!tutorial || !daily) return;
  const $ = id => document.getElementById(id);
  const token = () => { try { return localStorage.getItem("coi_game_token") || sessionStorage.getItem("coi_game_token") || ""; } catch { return ""; } };
  let latestRefresh = 0, busy = false, opened = false;
  let sessionId = null;
  try { sessionId = crypto.randomUUID(); } catch { sessionId = "engagement_" + Date.now(); }
  const fmt = value => Number(value || 0).toLocaleString("pt-BR");
  const rewardText = reward => {
    if (!reward) return "";
    const parts = [];
    if (reward.gems) parts.push(fmt(reward.gems) + " gemas");
    if (reward.wood) parts.push(fmt(reward.wood) + " madeira");
    if (reward.stone) parts.push(fmt(reward.stone) + " pedra");
    if (reward.iron) parts.push(fmt(reward.iron) + " ferro");
    if (reward.heroFragments) parts.push(fmt(reward.heroFragments) + " fragmento comum");
    return parts.join(" + ");
  };
  async function api(path, method="GET") {
    const auth = token();
    if (!auth) throw Error("Sessão indisponível. Abra seu reino primeiro.");
    const response = await fetch("/api/game/" + path, {
      method, cache:"no-store",
      headers: {Authorization:"Bearer " + auth, ...(method==="POST"?{"Content-Type":"application/json"}:{})},
      ...(method==="POST"?{body:"{}"}:{})
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(body.error || "O servidor não concluiu a solicitação.");
    return body;
  }
  async function track(event) {
    if (!token()) return;
    try {
      await fetch("/api/game/analytics",{method:"POST",headers:{"Authorization":"Bearer "+token(),"Content-Type":"application/json"},
        body:JSON.stringify({event,sessionId,data:{source:"kingdom"}})});
    } catch {}
  }
  const showStep = (done,id,text,href) => {
    const node = document.createElement("li");
    if (done) { node.textContent = "✓ " + text; return node; }
    const link = document.createElement("a");
    link.href = href; link.textContent = "→ " + text;
    link.addEventListener("click",event => {
      if (id !== "farm") return;
      const target = document.querySelector('[data-upgrade="farm"]');
      if (!target) return;
      event.preventDefault(); target.scrollIntoView({behavior:"smooth",block:"center"});
      target.focus({preventScroll:true});
    });
    node.append(link); return node;
  };
  function drawOnboarding(data) {
    tutorial.hidden = data.claimed === true;
    if (data.claimed) return;
    const steps = $("onboardingSteps"); steps.replaceChildren(
      showStep(data.name,"name","Escolher seu nome","#nicknameForm"),
      showStep(data.farm,"farm","Evoluir a Fazenda","#buildings"),
      showStep(data.training,"training","Iniciar o treinamento de soldados","#trainingForm")
    );
    $("onboardingProgress").value = [data.name,data.farm,data.training].filter(Boolean).length;
    $("onboardingProgress").setAttribute("aria-valuenow",String($("onboardingProgress").value));
    $("onboardingClaim").disabled = !data.eligible || busy;
    $("onboardingStatus").textContent = data.eligible
      ? "Parabéns! Resgate 500 gemas agora. O crédito será confirmado pelo servidor."
      : "Complete as três tarefas no reino para desbloquear 500 gemas.";
    if (!opened) { opened=true; void track("onboarding.viewed"); }
  }
  function drawDaily(data) {
    daily.hidden = false;
    const items = $("dailyRewardDays"); items.replaceChildren();
    for (const reward of data.rewards || []) {
      const item = document.createElement("li");
      item.className = "coi-daily-day" + (Number(reward.day) === Number(data.day) ? " current" : "");
      const title = document.createElement("strong"); title.textContent = "Dia " + reward.day;
      const detail = document.createElement("span"); detail.textContent = rewardText(reward);
      item.append(title,detail); items.append(item);
    }
    $("dailyClaim").disabled = data.claimed === true || busy;
    $("dailyStatus").textContent = data.claimed ? "Recompensa de hoje já recebida. Volte no próximo dia UTC."
      : "Próximo resgate: dia " + data.day + " · " + rewardText(data.reward) + ".";
  }
  async function refresh(force=false) {
    if (busy || !token() || (!force && Date.now()-latestRefresh < 10000)) return;
    latestRefresh = Date.now();
    const [onboarding,rewards] = await Promise.allSettled([api("onboarding"),api("daily-reward")]);
    if (onboarding.status==="fulfilled") drawOnboarding(onboarding.value);
    else { tutorial.hidden=true; $("onboardingClaim").disabled=true; }
    if (rewards.status==="fulfilled") drawDaily(rewards.value);
    else { daily.hidden=true; $("dailyClaim").disabled=true; }
  }
  async function claim(endpoint,statusId,event) {
    if (busy) return;
    busy = true;
    $(statusId).textContent = "Confirmando o resgate no servidor…";
    $("dailyClaim").disabled = true; $("onboardingClaim").disabled = true;
    try {
      const result = await api(endpoint,"POST");
      $(statusId).textContent = result.message || "Resgate confirmado.";
      void track(event);
      $("refresh")?.click();
    } catch (error) {
      $(statusId).textContent = String(error?.message||"Não foi possível resgatar.");
    } finally {
      busy=false;latestRefresh=0;
      void refresh(true);
    }
  }
  $("onboardingClaim").addEventListener("click",()=>claim("onboarding","onboardingStatus","onboarding.completed"));
  $("dailyClaim").addEventListener("click",()=>claim("daily-reward","dailyStatus","daily_reward.claimed"));
  $("onboardingReload").addEventListener("click",()=>{latestRefresh=0;void refresh(true);});
  addEventListener("coi:kingdom-render",()=>{void refresh();});
  addEventListener("pageshow",()=>{void refresh(true);});
})();
