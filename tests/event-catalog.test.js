import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EVENT_CATALOG, getEventPresentation } from "../event-catalog.js";

test("o catálogo mundial contém sete eventos únicos, incluindo Shiva e Khali", () => {
  assert.equal(EVENT_CATALOG.length, 7);
  assert.equal(new Set(EVENT_CATALOG.map(event => event.key)).size, 7);
  assert.ok(EVENT_CATALOG.some(event => event.name === "Shiva"));
  assert.ok(EVENT_CATALOG.some(event => event.name === "Khali"));
});

test("somente Anjo da Morte mostra recompensa já implementada como crédito real", () => {
  const previews = EVENT_CATALOG.filter(event => event.rewardMode === "preview");
  assert.equal(previews.length, 5);
  assert.ok(previews.every(event => !event.href));
  assert.equal(EVENT_CATALOG.find(event => event.key === "angel_of_death").rewardMode, "actual");
  assert.equal(EVENT_CATALOG.find(event => event.key === "valhalla").rewardMode, "conditional");
});

test("o status do Anjo da Morte acompanha o Worker, inclusive chefe derrotado", () => {
  const active = getEventPresentation({
    eventState: { event: { status: "active", boss_hp_remaining: 50 } }
  }).find(event => event.key === "angel_of_death");
  const defeated = getEventPresentation({
    eventState: { event: { status: "active", boss_hp_remaining: 0 } }
  }).find(event => event.key === "angel_of_death");
  const scheduled = getEventPresentation({
    eventState: { event: { status: "scheduled", boss_hp_remaining: 500 } }
  }).find(event => event.key === "angel_of_death");

  assert.equal(active.status.label, "Em andamento");
  assert.equal(defeated.status.label, "Chefe derrotado");
  assert.equal(scheduled.status.label, "Agendado");
});

test("Valhalla somente se apresenta como ativo quando a configuração do servidor confirma", () => {
  const inactive = getEventPresentation({ valhallaConfig: { active: false, dailyRunesReward: 100 } })
    .find(event => event.key === "valhalla");
  const active = getEventPresentation({ valhallaConfig: { active: true, dailyRunesReward: 125 } })
    .find(event => event.key === "valhalla");
  assert.equal(inactive.status.label, "Desativado no servidor");
  assert.equal(active.status.label, "Ativo no servidor");
  assert.match(active.rewardText, /125 Runas diárias/);
});

test("cada card tem arte SVG local, e nenhuma arte depende de recurso remoto", async () => {
  for (const event of EVENT_CATALOG) {
    const path = new URL(".." + event.image, import.meta.url);
    const svg = await readFile(path, "utf8");
    assert.match(svg, /<svg\b/);
    assert.match(svg, /<title\b/);
    assert.doesNotMatch(svg, /<script\b|(?:href|src)=["']https?:\/\//i);
  }
});

test("a página, CSS e Service Worker integram o hub na PWA", async () => {
  const [html, js, sw, navigation] = await Promise.all([
    readFile(new URL("../events.html", import.meta.url), "utf8"),
    readFile(new URL("../events.js", import.meta.url), "utf8"),
    readFile(new URL("../sw.js", import.meta.url), "utf8"),
    readFile(new URL("../navigation.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="worldEventGrid"/);
  assert.match(html, /href="\/styles\/events-hub\.css"/);
  assert.match(html, /id="angel-event"/);
  assert.match(js, /renderWorldEventCards/);
  assert.match(js, /loadValhallaEventConfig/);
  assert.match(sw, /clash-of-izzy-shell-v39/);
  assert.match(sw, /\/assets\/art\/events\/shiva\.svg/);
  assert.match(sw, /\/assets\/art\/events\/khali\.svg/);
  assert.match(navigation, /shiva khali/i);
});
