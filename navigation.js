/* Clash of Izzy — navegação compartilhada e busca local + online. */
(() => {
  "use strict";
  if (window.__COI_NAV__) return;
  window.__COI_NAV__ = true;

  const links = [
    {label:"Início",href:"/index.html",icon:"⌂",keywords:"home início principal"},
    {label:"Meu reino",href:"/kingdom.html",icon:"🏰",keywords:"cidade castelo construções recursos edifícios reino"},
    {label:"Mapa mundial",href:"/world.html",icon:"🌍",keywords:"territórios exploração marchas mapa mundo"},
    {label:"Forja & skins",href:"/equipment-ui.html",icon:"⚒",keywords:"equipamentos heróis pesquisa evolução loja skins nórdicas odin thor freyja loki tyr heimdall"},
    {label:"Arena 3D",href:"/arena.html",icon:"⚔",keywords:"batalha combate arena treinamento"},
    {label:"Alianças",href:"/alliance.html",icon:"🤝",keywords:"aliança membros chat guerra diplomacia depósito"}
  ];

  const path = location.pathname.replace(/\/$/,"") || "/index.html";
  const root = document.createElement("nav");
  root.className = "coi-global-nav";
  root.setAttribute("aria-label","Navegação principal");
  root.innerHTML = '<a class="coi-nav-brand" href="/index.html" aria-label="Clash of Izzy — início"><span aria-hidden="true">⚔</span><b>CLASH OF IZZY</b></a><button class="coi-nav-toggle" type="button" aria-expanded="false" aria-controls="coi-nav-links">☰ <span>Menu</span></button><div class="coi-nav-links" id="coi-nav-links"></div><form class="coi-nav-search" role="search"><label class="coi-sr-only" for="coi-nav-query">Buscar seções e conteúdo do jogo</label><input id="coi-nav-query" type="search" autocomplete="off" placeholder="Buscar reino, aliança, mapa, skin…" aria-controls="coi-nav-results"><button type="submit" aria-label="Buscar no jogo">⌕</button><div class="coi-nav-results" id="coi-nav-results" role="listbox" aria-label="Resultados da busca" hidden></div></form>';

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

  function sectionResults(query) {
    const normalized = query.toLocaleLowerCase("pt-BR");
    const found = links.filter(item => (item.label+" "+item.keywords).toLocaleLowerCase("pt-BR").includes(normalized));
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
    const type = item.type === "kingdom" ? "kingdoms" :
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
    if (item.type === "kingdom") small.textContent = "Reino · poder "+Number(item.power||0).toLocaleString("pt-BR");
    else if (item.type === "alliance") small.textContent = "Aliança · nível "+Number(item.level||1)+" · "+Number(item.members||0)+" membros";
    else if (item.type === "territory") small.textContent = "Território · "+(item.terrain||"terreno");
    else small.textContent = "Skin · catálogo cosmético";
    a.append(strong,small);
    return a;
  }

  async function onlineResults(query, sequence) {
    if (query.length < 2 || sequence !== requestSequence) return;
    const token = getGameToken();
    if (!token) {
      if (sequence === requestSequence) addEmpty("Entre no reino para pesquisar conteúdo do mundo.");
      return;
    }
    requestController = new AbortController();
    results.setAttribute("aria-busy","true");
    try {
      const params = new URLSearchParams({q:query,type:"all",limit:"8"});
      const headers = {Authorization:"Bearer "+token};
      const requests = [
        fetch("/api/game/search?"+params.toString(),{headers,signal:requestController.signal})
      ];
      const nicknameQuery = query.normalize("NFKC").trim();
      const canSearchPlayers = /^[\p{L}\p{N}_-]{3,20}$/u.test(nicknameQuery);
      if (canSearchPlayers) {
        const playerParams = new URLSearchParams({q:nicknameQuery,limit:"6"});
        requests.push(fetch("/api/game/players/search?"+playerParams.toString(),{headers,signal:requestController.signal}));
      }
      const responses = await Promise.all(requests);
      const data = await responses[0].json().catch(()=>({}));
      const playerData = responses[1] ? await responses[1].json().catch(()=>({})) : {};
      if (sequence !== requestSequence || query !== input.value.trim()) return;
      if (!responses[0].ok) {
        if (responses[0].status === 401) addEmpty("Entre novamente no reino para pesquisar conteúdo.");
        return;
      }
      let resultCount = 0;
      if (data.results?.length) {
        addGroupLabel("Conteúdo do mundo");
        for (const item of data.results) {
          results.append(gameResultLink(item,query));
          resultCount += 1;
        }
      }
      if (responses[1]?.ok && playerData.players?.length) {
        addGroupLabel("Jogadores");
        for (const player of playerData.players) {
          const a = document.createElement("a");
          const playerParams = new URLSearchParams({playerSearch:player.nickname});
          a.href = "/kingdom.html?"+playerParams.toString();
          a.className = "coi-nav-online-result";
          a.setAttribute("role","option");
          const strong = document.createElement("strong");
          strong.textContent = player.nickname+" · "+player.kingdom_name;
          const small = document.createElement("small");
          small.textContent = "Jogador · Castelo nível "+Number(player.castle_level||1)+" · Poder "+Number(player.power||0).toLocaleString("pt-BR");
          a.append(strong,small);
          results.append(a);
          resultCount += 1;
        }
      }
      if (!resultCount && !results.querySelector("a")) addEmpty("Nenhuma seção ou conteúdo encontrado.");
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
    if (query.length < 2) {
      if (!localCount) addEmpty("Digite pelo menos 2 caracteres.");
      return;
    }
    searchTimer = setTimeout(() => onlineResults(query,sequence),250);
  }

  input.addEventListener("input",search);
  form.addEventListener("submit",async event => {
    event.preventDefault();
    const query = input.value.trim();
    search();
    if (query.length >= 2) {
      clearTimeout(searchTimer);
      const sequence = requestSequence;
      await onlineResults(query,sequence);
    }
    const first = results.querySelector(".coi-nav-online-result") || results.querySelector("a");
    if (first) location.href = first.href;
  });
  document.addEventListener("click",event => {
    if (!root.contains(event.target)) results.hidden = true;
  });
})();
