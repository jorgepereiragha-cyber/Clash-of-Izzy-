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
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.ok(html.includes('href="/alliance.html">🤝 Alianças'));
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


test("busca mundial autentica, limita consultas e retorna somente dados públicos", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  for (const snippet of [
    'url.pathname==="/api/game/search"&&request.method==="GET"',
    '"game-search-player",playerId,30,60',
    '"game-search-network"',
    'rawQuery.length<2',
    'rawQuery.length>48',
    '["all","kingdoms","alliances","territories","skins"]',
    'NOT EXISTS (SELECT 1 FROM alliance_members am WHERE am.kingdom_id=CAST(d.entity_key AS INTEGER))',
    'JOIN players p ON p.id=k.player_id WHERE p.player_id=?',
    'COUNT(*) FROM alliance_members WHERE alliance_id=CAST(d.entity_key AS INTEGER)'
  ]) assert.ok(worker.includes(snippet), `busca mundial deve conter: ${snippet}`);
  assert.ok(!worker.includes('results.push({type:"kingdom",id:row.id'));
  assert.ok(!worker.includes('results.push({type:"alliance",id:row.id'));
});

test("índice FTS5 mantém catálogo público sincronizado sem indexar dados privados", async () => {
  const migration = await readFile(new URL("../migrations/0011_game_search.sql", import.meta.url), "utf8");
  for (const snippet of [
    "CREATE VIRTUAL TABLE IF NOT EXISTS game_search_fts USING fts5",
    "unicode61 remove_diacritics 2",
    "content='game_search_documents'",
    "game_search_kingdom_ai",
    "game_search_alliance_ai",
    "game_search_territory_ai",
    "game_search_skin_ai",
    "substr(description,1,120)",
    "coalesce(resource_type,'')",
    "INSERT OR IGNORE INTO game_search_documents"
  ]) assert.ok(migration.includes(snippet), `índice de busca deve conter: ${snippet}`);
  assert.doesNotMatch(migration, /inventory_items|resource_ledger|hero_inventory|player_skins/);
});

test("busca unificada usa FTS5 com ranking e fallback compatível", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  for (const snippet of [
    'game_search_fts MATCH ?',
    "ORDER BY f.rank LIMIT ?",
    'engine:"fts5"',
    'engine:"like-fallback"',
    'd.entity_type=?)',
    'world_territories WHERE (name LIKE',
    'FROM skins WHERE name LIKE'
  ]) assert.ok(worker.includes(snippet), `busca unificada deve conter: ${snippet}`);
});

test("central de alianças apresenta filtros para todas as categorias públicas", async () => {
  const html = await readFile(new URL("../alliance.html", import.meta.url), "utf8");
  for (const snippet of [
    'id="worldSearchForm"',
    '<option value="territories">Territórios</option>',
    '<option value="skins">Skins</option>',
    'aria-live="polite"',
    'item.type==="territory"',
    'item.type==="skin"'
  ]) assert.ok(html.includes(snippet), `filtro de busca deve conter: ${snippet}`);
  const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.ok(kingdom.includes('href="/alliance.html#globalSearchTitle">🔎 Busca mundial'));
});
