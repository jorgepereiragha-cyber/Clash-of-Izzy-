(() => {
  "use strict";

  const root = document.getElementById("technologyTree");
  const status = document.getElementById("technologyStatus");
  if (!root || !status) return;

  const effectNames = {
    infantry_attack: "Ataque de infantaria",
    cavalry_attack: "Ataque de cavalaria",
    archer_attack: "Ataque de arqueiros",
    wall_defense: "Defesa de muralhas",
    march_speed: "Velocidade de marcha",
    food_production: "Produção de comida",
    stone_production: "Produção de pedra",
    wood_production: "Produção de madeira"
  };
  const categoryNames = { military: "Militar", defense: "Defesa", economy: "Economia" };
  const fmt = value => Number(value || 0).toLocaleString("pt-BR");
  const make = (tag, className, value) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined && value !== null) el.textContent = String(value);
    return el;
  };
  const getToken = () => {
    try {
      return localStorage.getItem("coi_game_token") || sessionStorage.getItem("coi_game_token") || "";
    } catch {
      return "";
    }
  };
  const formatDuration = seconds => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours) return hours + "h " + String(minutes).padStart(2, "0") + "min";
    if (minutes) return minutes + "min";
    return total + "s";
  };

  let state = { technologies: [], queues: [] };
  let busy = false;

  function renderEffect(effect) {
    const entries = Object.entries(effect || {}).filter(([key, value]) => effectNames[key] && Number.isFinite(Number(value)) && Number(value) > 0);
    if (!entries.length) return "Bônus estratégico";
    return entries.map(([key, value]) => effectNames[key] + " +" + (Number(value) * 100).toLocaleString("pt-BR") + "% por nível").join(" · ");
  }

  function render() {
    root.replaceChildren();
    const technologies = Array.isArray(state.technologies) ? state.technologies : [];
    const queues = Array.isArray(state.queues) ? state.queues : [];
    const activeQueue = queues.find(item => item.queue_type === "research" && item.status === "running");
    if (!getToken()) {
      status.textContent = "Entre no seu reino para pesquisar tecnologias.";
      root.append(make("p", "technology-empty", "A árvore de tecnologias aparece após entrar no reino."));
      return;
    }
    if (!technologies.length) {
      status.textContent = "Catálogo de tecnologias indisponível.";
      root.append(make("p", "technology-empty", "Não foi possível carregar o catálogo. Atualize o reino para tentar novamente."));
      return;
    }
    const academyLevel = Number(technologies[0]?.academy_level || 0);
    status.textContent = academyLevel > 0
      ? "Academia nível " + academyLevel + " · desbloqueio de até " + Math.min(10, academyLevel * 3) + " níveis por tecnologia."
      : "Construa o Centro de Pesquisa Militar para iniciar sua árvore tecnológica.";

    const fragment = document.createDocumentFragment();
    for (const tech of technologies) {
      const level = Number(tech.level || 0);
      const maxLevel = Number(tech.max_level || 10);
      const levelCap = Number(tech.level_cap || 0);
      const queueKey = "tech:" + tech.id;
      const isRunning = activeQueue && activeQueue.target_key === queueKey;
      const card = make("article", "technology-card");
      const top = make("div", "technology-card-top");
      const name = make("h3", "technology-name", tech.name);
      const levelTag = make("span", "technology-level", "Nível " + level + "/" + maxLevel);
      top.append(name, levelTag);
      card.append(top);
      card.append(make("span", "technology-category", categoryNames[tech.category] || tech.category));
      card.append(make("p", "technology-description", tech.description || "Pesquisa estratégica do reino."));
      card.append(make("p", "technology-effect", renderEffect(tech.effect)));

      const progress = make("div", "technology-progress");
      const progressLabel = make("span", "", "Progresso");
      const progressBar = make("div", "technology-progress-track");
      const progressFill = make("span", "technology-progress-fill");
      const progressPercent = maxLevel > 0 ? Math.min(100, Math.round(level / maxLevel * 100)) : 0;
      progressFill.style.width = progressPercent + "%";
      progressBar.append(progressFill);
      progress.append(progressLabel, progressBar);
      card.append(progress);

      if (isRunning) {
        const endAt = tech.research_end_time ? new Date(Number(tech.research_end_time) * 1000) : new Date(activeQueue.completes_at);
        const endLabel = Number.isFinite(endAt.getTime()) ? endAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "em andamento";
        card.append(make("p", "technology-lock", "Pesquisa em andamento · conclusão prevista " + endLabel));
      } else if (level >= maxLevel) {
        card.append(make("p", "technology-complete", "Nível máximo alcançado."));
      } else if (level >= levelCap) {
        card.append(make("p", "technology-lock", "Melhore a Academia para desbloquear o próximo nível."));
      } else if (!tech.prerequisite_met) {
        card.append(make("p", "technology-lock", "Pré-requisito: " + tech.prerequisite_tech + " nível 1."));
      } else if (activeQueue) {
        card.append(make("p", "technology-lock", "Fila de pesquisa ocupada por outra tecnologia."));
      }

      const footer = make("div", "technology-footer");
      const cost = tech.next_cost_gold === null ? "—" : fmt(tech.next_cost_gold) + " Ouro";
      const duration = tech.next_research_seconds === null ? "—" : formatDuration(tech.next_research_seconds);
      footer.append(make("span", "technology-cost", cost));
      footer.append(make("span", "technology-duration", duration));
      card.append(footer);

      const canResearch = !busy && !activeQueue && level < maxLevel && level < levelCap && Boolean(tech.prerequisite_met);
      const button = make("button", "technology-action", isRunning ? "Em pesquisa" : canResearch ? "Pesquisar nível " + (level + 1) : "Bloqueada");
      button.type = "button";
      button.disabled = !canResearch;
      if (canResearch) button.addEventListener("click", () => startResearch(tech.id, button));
      card.append(button);
      fragment.append(card);
    }
    root.append(fragment);
  }

  async function startResearch(technologyId, button) {
    if (busy) return;
    const token = getToken();
    if (!token) {
      status.textContent = "Sua sessão expirou. Entre novamente no reino.";
      return;
    }
    busy = true;
    if (button) button.disabled = true;
    status.textContent = "Enviando pesquisa ao servidor…";
    try {
      const response = await fetch("/api/game/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ type: "technology", technology: technologyId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar a pesquisa.");
      status.textContent = "Pesquisa iniciada. O nível será ativado após a conclusão da fila.";
      const refreshResponse = await fetch("/api/game/state", {
        headers: { Authorization: "Bearer " + token }
      }).catch(() => null);
      if (refreshResponse?.ok) {
        const refreshed = await refreshResponse.json().catch(() => ({}));
        if (refreshed.state) {
          state = {
            technologies: refreshed.state.technologies || [],
            queues: refreshed.state.queues || []
          };
        }
      }
      window.dispatchEvent(new CustomEvent("coi:technology-refresh"));
    } catch (error) {
      status.textContent = error.message || "Falha ao iniciar a pesquisa.";
    } finally {
      busy = false;
      render();
    }
  }

  window.addEventListener("coi:kingdom-technologies", event => {
    state = event.detail || { technologies: [], queues: [] };
    render();
  });
  if (window.__coiKingdomTechnologyState) {
    state = window.__coiKingdomTechnologyState;
    render();
  }
})();
