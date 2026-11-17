(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { type: "kingdoms", page: 1, pages: 0, busy: false };
  const number = value => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Number(value) || 0);
  const status = message => { $("rankingStatus").textContent = message; };

  function makeRow(item, type) {
    const article = document.createElement("article");
    article.className = "rank-row" + (item.rank <= 3 ? " top-rank" : "");
    const rank = document.createElement("div");
    rank.className = "rank-number";
    rank.textContent = "#" + item.rank;
    const copy = document.createElement("div");
    copy.className = "rank-copy";
    const heading = document.createElement("h2");
    const detail = document.createElement("p");
    const score = document.createElement("div");
    score.className = "rank-power";
    const value = document.createElement("strong");
    const label = document.createElement("span");
    if (type === "kingdoms") {
      heading.textContent = item.kingdom;
      detail.textContent = item.commander + " · Castelo nível " + item.castleLevel +
        (item.allianceTag ? " · Aliança [" + item.allianceTag + "]" : " · Sem aliança");
    } else {
      heading.textContent = item.name + (item.tag ? " [" + item.tag + "]" : "");
      detail.textContent = "Nível " + item.level + " · " + item.members + " membros · " + item.territories + " territórios";
    }
    value.textContent = number(item.power);
    label.textContent = "PODER";
    copy.append(heading, detail);
    score.append(value, label);
    article.append(rank, copy, score);
    return article;
  }

  function render(data) {
    const list = $("rankingList");
    list.replaceChildren();
    if (!data.results.length) {
      const empty = document.createElement("div");
      empty.className = "ranking-empty";
      empty.textContent = "Ainda não há dados suficientes para esta classificação.";
      list.append(empty);
    } else {
      for (const item of data.results) list.append(makeRow(item, data.type));
    }
    state.pages = data.pages;
    $("pageLabel").textContent = "Página " + data.page + " de " + Math.max(1, data.pages);
    $("previousPage").disabled = state.busy || data.page <= 1;
    $("nextPage").disabled = state.busy || data.page >= data.pages;
    document.querySelectorAll("[data-kind]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.kind === data.type));
      button.disabled = state.busy;
    });
    $("refreshRanking").disabled = state.busy;
  }

  async function load() {
    if (state.busy) return;
    state.busy = true;
    $("previousPage").disabled = true;
    $("nextPage").disabled = true;
    $("refreshRanking").disabled = true;
    document.querySelectorAll("[data-kind]").forEach(button => { button.disabled = true; });
    status("Sincronizando ranking com o servidor…");
    try {
      const params = new URLSearchParams({ type: state.type, page: String(state.page), limit: "25" });
      const response = await fetch("/api/leaderboard?" + params.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o ranking.");
      if (!Array.isArray(data.results)) throw new Error("Resposta de ranking inválida.");
      state.busy = false;
      render(data);
      status(data.total + (data.total === 1 ? " classificação encontrada." : " classificações encontradas."));
    } catch (error) {
      state.busy = false;
      $("previousPage").disabled = state.page <= 1;
      $("nextPage").disabled = true;
      $("refreshRanking").disabled = false;
      document.querySelectorAll("[data-kind]").forEach(button => { button.disabled = false; });
      status(error.message || "Falha ao carregar ranking.");
    }
  }

  document.querySelectorAll("[data-kind]").forEach(button => button.addEventListener("click", () => {
    if (state.busy || button.dataset.kind === state.type) return;
    state.type = button.dataset.kind;
    state.page = 1;
    load();
  }));
  $("previousPage").addEventListener("click", () => {
    if (state.busy || state.page <= 1) return;
    state.page -= 1;
    load();
  });
  $("nextPage").addEventListener("click", () => {
    if (state.busy || state.page >= state.pages) return;
    state.page += 1;
    load();
  });
  $("refreshRanking").addEventListener("click", load);
  load();
})();
