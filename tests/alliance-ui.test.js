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

test("reconexão de alianças mostra ação de retry e link de conta sem apagar o token", async () => {
  const html = await readFile(new URL("../alliance.html", import.meta.url), "utf8");
  assert.ok(html.includes('error.status=res.status'), "preserve HTTP status for session recovery");
  assert.ok(html.includes('retryAllianceConnection'), "retry button available after API errors");
  assert.ok(html.includes('const synchronized=await load(false);if(synchronized)status("Aliança sincronizada.");'), "do not show success after failed state refresh");
  assert.ok(html.includes('status("● Conectado ao reino");return true;'));
  assert.ok(html.includes('retry.addEventListener("click",()=>{retry.disabled=true;void load(false)})'));
  assert.ok(html.includes('if(e.status===401||e.status===403)'), "account link only for authentication errors");
  assert.ok(html.includes('link.href="/account.html"'));
  assert.ok(html.includes('loading.classList.remove("hidden")'));
  assert.ok(!html.includes('localStorage.removeItem("coi_game_token")'));
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

test("chat da arena usa feed autenticado compacto em vez de consultar o estado inteiro do reino", async () => {
  const arena = await readFile(new URL("../arena.html", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const refreshStart = arena.indexOf("async function refreshAllianceChat");
  const refreshEnd = arena.indexOf("document.getElementById('openChat')", refreshStart);
  const refresh = arena.slice(refreshStart, refreshEnd);

  assert.ok(arena.includes("function chatToken(){try{return readArenaGameToken()}catch{return ''}}"),
    "arena chat must use the guarded token reader instead of direct storage access");
  assert.ok(refresh.includes("chatApi('/game/alliance/chat')"));
  assert.ok(refresh.includes("chat:data.chat||[]"));
  assert.ok(!refresh.includes("chatApi('/game/state')"));
  assert.ok(arena.includes("setInterval(refreshAllianceChat,15000)"));
  assert.ok(worker.includes('url.pathname==="/api/game/alliance/chat"'));
  assert.ok(worker.includes("LEFT JOIN alliance_chat c ON c.alliance_id=a.id"));
  assert.ok(worker.includes('rateLimitDecision(env,"alliance-chat-read-player",playerId,60,60)'));
});
