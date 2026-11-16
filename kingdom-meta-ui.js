(() => {
  "use strict";

  const game = document.getElementById("game");
  if (!game) return;
  let root = null;
  let snapshot = null;
  let meta = {};
  let busy = false;

  const $ = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const fmt = value => Number(value || 0).toLocaleString("pt-BR");
  const token = () => {
    try {
      return localStorage.getItem("coi_game_token") || sessionStorage.getItem("coi_game_token") || "";
    } catch {
      return "";
    }
  };
  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}), Authorization: "Bearer " + token() };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch("/api/game/meta/" + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar este sistema.");
    return data;
  }
  async function gameState() {
    const response = await fetch("/api/game/state", {
      headers: { Authorization: "Bearer " + token() },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Estado do reino indisponível.");
    return data.state || data;
  }
  function actionButton(label, handler, disabled = false, secondary = false) {
    const control = $("button", secondary ? "secondary" : "", label);
    control.type = "button";
    control.disabled = disabled;
    control.addEventListener("click", handler);
    return control;
  }
  function panel(title, description = "") {
    const section = $("section", "panel coi-meta-panel");
    section.append($("h2", "", title));
    if (description) section.append($("p", "muted coi-meta-description", description));
    return section;
  }
  function setStatus(message, error = false) {
    const status = root?.querySelector(".coi-meta-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", error);
  }
  function makeRoot() {
    if (root) return;
    root = $("div", "coi-meta-root");
    const header = $("div", "coi-meta-header");
    const heading = $("div");
    heading.append($("h2", "", "🏅 Centro do Comandante"), $("p", "muted", "Tarefas, recompensas, correspondência e preparação do exército."));
    const refresh = actionButton("↻ Atualizar", () => { void refresh(); }, false, true);
    header.append(heading, refresh);
    const status = $("div", "coi-meta-status muted", "Sincronizando sistemas...");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const grid = $("div", "coi-meta-grid");
    root.append(header, status, grid);
    game.append(root);
  }

  function renderTasks(container, rows, weekly = false) {
    const section = panel(weekly ? "📆 Desafios semanais" : "⚔️ Tarefas diárias",
      weekly ? "Avanço reiniciado a cada semana UTC." : "Conclua atividades normais do reino para ganhar recursos.");
    const tasks = (rows || []).filter(row => (row.period_type === "weekly") === weekly);
    if (!tasks.length) section.append($("p", "muted", "Nenhuma tarefa disponível."));
    for (const task of tasks) {
      const card = $("article", "coi-meta-item");
      const top = $("div", "coi-meta-item-head");
      top.append($("strong", "", task.title), $("span", "coi-meta-progress", fmt(task.progress) + " / " + fmt(task.target_count)));
      const progress = $("progress");
      progress.max = Math.max(1, Number(task.target_count) || 1);
      progress.value = Math.min(progress.max, Number(task.progress) || 0);
      card.append(top, $("p", "muted", task.description), progress);
      const reward = task.reward || {};
      const rewardText = [];
      if (reward.gems) rewardText.push(fmt(reward.gems) + " gemas");
      for (const [key, amount] of Object.entries(reward.resources || {})) rewardText.push(fmt(amount) + " " + key);
      for (const item of reward.speedups || []) rewardText.push(fmt(item.quantity) + " acelerador(es) " + item.queue_type + " · " + fmt(item.duration_seconds) + "s");
      if (rewardText.length) card.append($("small", "muted", "Recompensa: " + rewardText.join(" · ")));
      if (Number(task.claimed)) card.append($("span", "coi-meta-done", "✓ Recompensa resgatada"));
      else if (Number(task.completed)) card.append(actionButton("Resgatar recompensa", async () => {
        await runAction(async () => api("tasks/claim", { method: "POST", body: { task_id: task.id } }), "Recompensa da tarefa resgatada.");
      }));
      else card.append($("small", "muted", "Continue jogando para concluir."));
      section.append(card);
    }
    container.append(section);
  }

  function renderAchievements(container, rows) {
    const section = panel("🏆 Conquistas", "Marcos permanentes do seu reino.");
    if (!rows?.length) section.append($("p", "muted", "Nenhuma conquista disponível."));
    for (const item of rows || []) {
      const card = $("article", "coi-meta-item");
      const head = $("div", "coi-meta-item-head");
      head.append($("strong", "", item.title), $("span", "coi-meta-tier", "Tier " + item.tier));
      card.append(head, $("p", "muted", item.description));
      const progress = $("progress");
      progress.max = Math.max(1, Number(item.requirement_value) || 1);
      progress.value = Math.min(progress.max, Number(item.progress) || 0);
      card.append(progress);
      if (Number(item.claimed)) card.append($("span", "coi-meta-done", "✓ Resgatada"));
      else if (Number(item.completed)) card.append(actionButton("Resgatar", async () => {
        await runAction(async () => api("achievements/claim", { method: "POST", body: { achievement_id: item.id } }), "Conquista resgatada.");
      }));
      else card.append($("small", "muted", fmt(item.progress) + " / " + fmt(item.requirement_value)));
      section.append(card);
    }
    container.append(section);
  }

  function renderMail(container, rows) {
    const section = panel("✉️ Correio do reino", "Avisos do sistema e recompensas enviadas ao reino.");
    if (!rows?.length) section.append($("p", "muted", "Sua caixa de entrada está vazia."));
    for (const mail of rows || []) {
      const card = $("article", "coi-meta-item");
      const title = $("div", "coi-meta-item-head");
      title.append($("strong", "", mail.subject), $("span", "coi-meta-tier", mail.is_read ? "Lida" : "Nova"));
      card.append(title, $("small", "muted", (mail.sender_name || "Sistema") + " · " + new Date(Number(mail.created_at || 0) * 1000).toLocaleString("pt-BR")));
      card.append($("p", "coi-meta-mail-body", mail.body));
      const buttons = $("div", "coi-meta-actions");
      if (!Number(mail.is_read)) buttons.append(actionButton("Marcar como lida", async () => {
        await runAction(async () => api("mail/read", { method: "POST", body: { mail_id: mail.id } }), "Mensagem marcada como lida.");
      }, false, true));
      if (mail.attachment && !Number(mail.is_claimed)) buttons.append(actionButton("Resgatar anexo", async () => {
        await runAction(async () => api("mail/claim", { method: "POST", body: { mail_id: mail.id } }), "Anexo resgatado.");
      }));
      else if (mail.attachment && Number(mail.is_claimed)) buttons.append($("span", "coi-meta-done", "✓ Anexo resgatado"));
      if (buttons.childNodes.length) card.append(buttons);
      section.append(card);
    }
    container.append(section);
  }

  function renderVip(container, vip) {
    const section = panel("👑 VIP", "Benefícios atuais do reino; a promoção de nível é controlada pelo servidor.");
    section.append($("div", "coi-meta-vip-level", "VIP " + fmt(vip?.vip_level)));
    section.append($("p", "muted", fmt(vip?.vip_exp) + " pontos VIP" + (vip?.vip_expires ? " · expira em " + new Date(Number(vip.vip_expires) * 1000).toLocaleDateString("pt-BR") : " · sem expiração registrada")));
    const benefits = vip?.benefits || {};
    const list = $("div", "coi-meta-benefits");
    const labels = [
      ["build_speed", "Construção"], ["train_speed", "Treinamento"],
      ["research_speed", "Pesquisa"], ["resource", "Produção"],
      ["march_speed", "Marcha"],
    ];
    for (const [key, label] of labels) {
      const percent = Math.round(Number(benefits[key] || 0) * 100);
      list.append($("span", "", label + ": +" + percent + "%"));
    }
    section.append(list);
    const gifts = Object.entries(benefits.daily_gift || {}).map(([key, value]) => fmt(value) + " " + key).join(" · ");
    if (gifts) section.append($("small", "muted", "Presente diário do nível: " + gifts));
    container.append(section);
  }

  function renderSpeedups(container, rows, state) {
    const section = panel("⏱️ Aceleradores", "Use itens armazenados em filas estratégicas ou marchas em andamento.");
    if (!rows?.length) {
      section.append($("p", "muted", "Você ainda não possui aceleradores. Ganhe-os em recompensas de tarefas e conquistas."));
      container.append(section);
      return;
    }
    const available = new Map();
    for (const item of rows) available.set(item.queue_type + ":" + item.duration_seconds, Number(item.quantity));
    const target = $("select", "coi-meta-input");
    const targets = [];
    for (const q of state?.queues || []) {
      if (q.status === "running") targets.push({ type: q.queue_type, id: q.id, label: "Fila · " + q.queue_type + " · " + q.target_key });
    }
    for (const march of state?.marches || []) {
      if (march.status === "marching") targets.push({ type: "march", id: march.id, label: "Marcha #" + march.id });
    }
    if (!targets.length) {
      section.append($("p", "muted", "Não há filas ou marchas em andamento para acelerar."));
      container.append(section);
      return;
    }
    const quantity = $("select", "coi-meta-input");
    const details = $("small", "muted", "");
    for (const item of targets) {
      const option = $("option", "", item.label);
      option.value = item.type + ":" + item.id;
      target.append(option);
    }
    function refreshDurations() {
      const type = String(target.value).split(":")[0];
      quantity.replaceChildren();
      for (const item of rows.filter(row => row.queue_type === type && Number(row.quantity) > 0)) {
        const option = $("option", "", fmt(item.quantity) + " × " + fmt(item.duration_seconds) + "s");
        option.value = String(item.duration_seconds);
        quantity.append(option);
      }
      details.textContent = quantity.options.length ? "Estoque disponível para o tipo selecionado." : "Sem aceleradores para esta atividade.";
    }
    target.addEventListener("change", refreshDurations);
    refreshDurations();
    const apply = actionButton("Aplicar acelerador", async () => {
      const [type, id] = String(target.value).split(":");
      await runAction(async () => api("speedups/use", {
        method: "POST",
        body: { queue_type: type, target_queue_id: Number(id), duration_seconds: Number(quantity.value) },
      }), "Acelerador aplicado.");
    });
    const form = $("div", "coi-meta-form");
    form.append($("label", "", "Fila ou marcha"), target, $("label", "", "Acelerador"), quantity, details, apply);
    quantity.addEventListener("change", () => { apply.disabled = !quantity.value; });
    apply.disabled = !quantity.value;
    section.append(form);
    container.append(section);
  }

  function renderFormations(container, rows, state) {
    const section = panel("🛡️ Formações de tropas", "Salve até cinco composições usando apenas tropas e heróis que pertencem a este reino.");
    const form = $("form", "coi-meta-form");
    const slot = $("select", "coi-meta-input");
    for (let i = 1; i <= 5; i++) {
      const option = $("option", "", "Slot " + i);
      option.value = String(i);
      slot.append(option);
    }
    const name = $("input", "coi-meta-input");
    name.maxLength = 32;
    name.value = "Formação 1";
    const hero = $("select", "coi-meta-input");
    const noHero = $("option", "", "Sem herói");
    noHero.value = "";
    hero.append(noHero);
    for (const item of state?.heroes || []) {
      const option = $("option", "", item.hero_name + " · Nv. " + item.level);
      option.value = String(item.id);
      hero.append(option);
    }
    const troops = $("textarea", "coi-meta-input");
    troops.rows = 5;
    const currentArmy = {};
    for (const row of state?.troops || []) {
      currentArmy[row.unit_type] = (currentArmy[row.unit_type] || 0) + Number(row.quantity || 0);
    }
    troops.value = JSON.stringify(Object.fromEntries(Object.entries(currentArmy).filter(([,qty]) => qty > 0)), null, 2);
    const activeLabel = $("label", "coi-meta-checkbox");
    const active = $("input");
    active.type = "checkbox";
    activeLabel.append(active, $("span", "", "Ativar esta formação ao salvar"));
    const save = $("button", "", "Salvar formação");
    save.type = "submit";
    const help = $("small", "muted", "Composição JSON por tipo de tropa. O servidor rejeita quantidades superiores ao exército disponível.");
    form.append($("label", "", "Slot"), slot, $("label", "", "Nome"), name,
      $("label", "", "Herói"), hero, $("label", "", "Tropas (JSON)"), troops, activeLabel, save, help);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      let troopData;
      try {
        troopData = JSON.parse(troops.value);
      } catch {
        setStatus("JSON de tropas inválido.", true);
        return;
      }
      await runAction(async () => api("formations/save", {
        method: "POST",
        body: {
          slot_number: Number(slot.value),
          formation_name: name.value,
          hero_id: hero.value || null,
          troop_data: troopData,
          is_active: active.checked,
        },
      }), "Formação salva.");
    });
    section.append(form);
    if (rows?.length) {
      const saved = $("div", "coi-meta-saved");
      for (const item of rows) {
        const line = $("div", "coi-meta-saved-row");
        const label = item.formation_name + " · slot " + item.slot_number + (item.is_active ? " · ATIVA" : "");
        line.append($("span", "", label), actionButton("Editar", () => {
          slot.value = String(item.slot_number);
          name.value = item.formation_name;
          troops.value = JSON.stringify(item.troop_data, null, 2);
          hero.value = item.hero_id == null ? "" : String(item.hero_id);
          active.checked = Boolean(item.is_active);
          form.scrollIntoView({ behavior: "smooth", block: "center" });
        }, false, true));
        saved.append(line);
      }
      section.append(saved);
    }
    container.append(section);
  }

  function renderRanking(container, rows) {
    const section = panel("🌍 Ranking global", "Os dez reinos mais poderosos.");
    if (!rows?.length) section.append($("p", "muted", "Ranking ainda indisponível."));
    const table = $("table", "coi-meta-ranking");
    const head = $("thead");
    const header = $("tr");
    for (const label of ["#", "Comandante / Reino", "Poder"]) header.append($("th", "", label));
    head.append(header);
    table.append(head);
    const body = $("tbody");
    for (const item of (rows || []).slice(0, 10)) {
      const tr = $("tr");
      tr.append($("td", "", item.power_rank + "º"));
      tr.append($("td", "", (item.commander || "Comandante") + " · " + item.kingdom_name));
      tr.append($("td", "", fmt(item.power)));
      body.append(tr);
    }
    table.append(body);
    if (rows?.length) section.append(table);
    container.append(section);
  }

  async function runAction(task, success) {
    if (busy) return;
    busy = true;
    setStatus("Processando...");
    try {
      await task();
      await refresh();
      window.dispatchEvent(new Event("coi:meta-reward-claimed"));
      setStatus(success || "Alteração salva.");
    } catch (error) {
      setStatus(error.message || "Não foi possível concluir a operação.", true);
    } finally {
      busy = false;
      const refreshButton = root?.querySelector(".coi-meta-header button");
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  function paint() {
    makeRoot();
    const grid = root.querySelector(".coi-meta-grid");
    grid.replaceChildren();
    renderTasks(grid, meta.tasks?.tasks || [], false);
    renderTasks(grid, meta.tasks?.tasks || [], true);
    renderAchievements(grid, meta.achievements?.achievements || []);
    renderMail(grid, meta.mail?.mail || []);
    renderVip(grid, meta.vip || {});
    renderSpeedups(grid, meta.speedups?.speedups || [], snapshot || {});
    renderFormations(grid, meta.formations?.formations || [], snapshot || {});
    renderRanking(grid, meta.ranking?.ranking || []);
  }

  async function refresh() {
    if (!token()) return;
    makeRoot();
    setStatus("Atualizando centro do comandante...");
    try {
      const [state, vip, tasks, achievements, mail, speedups, ranking, formations] = await Promise.all([
        gameState(),
        api("vip"),
        api("tasks"),
        api("achievements"),
        api("mail"),
        api("speedups"),
        api("ranking"),
        api("formations"),
      ]);
      snapshot = state;
      meta = { vip, tasks, achievements, mail, speedups, ranking, formations };
      paint();
      setStatus("Sistemas sincronizados.");
    } catch (error) {
      setStatus(error.message || "Falha ao sincronizar os sistemas.", true);
    }
  }

  window.addEventListener("coi:game-ready", () => { void refresh(); });
  if (!game.hidden && token()) void refresh();
  window.CoiKingdomMeta = Object.freeze({ refresh });
})();
