import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("shared navigation exposes the real game sections and a responsive search", async () => {
  const nav = await read("navigation.js");
  const css = await read("styles/navigation.css");
  for (const route of ["/index.html","/kingdom.html","/world.html","/equipment-ui.html","/arena.html","/alliance.html"]) assert.ok(nav.includes(route), "missing route " + route);
  assert.ok(nav.includes('setAttribute("aria-label","Navegação principal")'));
  assert.ok(nav.includes("toLocaleLowerCase"));
  assert.ok(nav.includes("strong.textContent"));
  assert.ok(nav.includes("small.textContent"));
  assert.ok(nav.includes("empty.textContent"));
  assert.ok(css.includes("@media(max-width:760px)"));
  assert.ok(css.includes("prefers-reduced-motion:reduce"));
});

test("core management pages load one shared navigation without duplicating their local menu links", async () => {
  for (const path of ["alliance.html","kingdom.html","world.html","admin.html","equipment-ui.html"]) {
    const html = await read(path);
    assert.ok(html.includes('/styles/navigation.css'), path + " must load shared navigation styles");
    assert.ok(html.includes('/navigation.js'), path + " must load shared navigation script");
  }
  const kingdom = await read("kingdom.html");
  assert.ok(kingdom.includes('href="/alliance.html">🤝 Alianças') === false);
  assert.ok(kingdom.includes('href="/equipment-ui.html">⚒️ Equipamentos') === false);
});

test("navigation is a static section search, not an unsafe HTML search result renderer", async () => {
  const nav = await read("navigation.js");
  assert.ok(nav.includes("a.append(strong,small)"));
  assert.ok(nav.includes("results.replaceChildren()"));
  assert.ok(nav.includes("window.__COI_NAV__"));
  assert.ok(!nav.includes("results.innerHTML"));
});
