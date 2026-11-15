import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("interface de alianças usa sessão persistida e estado real do Worker", async () => {
  const html = await readFile(new URL("../alliance.html", import.meta.url), "utf8");
  for (const snippet of [
    'localStorage.getItem("coi_game_token")',
    'request("/game/state")',
    "state.alliance",
    "state.pendingInvites",
    "alliance_create",
    "alliance_join",
    "alliance_accept_invite",
    "alliance_chat",
    "alliance_donate",
    "alliance_war_declare",
    "alliance_leave",
    "esc(m.message)"
  ]) assert.ok(html.includes(snippet), `interface de alianças deve conter: ${snippet}`);
});

test("central do reino oferece acesso à gestão de alianças", async () => {
  const nav = await readFile(new URL("../navigation.js", import.meta.url), "utf8");
  assert.ok(nav.includes('href:"/alliance.html"'));
});

test("estado do reino entrega os saldos do depósito da aliança", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(worker.includes("a.shared_food,a.shared_wood,a.shared_stone,a.shared_iron,a.shared_gold"));
});

test("entrada por sigla respeita o limite de membros da aliança", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(worker.includes("INSERT INTO alliance_members(alliance_id,kingdom_id,role) SELECT ?,?,'member' WHERE (SELECT COUNT(*) FROM alliance_members WHERE alliance_id=?) < ?"));
  assert.ok(worker.includes("A aliança atingiu o limite de membros."));
});


test("central de alianças oferece busca pública e aceita deep links da navegação global", async () => {
  const html = await readFile(new URL("../alliance.html", import.meta.url), "utf8");
  for (const snippet of [
    'id="worldSearchForm"',
    '<option value="territories">Territórios</option>',
    '<option value="skins">Skins</option>',
    'aria-live="polite"',
    'new URLSearchParams(location.search)',
    'initialSearch.get("search")',
    '$("worldSearchForm").requestSubmit()',
    'item.type==="territory"',
    'item.type==="skin"'
  ]) assert.ok(html.includes(snippet), "busca da central de alianças deve conter: " + snippet);
});
