import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("shared navigation exposes the real game sections and a responsive search", async () => {
  const nav = await read("navigation.js");
  const css = await read("styles/navigation.css");
  for (const route of ["/index.html","/kingdom.html","/account.html","/world.html","/events.html","/equipment-ui.html","/arena.html","/alliance.html"]) assert.ok(nav.includes(route), "missing route " + route);
  assert.ok(nav.includes('setAttribute("aria-label","Navegação principal")'));
  assert.ok(nav.includes("toLocaleLowerCase"));
  assert.ok(nav.includes("strong.textContent"));
  assert.ok(nav.includes("small.textContent"));
  assert.ok(nav.includes("empty.textContent"));
  assert.ok(css.includes("@media(max-width:760px)"));
  assert.ok(css.includes("prefers-reduced-motion:reduce"));
});

test("core management pages load one shared navigation without duplicating their local menu links", async () => {
  for (const path of ["account.html","alliance.html","kingdom.html","world.html","admin.html","equipment-ui.html"]) {
    const html = await read(path);
    assert.ok(html.includes('/styles/navigation.css'), path + " must load shared navigation styles");
    assert.ok(html.includes('/navigation.js'), path + " must load shared navigation script");
  }
  const landing = await read("index.html");
  assert.ok(!landing.includes("/styles/navigation.css"));
  assert.ok(!landing.includes("/navigation.js"));
  for (const route of ["/world.html", "/alliance.html", "/arena.html", "/events.html"]) assert.ok(!landing.includes(`href="${route}"`));
  for (const anchor of ['href="#sobre"', 'href="#eventos"', 'href="#beta"', 'href="#convites"', 'href="#play-now"']) assert.ok(landing.includes(anchor));
  assert.ok(landing.includes('aria-label="Navegação da Landing"'));

  const kingdom = await read("kingdom.html");
  assert.ok(kingdom.includes('href="/alliance.html">🤝 Alianças') === false);
  assert.ok(kingdom.includes('href="/equipment-ui.html">⚒️ Equipamentos') === false);
});

test("shared navigation skips the landing page if accidentally loaded", async () => {
  const nav = await read("navigation.js");
  assert.ok(nav.includes('document.body?.classList.contains("landing-page")'));
});

test("navigation is a static section search, not an unsafe HTML search result renderer", async () => {
  const nav = await read("navigation.js");
  assert.ok(nav.includes("a.append(strong,small)"));
  assert.ok(nav.includes("results.replaceChildren()"));
  assert.ok(nav.includes("window.__COI_NAV__"));
  assert.ok(!nav.includes("results.innerHTML"));
});


test("shared navigation searches authenticated online game entities safely", async () => {
  const nav = await read("navigation.js");
  for (const snippet of [
    'fetch("/api/game/search?"',
    'Authorization:"Bearer "+token',
    'new AbortController()',
    'new URLSearchParams({q:query,type:"all",limit:"8"})',
    'coi-nav-online-result',
    '"/alliance.html?"'
  ]) assert.ok(nav.includes(snippet), "missing online search behavior: " + snippet);
  assert.ok(nav.includes("strong.textContent"));
  assert.ok(nav.includes("small.textContent"));
  assert.ok(!nav.includes("results.innerHTML"));
});

test("online search never creates a kingdom just to search", async () => {
  const nav = await read("navigation.js");
  assert.ok(nav.includes("if (!token)"));
  assert.ok(nav.includes('addEmpty("Entre no reino para pesquisar conteúdo do mundo.")'));
  assert.ok(!nav.includes("/api/game/start"));
  assert.ok(nav.includes("setTimeout(() => onlineResults(query,sequence),400)"));
});

test("alliance page handles navigation deep links and renders search results safely", async () => {
  const alliance = await read("alliance.html");
  assert.ok(alliance.includes('id="worldSearchForm"'));
  assert.ok(alliance.includes('request("/game/search?"+params.toString())'));
  assert.ok(alliance.includes("new URLSearchParams(location.search)"));
  assert.ok(alliance.includes("button.append(title,detail)"));
  assert.ok(alliance.includes("title.textContent"));
  assert.ok(alliance.includes("detail.textContent"));
  assert.ok(alliance.includes('if(!token){const loading=$("loading")')||alliance.includes('if(!token){$("worldSearchForm")'));
  assert.ok(!alliance.includes('request("/game/start"'));
});


test("global navigation keeps search results visible on submit and includes player destinations", async () => {
  const nav = await read("navigation.js");
  assert.ok(nav.includes('item.type === "player" ? "players"'));
  assert.ok(nav.includes('item.kingdom_name||"Reino"'));
  assert.ok(nav.includes('results.hidden = false'));
  assert.ok(!nav.includes("location.href = first.href"));
  assert.ok(nav.includes('event.key==="Escape"'));
});

test("global navigation exposes the Anjo da Morte weekend event", async () => {
  const nav = await read("navigation.js");
  assert.ok(nav.includes('href:"/events.html"'));
  assert.ok(nav.includes("anjo da morte"));
});


test("global navigation supports one-character CJK searches and accent-insensitive local sections", async () => {
  const nav = await read("navigation.js");
  assert.ok(nav.includes("const queryEligible = value"));
  assert.ok(nav.includes("Array.from(String(value||\"\")).length"));
  assert.ok(nav.includes("Script=Han"));
  assert.ok(nav.includes("normalizeSearch(item.label+\" \"+item.keywords).includes(normalized)"));
});


test("player results only offer invitations to kingdoms outside an alliance", async () => {
  const alliance = await read("alliance.html");
  const start=alliance.indexOf('if(item.type==="player"||item.type==="kingdom")');
  const end=alliance.indexOf('}else if(item.type==="alliance"){',start);
  assert.ok(start>=0&&end>start);
  const selection=alliance.slice(start,end);
  assert.ok(selection.includes("item.allianceTag"));
  assert.ok(selection.includes('$("inviteName").value=item.type==="player"?item.kingdom_name:item.name'));
  assert.ok(!selection.includes('location.href="/world.html?search="'));
  assert.ok(alliance.includes('location.href="/world.html?search="+encodeURIComponent(item.name)'));
  assert.ok(alliance.includes('location.href="/equipment-ui.html?search="+encodeURIComponent(item.name)'));
});

test("global navigation supports CJK codepoint queries and accent-insensitive local sections", async () => {
  const nav = await read("navigation.js");
  assert.ok(nav.includes("const queryEligible = value"));
  assert.ok(nav.includes("Array.from(String(value||\"\")).length"));
  assert.ok(nav.includes("Script=Han"));
  assert.ok(nav.includes("normalizeSearch(item.label+\" \"+item.keywords).includes(normalized)"));
});


test("alliance search inline script parses before deployment", async () => {
  const html = await read("alliance.html");
  const start = html.indexOf("<script>");
  const end = html.indexOf("</script>", start);
  assert.ok(start >= 0 && end > start, "alliance page must contain its application script");
  new vm.Script(html.slice(start + 8, end), { filename: "alliance.html:inline-script" });
});


test("skin results are highlighted in the equipment catalog after navigation", async () => {
  const equipment = await read("equipment-system.js");
  assert.ok(equipment.includes("requestedSkinSearch"));
  assert.ok(equipment.includes("searchFocusApplied"));
  assert.ok(equipment.includes("matches[0].scrollIntoView"));
  assert.ok(equipment.includes("normalizeSearch(card.textContent).includes(needle)"));
});
