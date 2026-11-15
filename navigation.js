/* Clash of Izzy — navegação global única, acessível e sem dependências. */
(() => {
  "use strict";
  if (window.__COI_NAV__) return;
  window.__COI_NAV__ = true;
  const links = [
    {label:"Início",href:"/index.html",icon:"⌂",keywords:"home início"},
    {label:"Meu reino",href:"/kingdom.html",icon:"🏰",keywords:"cidade castelo construções recursos edifícios reino"},
    {label:"Arena 3D",href:"/arena.html",icon:"⚔",keywords:"batalha combate arena treinamento"},
    {label:"Alianças",href:"/alliance.html",icon:"🤝",keywords:"aliança membros chat guerra diplomacia"}
  ];
  const path = location.pathname.replace(/\/$/,"") || "/index.html";
  const root = document.createElement("nav");
  root.className = "coi-global-nav";
  root.setAttribute("aria-label","Navegação principal");
  root.innerHTML = '<a class="coi-nav-brand" href="/index.html" aria-label="Clash of Izzy — início"><span aria-hidden="true">⚔</span><b>CLASH OF IZZY</b></a><button class="coi-nav-toggle" type="button" aria-expanded="false" aria-controls="coi-nav-links">☰ <span>Menu</span></button><div class="coi-nav-links" id="coi-nav-links"></div><form class="coi-nav-search" role="search"><label class="coi-sr-only" for="coi-nav-query">Buscar no jogo</label><input id="coi-nav-query" type="search" autocomplete="off" placeholder="Buscar reino, arena, alianças…" aria-controls="coi-nav-results"><button type="submit" aria-label="Buscar">⌕</button><div class="coi-nav-results" id="coi-nav-results" role="listbox" hidden></div></form>';
  const linksBox = root.querySelector(".coi-nav-links");
  for (const item of links) {
    const a = document.createElement("a");
    a.href = item.href;
    a.className = path === item.href ? "active" : "";
    if (path === item.href) a.setAttribute("aria-current","page");
    a.innerHTML = '<span aria-hidden="true"></span>';
    a.querySelector("span").textContent = item.icon;
    a.append(document.createTextNode(" "+item.label));
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
    const q = input.value.trim().toLocaleLowerCase("pt-BR");
    results.replaceChildren();
    if (!q) { results.hidden = true; return; }
    const found = links.filter(x => (x.label+" "+x.keywords).toLocaleLowerCase("pt-BR").includes(q));
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
      empty.textContent = "Nenhuma área ativa encontrada. Confira os termos ou use o menu.";
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
