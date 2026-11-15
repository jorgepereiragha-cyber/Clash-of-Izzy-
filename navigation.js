/* Clash of Izzy — navegação compartilhada e busca de seções. */
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
  root.innerHTML = '<a class="coi-nav-brand" href="/index.html" aria-label="Clash of Izzy — início"><span aria-hidden="true">⚔</span><b>CLASH OF IZZY</b></a><button class="coi-nav-toggle" type="button" aria-expanded="false" aria-controls="coi-nav-links">☰ <span>Menu</span></button><div class="coi-nav-links" id="coi-nav-links"></div><form class="coi-nav-search" role="search"><label class="coi-sr-only" for="coi-nav-query">Buscar seção do jogo</label><input id="coi-nav-query" type="search" autocomplete="off" placeholder="Buscar reino, mapa, forja…" aria-controls="coi-nav-results"><button type="submit" aria-label="Buscar seção">⌕</button><div class="coi-nav-results" id="coi-nav-results" role="listbox" hidden></div></form>';
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
  toggle.addEventListener("click",() => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded",String(open));
    linksBox.classList.toggle("open",open);
  });
  const form = root.querySelector("form");
  const input = root.querySelector("input");
  const results = root.querySelector(".coi-nav-results");
  function search() {
    const query = input.value.trim().toLocaleLowerCase("pt-BR");
    results.replaceChildren();
    if (!query) { results.hidden = true; return; }
    const found = links.filter(item => (item.label+" "+item.keywords).toLocaleLowerCase("pt-BR").includes(query));
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
    if (!found.length) {
      const empty = document.createElement("p");
      empty.textContent = "Nenhuma seção encontrada. Tente reino, mapa, forja, arena ou alianças.";
      results.append(empty);
    }
    results.hidden = false;
  }
  input.addEventListener("input",search);
  form.addEventListener("submit",event => {
    event.preventDefault();
    search();
    const first = results.querySelector("a");
    if (first) location.href = first.href;
  });
  document.addEventListener("click",event => {
    if (!root.contains(event.target)) results.hidden = true;
  });
})();
