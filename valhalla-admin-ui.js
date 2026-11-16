(() => {
  "use strict";

  const root = document.getElementById("valhalla-admin-section");
  if (!root || window.__COI_VALHALLA_ADMIN__) return;
  window.__COI_VALHALLA_ADMIN__ = true;

  const $ = id => document.getElementById(id);
  const number = value => Number(value || 0).toLocaleString("pt-BR");
  let configDirty = false;
  let busy = false;

  function notice(message, error = false) {
    const element = $("valhalla-admin-notice");
    if (!element) return;
    element.textContent = message || "";
    element.style.color = error ? "#ffb4a9" : "#f5d58e";
  }

  function token() {
    return sessionStorage.getItem("coi_admin_token") || "";
  }

  async function api(path, options = {}) {
    const adminToken = token();
    if (!adminToken) throw new Error("Entre no Painel Master para controlar Valhalla.");
    const response = await fetch("/api/valhalla-admin/" + path, {
      method: options.method || "GET",
      headers: {
        Authorization: "Bearer " + adminToken,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        notice("Sua sessão Master expirou. Entre novamente.", true);
      }
      throw new Error(data.error || "Falha ao consultar o controle de Valhalla.");
    }
    return data;
  }

  function setButtonBusy(button, value, text) {
    if (!button) return;
    button.disabled = value;
    if (text !== undefined) button.textContent = text;
  }

  async function loadStatus() {
    const data = await api("status");
    const badge = $("valhalla-mode-badge");
    const toggle = $("btn-toggle-valhalla");
    const active = data.active === true;

    badge.textContent = active ? "ATIVO" : "INATIVO";
    badge.className = "va-badge " + (active ? "active" : "inactive");
    toggle.textContent = active ? "DESATIVAR MODO" : "ATIVAR MODO";
    toggle.classList.toggle("va-danger", active);
    $("valhalla-time-remaining").textContent = data.time_remaining_formatted || "N/A";
    $("valhalla-resource-mult").textContent = number(data.valhalla_resource_multiplier) + "x";
    $("valhalla-speed-mult").textContent = number(data.valhalla_speed_multiplier) + "x";
    $("valhalla-daily-runes").textContent = number(data.valhalla_daily_runes_reward);

    if (!configDirty) {
      $("input-resource-mult").value = data.valhalla_resource_multiplier;
      $("input-speed-mult").value = data.valhalla_speed_multiplier;
      $("input-daily-runes").value = data.valhalla_daily_runes_reward;
    }
    return data;
  }

  async function loadStats() {
    const data = await api("stats");
    $("stat-players-runes").textContent = number(data.players_with_runes);
    $("stat-total-runes").textContent = number(data.total_runes_distributed);
    $("stat-runes-circulation").textContent = number(data.total_runes_in_circulation);
    $("stat-purchases").textContent = number(data.total_purchases);
    $("stat-runes-spent").textContent = number(data.total_runes_spent);
    $("stat-ranked-players").textContent = number(data.ranked_players);
    $("stat-hunt-defeated").textContent = number(data.wild_hunt?.defeated);
    $("stat-hunt-escaped").textContent = number(data.wild_hunt?.escaped);

    const list = $("top-items-list");
    list.replaceChildren();
    for (const [index, item] of (data.top_items || []).entries()) {
      const li = document.createElement("li");
      const rank = document.createElement("span");
      rank.className = "va-rank";
      rank.textContent = "#" + (index + 1);
      const name = document.createElement("strong");
      name.textContent = item.name || item.id || "Item";
      const count = document.createElement("span");
      count.textContent = number(item.purchase_count) + " compras";
      li.append(rank, name, count);
      list.append(li);
    }
    if (!list.children.length) {
      const empty = document.createElement("li");
      empty.textContent = "Ainda não há compras registradas.";
      list.append(empty);
    }
  }

  async function loadLeaderboard() {
    const data = await api("leaderboard");
    const tbody = $("leaderboard-body");
    tbody.replaceChildren();
    for (const [index, player] of (data.leaderboard || []).entries()) {
      const tr = document.createElement("tr");
      const values = [
        String(index + 1),
        player.player_name || "Jogador",
        player.kingdom_name || "Reino",
        number(player.destiny_runes),
        number(player.runes_spent),
        number(player.purchase_count),
        number(player.valhalla_rank),
        player.valhalla_title || "—",
      ];
      for (const value of values) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      tbody.append(tr);
    }
    if (!tbody.children.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.textContent = "O ranking aparecerá quando houver runas ou atividade na temporada.";
      tr.append(td);
      tbody.append(tr);
    }
    $("leaderboard-total").textContent = number(data.total || 0);
  }

  async function refreshAll() {
    if (!token() || document.hidden || busy) return;
    try {
      await Promise.all([loadStatus(), loadStats(), loadLeaderboard()]);
      notice("Dados administrativos de Valhalla atualizados.");
    } catch (error) {
      notice(error.message, true);
    }
  }

  async function toggleMode() {
    if (busy) return;
    const active = $("valhalla-mode-badge").textContent === "ATIVO";
    const message = active
      ? "Desativar a Ascensão de Valhalla? A loja e os multiplicadores deixarão de funcionar."
      : "Ativar a Ascensão de Valhalla por 14 dias?";
    if (!confirm(message)) return;

    busy = true;
    const button = $("btn-toggle-valhalla");
    setButtonBusy(button, true, "PROCESSANDO…");
    try {
      const data = await api("toggle", {
        method: "POST",
        body: { action: active ? "deactivate" : "activate" },
      });
      notice(data.message || "Estado do evento atualizado.");
      await loadStatus();
      await loadStats();
    } catch (error) {
      notice(error.message, true);
    } finally {
      busy = false;
      setButtonBusy(button, false);
      await loadStatus().catch(() => {});
    }
  }

  async function updateConfig(event) {
    event.preventDefault();
    if (busy) return;
    const resource = Number($("input-resource-mult").value);
    const speed = Number($("input-speed-mult").value);
    const runes = Number($("input-daily-runes").value);
    if (!Number.isFinite(resource) || resource < 1 || resource > 20 ||
        !Number.isFinite(speed) || speed < 0.05 || speed > 1 ||
        !Number.isSafeInteger(runes) || runes < 1 || runes > 100000) {
      notice("Confira os limites: recursos 1–20x, velocidade 0,05–1 e runas inteiras 1–100.000.", true);
      return;
    }

    busy = true;
    const button = event.currentTarget.querySelector("button[type=submit]");
    setButtonBusy(button, true, "SALVANDO…");
    try {
      const data = await api("update-config", {
        method: "POST",
        body: {
          resource_multiplier: resource,
          speed_multiplier: speed,
          daily_runes_reward: runes,
        },
      });
      configDirty = false;
      notice(data.message || "Configurações salvas.");
      await loadStatus();
    } catch (error) {
      notice(error.message, true);
    } finally {
      busy = false;
      setButtonBusy(button, false, "SALVAR CONFIGURAÇÕES");
    }
  }

  async function distributeRunes(event) {
    event.preventDefault();
    if (busy) return;
    const playerId = $("input-player-id").value.trim();
    const amount = Number($("input-runes-amount").value);
    const reason = $("input-reason").value.trim();
    if (!playerId || !Number.isSafeInteger(amount) || amount < 1 || amount > 100000) {
      notice("Informe o player_id público e uma quantidade inteira entre 1 e 100.000.", true);
      return;
    }
    if (!confirm("Distribuir " + number(amount) + " Runas do Destino para este reino?")) return;

    // Keep the same key while retrying an uncertain request; the ledger prevents a double credit.
    const form = event.currentTarget;
    if (!form.dataset.requestKey) form.dataset.requestKey = crypto.randomUUID().replaceAll("-", "");
    const button = form.querySelector("button[type=submit]");
    busy = true;
    setButtonBusy(button, true, "DISTRIBUINDO…");
    try {
      const data = await api("distribute-runes", {
        method: "POST",
        body: {
          player_id: playerId,
          amount,
          reason,
          request_key: form.dataset.requestKey,
        },
      });
      notice(data.message || "Distribuição concluída. Saldo: " + number(data.new_balance) + ".");
      form.reset();
      delete form.dataset.requestKey;
      await Promise.all([loadStats(), loadLeaderboard()]);
    } catch (error) {
      notice(error.message, true);
    } finally {
      busy = false;
      setButtonBusy(button, false, "DISTRIBUIR RUNAS");
    }
  }

  $("btn-toggle-valhalla").addEventListener("click", toggleMode);
  $("btn-refresh-status").addEventListener("click", refreshAll);
  $("valhalla-config-form").addEventListener("input", () => { configDirty = true; });
  $("valhalla-config-form").addEventListener("submit", updateConfig);
  $("manual-distribute-form").addEventListener("submit", distributeRunes);

  document.addEventListener("coi:admin-session-ready", refreshAll);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshAll();
  });

  window.setInterval(() => {
    if (!document.hidden) refreshAll();
  }, 30000);

  if (token()) refreshAll();
})();
