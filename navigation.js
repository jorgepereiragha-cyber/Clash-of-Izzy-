/* Clash of Izzy — navegação compartilhada e busca local + online. */
(() => {
  "use strict";
  if (document.body?.classList.contains("landing-page")) return;
  if (window.__COI_NAV__) return;
  window.__COI_NAV__ = true;

  const links = [
    {label:"Início",href:"/index.html",icon:"⌂",keywords:"home início principal"},
    {label:"Meu reino",href:"/kingdom.html",icon:"🏰",keywords:"cidade castelo construções recursos edifícios reino"},
    {label:"Minha conta",href:"/account.html",icon:"👤",keywords:"login cadastro senha acesso persistente conta comandante"} ,
    {label:"Mapa mundial",href:"/world.html",icon:"🌍",keywords:"territórios exploração marchas mapa mundo"},
    {label:"Eventos",href:"/events.html",icon:"💀",keywords:"anjo da morte ceifador monstros chefes evento mundial fim de semana recompensas ranking"},
    {label:"Forja & skins",href:"/equipment-ui.html",icon:"⚒",keywords:"equipamentos heróis pesquisa evolução loja skins nórdicas odin thor freyja loki tyr heimdall"},
    {label:"Alianças",href:"/alliance.html",icon:"🤝",keywords:"aliança membros chat guerra diplomacia depósito"},
    {label:"Arena (modo secundário)",href:"/arena.html",icon:"⚔",keywords:"batalha combate arena ação individual treinamento"}
  ];

  const path = location.pathname.replace(/\/$/,"") || "/index.html";
  const root = document.createElement("nav");
  root.className = "coi-global-nav";
  root.setAttribute("aria-label","Navegação principal");
  root.innerHTML = '<a class="coi-nav-brand" href="/index.html" aria-label="Clash of Izzy — início"><span aria-hidden="true">⚔</span><b>CLASH OF IZZY</b></a><button class="coi-nav-toggle" type="button" aria-expanded="false" aria-controls="coi-nav-links">☰ <span>Menu</span></button><div class="coi-nav-links" id="coi-nav-links"></div><form class="coi-nav-search" role="search"><label class="coi-sr-only" for="coi-nav-query">Buscar seções e conteúdo do jogo</label><input id="coi-nav-query" type="search" autocomplete="off" placeholder="Buscar jogador, reino, aliança, território, skin…" aria-controls="coi-nav-results"><button type="submit" aria-label="Buscar no jogo">⌕</button><div class="coi-nav-results" id="coi-nav-results" role="listbox" aria-label="Resultados da busca" hidden></div></form>';

  const linksBox = root.querySelector(".coi-nav-links");
  for (const item of links) {
    const a = document.createElement("a");
    a.href = item.href;
    a.className = path === item.href ? "active" : "";
    if (path === item.href) a.setAttribute("aria-current","page");
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden","true");
    icon.textContent = item.icon;
    a.append(icon,document.createTextNode(" "+item.label));
    linksBox.append(a);
  }
  document.body.prepend(root);

  const toggle = root.querySelector(".coi-nav-toggle");
  const form = root.querySelector("form");
  const input = root.querySelector("input");
  const results = root.querySelector(".coi-nav-results");
  let searchTimer = 0;
  let requestController = null;
  let requestSequence = 0;
  const SEARCH_CACHE_TTL_MS = 10_000;
  const SEARCH_CACHE_MAX_ENTRIES = 24;
  const onlineSearchCache = new Map();
  let cacheSessionToken = "";

  toggle.addEventListener("click",() => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded",String(open));
    linksBox.classList.toggle("open",open);
  });

  function addGroupLabel(label) {
    const heading = document.createElement("div");
    heading.className = "coi-nav-group-label";
    heading.setAttribute("role","presentation");
    heading.textContent = label;
    results.append(heading);
  }

  function addEmpty(message) {
    const empty = document.createElement("p");
    empty.setAttribute("role","presentation");
    empty.textContent = message;
    results.append(empty);
  }

  function getGameToken() {
    try {
      return localStorage.getItem("coi_game_token") || sessionStorage.getItem("coi_game_token") || "";
    } catch {
      return "";
    }
  }

  const normalizeSearch = value => String(value||"").normalize("NFKD").replace(/[\p{M}]/gu,"").toLocaleLowerCase("pt-BR");
  const queryEligible = value => {
    const length=Array.from(String(value||"")).length;
    const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(String(value||""));
    return length>=(cjk?1:2);
  };
  function sectionResults(query) {
    const normalized = normalizeSearch(query);
    const found = links.filter(item => normalizeSearch(item.label+" "+item.keywords).includes(normalized));
    if (!found.length) return 0;
    addGroupLabel("Seções do jogo");
    for (const item of found) {
      const a = document.createElement("a");
      a.href = item.href;
      a.setAttribute("role","option");
      const strong = document.createElement("strong");
      strong.textContent = item.icon+" "+item.label;
      const small = document.createElement("small");
      small.textContent = item.href;
      a.append(strong,small);
      results.append(a);
    }
    return found.length;
  }

  function gameResultLink(item, query) {
    const type = item.type === "player" ? "players" :
      item.type === "kingdom" ? "kingdoms" :
      item.type === "alliance" ? "alliances" :
      item.type === "territory" ? "territories" : "skins";
    const params = new URLSearchParams({search:query,type});
    const a = document.createElement("a");
    a.href = "/alliance.html?"+params.toString();
    a.className = "coi-nav-online-result";
    a.setAttribute("role","option");
    const strong = document.createElement("strong");
    strong.textContent = item.type === "alliance" ? item.name+" ["+item.tag+"]" : item.name;
    const small = document.createElement("small");
    if (item.type === "player") small.textContent = "Jogador · "+(item.kingdom_name||"Reino")+" · Castelo "+Number(item.castle_level||1)+" · poder "+Number(item.power||0).toLocaleString("pt-BR")+(item.allianceTag?" · Aliança ["+item.allianceTag+"]":"");
    else if (item.type === "kingdom") small.textContent = "Reino · poder "+Number(item.power||0).toLocaleString("pt-BR")+(item.allianceTag?" · Aliança ["+item.allianceTag+"]":"");
    else if (item.type === "alliance") small.textContent = "Aliança · nível "+Number(item.level||1)+" · "+Number(item.members||0)+" membros";
    else if (item.type === "territory") small.textContent = "Território · "+(item.terrain||"terreno");
    else small.textContent = "Skin · catálogo cosmético";
    a.append(strong,small);
    return a;
  }

  function getCachedOnlineResults(query, token) {
    if (cacheSessionToken !== token) {
      onlineSearchCache.clear();
      cacheSessionToken = token;
    }
    const key = normalizeSearch(query);
    const entry = onlineSearchCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      onlineSearchCache.delete(key);
      return null;
    }
    // Refresh insertion order so the Map also acts as a small LRU cache.
    onlineSearchCache.delete(key);
    onlineSearchCache.set(key,entry);
    return entry.items;
  }

  function cacheOnlineResults(query, token, items) {
    if (cacheSessionToken !== token) {
      onlineSearchCache.clear();
      cacheSessionToken = token;
    }
    const key = normalizeSearch(query);
    onlineSearchCache.delete(key);
    onlineSearchCache.set(key,{expiresAt:Date.now()+SEARCH_CACHE_TTL_MS,items});
    while (onlineSearchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
      onlineSearchCache.delete(onlineSearchCache.keys().next().value);
    }
  }

  function renderOnlineResults(items, query) {
    if (items.length) {
      addGroupLabel("Conteúdo do mundo");
      for (const item of items) results.append(gameResultLink(item,query));
    } else if (!results.querySelector("a")) {
      addEmpty("Nenhuma seção ou conteúdo encontrado.");
    }
  }

  async function onlineResults(query, sequence) {
    if (!queryEligible(query) || sequence !== requestSequence) return;
    const token = getGameToken();
    if (!token) {
      if (cacheSessionToken) {
        onlineSearchCache.clear();
        cacheSessionToken = "";
      }
      if (sequence === requestSequence) addEmpty("Entre no reino para pesquisar conteúdo do mundo.");
      return;
    }
    const cachedResults = getCachedOnlineResults(query,token);
    if (cachedResults !== null) {
      if (sequence === requestSequence && query === input.value.trim()) renderOnlineResults(cachedResults,query);
      return;
    }
    requestController = new AbortController();
    results.setAttribute("aria-busy","true");
    try {
      const params = new URLSearchParams({q:query,type:"all",limit:"8"});
      const response = await fetch("/api/game/search?"+params.toString(),{
        headers:{Authorization:"Bearer "+token},
        signal:requestController.signal
      });
      const data = await response.json().catch(()=>({}));
      if (sequence !== requestSequence || query !== input.value.trim()) return;
      if (!response.ok) {
        if (response.status === 401) {
          onlineSearchCache.clear();
          cacheSessionToken = "";
          addEmpty("Sua sessão expirou. Entre novamente no reino para pesquisar.");
        } else if (response.status === 429) addEmpty("Muitas pesquisas em sequência. Aguarde alguns segundos.");
        else addEmpty(data.error || "A busca online não respondeu. Tente novamente.");
        return;
      }
      const items = Array.isArray(data.results) ? data.results : [];
      cacheOnlineResults(query,token,items);
      renderOnlineResults(items,query);
    } catch (error) {
      if (error?.name !== "AbortError" && sequence === requestSequence) addEmpty("Busca online indisponível. Tente novamente.");
    } finally {
      if (sequence === requestSequence) results.removeAttribute("aria-busy");
    }
  }

  function search() {
    const query = input.value.trim();
    results.replaceChildren();
    results.removeAttribute("aria-busy");
    results.hidden = !query;
    requestSequence += 1;
    const sequence = requestSequence;
    if (requestController) requestController.abort();
    clearTimeout(searchTimer);
    if (!query) return;
    const localCount = sectionResults(query);
    if (!queryEligible(query)) {
      if (!localCount) addEmpty("Digite pelo menos 2 caracteres.");
      return;
    }
    searchTimer = setTimeout(() => onlineResults(query,sequence),400);
  }

  input.addEventListener("input",search);
  form.addEventListener("submit",async event => {
    event.preventDefault();
    const query = input.value.trim();
    search();
    if (queryEligible(query)) {
      clearTimeout(searchTimer);
      const sequence = requestSequence;
      await onlineResults(query,sequence);
      results.hidden = false;
    }
  });
  input.addEventListener("keydown",event=>{
    if(event.key==="Escape"){results.hidden=true;input.blur();}
  });
  document.addEventListener("click",event => {
    if (!root.contains(event.target)) results.hidden = true;
  });
})();
