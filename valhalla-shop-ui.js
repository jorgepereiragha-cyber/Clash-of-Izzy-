(() => {
  "use strict";
  if (window.__COI_VALHALLA_SHOP_UI__) return;
  window.__COI_VALHALLA_SHOP_UI__ = true;

  const API = "/api/game/valhalla-shop";
  const CONFIG = "/api/config/valhalla";
  const categories = {
    troop_pack: { label: "Tropas lendárias", icon: "⚔️" },
    hero: { label: "Heróis divinos", icon: "👑" },
    buff: { label: "Bênçãos e buffs", icon: "✨" },
    cosmetic: { label: "Cosméticos exclusivos", icon: "🎨" },
    title: { label: "Títulos de Valhalla", icon: "🏆" },
  };
  const $ = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const format = value => Number(value || 0).toLocaleString("pt-BR");
  let active = false;
  let modal = null;
  let catalogRoot = null;
  let balanceNode = null;
  let noticeNode = null;
  let lastFocus = null;
  let selectedTab = "catalog";
  let busy = false;
  let pollHandle = null;

  function getToken() {
    // If one storage is blocked, the other may still contain the account token.
    let readable=false;
    for(const storage of [()=>window.localStorage,()=>window.sessionStorage]){
      try{const value=storage().getItem("coi_game_token");readable=true;if(value)return value;}catch{}
    }
    if(!readable)throw new Error("O navegador bloqueou o armazenamento da sessão. Reative o acesso para usar a Loja de Valhalla.");
    return "";
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível comunicar com a Loja de Valhalla.");
    return data;
  }

  function notify(message, kind = "success") {
    const toast = $("div", "va-shop-toast", message);
    toast.dataset.kind = kind;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function setNotice(message, kind = "info") {
    if (!noticeNode) return;
    noticeNode.textContent = message || "";
    noticeNode.dataset.kind = kind;
  }

  function createUI() {
    if (document.getElementById("valhalla-shop-btn")) return;
    const button = $("button", "");
    button.id = "valhalla-shop-btn";
    button.type = "button";
    button.hidden = true;
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "valhalla-shop-overlay");
    const rune = $("span", "va-rune", "⚡");
    rune.setAttribute("aria-hidden", "true");
    button.append(rune, $("span", "", "Loja de Valhalla"));
    button.addEventListener("click", openShop);
    document.body.append(button);

    const overlay = $("div", "");
    overlay.id = "valhalla-shop-overlay";
    overlay.setAttribute("aria-hidden", "true");
    const dialog = $("section", "");
    dialog.id = "valhalla-shop-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "valhalla-shop-title");

    const header = $("header", "va-shop-header");
    const brand = $("div", "va-shop-brand");
    brand.append($("h2", "", "⚡ Loja de Valhalla"));
    brand.firstChild.id = "valhalla-shop-title";
    brand.append($("p", "", "Troque Runas do Destino por recompensas da temporada"));
    const balance = $("div", "va-shop-balance");
    balance.append($("span", "", "⚡"));
    const balanceText = $("div", "");
    const balanceValue = $("strong", "", "0");
    balanceValue.id = "valhalla-shop-balance";
    balanceText.append(balanceValue, $("small", "", "Runas do Destino"));
    balance.append(balanceText);
    const close = $("button", "va-shop-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Fechar Loja de Valhalla");
    close.addEventListener("click", closeShop);
    header.append(brand, balance, close);

    const tabs = $("nav", "va-shop-tabs");
    tabs.setAttribute("aria-label", "Seções da loja");
    const catalogTab = $("button", "va-shop-tab", "Catálogo");
    catalogTab.type = "button";
    catalogTab.dataset.tab = "catalog";
    catalogTab.setAttribute("aria-selected", "true");
    catalogTab.addEventListener("click", () => switchTab("catalog"));
    const historyTab = $("button", "va-shop-tab", "Minhas compras");
    historyTab.type = "button";
    historyTab.dataset.tab = "history";
    historyTab.setAttribute("aria-selected", "false");
    historyTab.addEventListener("click", () => switchTab("history"));
    tabs.append(catalogTab, historyTab);

    const notice = $("div", "va-shop-notice");
    notice.id = "valhalla-shop-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    const body = $("div", "va-shop-body");
    const content = $("div", "");
    content.id = "valhalla-shop-content";
    body.append(content);
    dialog.append(header, tabs, notice, body);
    overlay.append(dialog);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeShop();
    });
    document.body.append(overlay);

    catalogRoot = content;
    balanceNode = balanceValue;
    noticeNode = notice;
    modal = overlay;
    document.addEventListener("keydown", handleKeydown);
  }

  function updateVisualMode(enabled) {
    active = Boolean(enabled);
    window.__COI_VALHALLA_ACTIVE = active;
    document.body.classList.toggle("valhalla-mode-active", active);
    const button = document.getElementById("valhalla-shop-btn");
    if (button) button.hidden = !active;
    window.dispatchEvent(new CustomEvent("coi:valhalla-mode", { detail: { active } }));
    if (window.__coiWorldMap3D?.setValhallaMode) window.__coiWorldMap3D.setValhallaMode(active);
    if (window.__coiKingdomValhallaMode) window.__coiKingdomValhallaMode(active);
  }

  async function checkModeStatus() {
    try {
      const response = await fetch(CONFIG, { cache: "no-store" });
      if (!response.ok) throw new Error("Configuração sazonal indisponível.");
      const config = await response.json();
      const wasActive = active;
      updateVisualMode(config.active === true);
      if (active && !wasActive) showWelcome();
      if (!active && modal?.classList.contains("is-open")) {
        setNotice("A temporada foi encerrada. A loja está temporariamente indisponível.");
      }
    } catch (error) {
      console.warn("[VALHALLA UI] Não foi possível atualizar o estado da temporada.", error);
      updateVisualMode(false);
    }
  }

  function showWelcome() {
    const key = "coi_valhalla_welcome_v1";
    try {
      if (sessionStorage.getItem(key) === "shown") return;
      sessionStorage.setItem(key, "shown");
    } catch {}
    notify("A Ascensão de Valhalla começou! A loja sazonal está aberta.", "success");
  }

  function openShop() {
    if (!active || !modal) return;
    lastFocus = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    switchTab("catalog");
    modal.querySelector(".va-shop-close")?.focus();
  }

  function closeShop() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function handleKeydown(event) {
    if (!modal?.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      closeShop();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll("button:not(:disabled)")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function switchTab(tab) {
    selectedTab = tab;
    for (const button of modal.querySelectorAll(".va-shop-tab")) {
      button.setAttribute("aria-selected", String(button.dataset.tab === tab));
    }
    if (tab === "catalog") void loadCatalog();
    else void loadHistory();
  }

  async function loadCatalog() {
    if (!active || busy) return;
    catalogRoot.replaceChildren($("div", "va-shop-loading", "Carregando ofertas de Valhalla…"));
    setNotice("");
    try {
      const data = await request(API + "/catalog");
      if (!data.active) {
        catalogRoot.replaceChildren($("div", "va-shop-empty", data.message || "A loja está indisponível."));
        return;
      }
      balanceNode.textContent = format(data.player_runes);
      renderCatalog(data.catalog || []);
    } catch (error) {
      catalogRoot.replaceChildren($("div", "va-shop-empty", error.message));
      setNotice(error.message, "error");
    }
  }

  function renderCatalog(items) {
    catalogRoot.replaceChildren();
    if (!items.length) {
      catalogRoot.append($("div", "va-shop-empty", "Nenhuma oferta disponível neste momento."));
      return;
    }
    for (const [key, category] of Object.entries(categories)) {
      const grouped = items.filter(item => item.category === key);
      if (!grouped.length) continue;
      const section = $("section", "va-shop-category");
      const heading = $("h3", "", category.icon + " " + category.label);
      const grid = $("div", "va-shop-grid");
      for (const item of grouped) grid.append(renderItem(item));
      section.append(heading, grid);
      catalogRoot.append(section);
    }
  }

  function renderItem(item) {
    const card = $("article", "va-shop-item");
    const featured = Number(item.is_featured) === 1;
    const remaining = Number(item.remaining_stock);
    const outOfStock = remaining === 0;
    if (featured) card.classList.add("is-featured");
    if (outOfStock) card.classList.add("is-unavailable");
    if (featured) card.append($("span", "va-shop-featured", "DESTAQUE"));
    const icon = ({ troop_pack: "⚔️", hero: "👑", buff: "✨", cosmetic: "🎨", title: "🏆" })[item.category] || "🎁";
    card.append($("div", "va-shop-icon", icon));
    card.append($("h4", "", item.name || "Oferta de Valhalla"));
    card.append($("p", "va-shop-description", item.description || "Recompensa sazonal exclusiva."));
    const stockText = remaining === -1 ? "Estoque ilimitado" :
      remaining === 0 ? "Esgotado" : format(remaining) + " restantes";
    card.append($("p", "va-shop-stock", stockText));
    card.append($("div", "va-shop-cost", "⚡ " + format(item.cost_runes)));
    const buy = $("button", "va-shop-buy", outOfStock ? "ESGOTADO" : "COMPRAR");
    buy.type = "button";
    buy.disabled = outOfStock || busy;
    buy.addEventListener("click", () => void buyItem(item, buy));
    card.append(buy);
    return card;
  }

  function makeRequestKey() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replaceAll("-", "");
    return "coi" + Date.now().toString(36) + Math.random().toString(36).slice(2, 18);
  }

  async function buyItem(item, button) {
    if (busy) return;
    if (!active) {
      setNotice("A temporada não está ativa.", "error");
      return;
    }
    if (!confirm("Comprar " + item.name + " por " + format(item.cost_runes) + " Runas do Destino?")) return;
    busy = true;
    button.disabled = true;
    button.textContent = "PROCESSANDO…";
    try {
      const requestKey = button.dataset.requestKey || makeRequestKey();
      button.dataset.requestKey = requestKey;
      const result = await request(API + "/buy", {
        method: "POST",
        body: { catalog_id: item.id, request_key: requestKey },
      });
      delete button.dataset.requestKey;
      balanceNode.textContent = format(result.new_runes_balance);
      notify(result.message || "Compra concluída.", "success");
      setNotice(result.replayed ? "Compra anterior reconhecida; nenhuma recompensa foi duplicada." : "Recompensa entregue ao seu reino.");
      busy = false;
      await loadCatalog();
    } catch (error) {
      setNotice(error.message, "error");
      notify(error.message, "error");
      button.disabled = false;
      button.textContent = "COMPRAR";
    } finally {
      busy = false;
    }
  }

  async function loadHistory() {
    catalogRoot.replaceChildren($("div", "va-shop-loading", "Carregando seu histórico…"));
    setNotice("");
    try {
      const data = await request(API + "/history");
      catalogRoot.replaceChildren();
      const history = data.history || [];
      if (!history.length) {
        catalogRoot.append($("div", "va-shop-empty", "Você ainda não fez compras nesta temporada."));
        return;
      }
      const list = $("div", "va-shop-history");
      for (const purchase of history) {
        const row = $("article", "va-shop-history-item");
        const info = $("div", "");
        info.append($("strong", "", purchase.name || purchase.catalog_id));
        const date = new Date(Number(purchase.purchased_at || 0) * 1000);
        const dateText = Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR") : "Data indisponível";
        info.append($("small", "", dateText + " · " + (categories[purchase.category]?.label || purchase.category)));
        row.append(info, $("div", "va-shop-history-cost", "⚡ " + format(purchase.cost_runes)));
        list.append(row);
      }
      catalogRoot.append(list);
    } catch (error) {
      catalogRoot.replaceChildren($("div", "va-shop-empty", error.message));
      setNotice(error.message, "error");
    }
  }

  function startPolling() {
    if (!pollHandle && !document.hidden) pollHandle = window.setInterval(() => {
      void checkModeStatus();
    }, 60000);
  }

  function stopPolling() {
    if (pollHandle) window.clearInterval(pollHandle);
    pollHandle = null;
  }

  function init() {
    createUI();
    void checkModeStatus();
    startPolling();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPolling();
    else {
      void checkModeStatus();
      startPolling();
    }
  });
  window.addEventListener("pagehide", stopPolling);
  window.addEventListener("pageshow", event => {
    if (event.persisted && !document.hidden) {
      void checkModeStatus();
      startPolling();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
