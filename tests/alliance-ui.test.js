import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("interface de alianças usa sessão persistida e estado real do Worker", async () => {
  const html = await readFile(new URL("../alliance.html", import.meta.url), "utf8");
  assert.match(html, /localStorage.getItem("coi_game_token")/);
  assert.match(html, /request("/game/state")/);
  assert.match(html, /state.alliance/);
  assert.match(html, /state.pendingInvites/);
  assert.match(html, /alliance_create/);
  assert.match(html, /alliance_join/);
  assert.match(html, /alliance_accept_invite/);
  assert.match(html, /alliance_chat/);
  assert.match(html, /alliance_donate/);
  assert.match(html, /alliance_war_declare/);
  assert.match(html, /alliance_leave/);
  assert.match(html, /esc\(m.message\)/);
});

test("central do reino oferece acesso à gestão de alianças", async () => {
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(html, /href="/alliance.html">🤝 Alianças/);
});

test("estado do reino entrega os saldos do depósito da aliança", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /a\.shared_food,a\.shared_wood,a\.shared_stone,a\.shared_iron,a\.shared_gold/);
});
