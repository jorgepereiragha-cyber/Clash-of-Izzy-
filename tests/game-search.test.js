import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("game search requires a valid player session and rate limits player and network", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes('url.pathname==="/api/game/search"&&request.method==="GET"'));
  assert.ok(worker.includes('rateLimitDecision(env,"game-search-player",playerId,30,60)'));
  assert.ok(worker.includes('rateLimitDecision(env,"game-search-network"'));
  assert.ok(worker.includes('queryLength<2'));
  assert.ok(worker.includes('queryLength>48'));
});

test("search accepts only public categories and builds a parameterized FTS query", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes('["all","players","kingdoms","alliances","territories","skins"].includes(kind)'));
  assert.ok(worker.includes("rawQuery.match"));
  assert.ok(worker.includes("\\p{L}"));
  assert.ok(worker.includes('game_search_fts MATCH ?'));
  assert.ok(worker.includes('entityType=({kingdoms:"kingdom",alliances:"alliance",territories:"territory",skins:"skin"})[kind]||""'));
  assert.ok(worker.includes('.bind(ftsQuery,kind,entityType,playerId,limit*4)'));
  assert.ok(worker.includes('Math.min(20,Math.max(1,Math.floor(Number(url.searchParams.get("limit"))||10)))'));
});

test("LIKE fallback escapes wildcard characters and returns only public result fields", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes('toLocaleLowerCase("en-US").replace(/[!%_]/g,ch=>"!"+ch)'));
  assert.ok(worker.includes("ESCAPE '!' COLLATE NOCASE"));
  assert.ok(worker.includes('engine:usedFts?"fts5+trigram":"like-fallback"'));
  assert.ok(worker.includes('game_search_fts MATCH ?'));
  assert.ok(!worker.includes("player_email"));
  assert.ok(!worker.includes("password_hash"));
});

test("FTS5 migration indexes the four public categories and maintains its index with triggers", async () => {
  const migration = await read("migrations/0012_game_search.sql");
  assert.ok(migration.includes("CREATE VIRTUAL TABLE IF NOT EXISTS game_search_fts USING fts5"));
  assert.ok(migration.includes("unicode61 remove_diacritics 2"));
  for (const table of ["kingdoms","alliances","world_territories","skins"]) assert.ok(migration.includes("FROM "+table));
  assert.ok(migration.includes("game_search_documents_ai"));
  assert.ok(migration.includes("game_search_documents_au"));
  assert.ok(migration.includes("game_search_documents_ad"));
  assert.ok(migration.includes("game_search_fts(game_search_fts) VALUES('rebuild')"));
});


test("player discovery uses a unique normalized nickname and never exposes private account data", async () => {
  const worker = await read("worker.js");
  const migration = await read("migrations/0013_player_nicknames.sql");
  assert.ok(migration.includes("nickname_key TEXT NOT NULL UNIQUE"));
  assert.ok(migration.includes("REFERENCES players(id) ON DELETE CASCADE"));
  assert.ok(worker.includes('type==="set_nickname"'));
  assert.ok(worker.includes('ON CONFLICT(player_id) DO UPDATE SET nickname=excluded.nickname,nickname_key=excluded.nickname_key'));
  assert.ok(worker.includes('url.pathname==="/api/game/players/search"&&request.method==="GET"'));
  assert.ok(worker.includes('rateLimitDecision(env,"player-search-player"'));
  assert.ok(worker.includes('rateLimitDecision(env,"player-search-network"'));
  assert.ok(worker.includes('n.player_id<>(SELECT id FROM players WHERE player_id=?)'));
  assert.ok(worker.includes("nickname:row.nickname,kingdom_name:row.kingdom_name,castle_level:Number(row.castle_level||1),power:Number(row.power||0)"));
  assert.ok(!worker.includes("email:row.email"));
});

test("player discovery UI renders server data as text and uses the authenticated game adapter", async () => {
  const kingdom = await read("kingdom.html");
  assert.ok(kingdom.includes('request("/game/players/search?q="+encodeURIComponent(query))'));
  assert.ok(kingdom.includes('title.textContent=player.nickname'));
  assert.ok(kingdom.includes('details.textContent="Castelo nível "+player.castle_level'));
  assert.ok(!kingdom.includes('row.innerHTML=player.nickname'));
});


test("global search includes public player nicknames and merges prefix and substring FTS results", async () => {
  const worker = await read("worker.js");
  const migration = await read("migrations/0014_search_quality_angel_death.sql");
  assert.ok(worker.includes('"all","players","kingdoms","alliances","territories","skins"'));
  assert.ok(worker.includes('game_player_search_fts MATCH ?'));
  assert.ok(worker.includes('game_player_substring_fts MATCH ?'));
  assert.ok(worker.includes('game_search_substring_fts MATCH ?'));
  assert.ok(worker.includes('type:"player"'));
  assert.ok(migration.includes("tokenize='trigram remove_diacritics 1'"));
  assert.ok(migration.includes("game_player_search_ai"));
  assert.ok(migration.includes("game_player_search_au"));
  assert.ok(migration.includes("game_player_search_ad"));
  assert.ok(!worker.includes("player_id:row.player_id"));
});

test("search merges ranked matches and never exposes internal identifiers", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("resultMap=new Map()"));
  assert.ok(worker.includes("candidate===queryKey?0:candidate.startsWith(queryKey)?1:candidate.includes(queryKey)?2:3"));
  assert.ok(worker.includes('engine:usedFts?"fts5+trigram":"like-fallback"'));
  assert.ok(worker.includes("limit*4"));
  assert.ok(!worker.includes("player_email"));
  assert.ok(!worker.includes("password_hash"));
});


test("short CJK queries use bounded LIKE fallback even when FTS prefix already returned a result", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes("const queryLength=Array.from(rawQuery).length"));
  assert.ok(worker.includes("if(queryLength<2)"));
  assert.ok(worker.includes("if(queryLength>48)"));
  assert.ok(worker.includes("if(queryLength>=3)"));
  assert.ok(!worker.includes("rawQuery.length>=3"));
  assert.ok(worker.includes("needsShortUnicodeFallback=queryLength<3&&containsCjk"));
  assert.ok(worker.includes("Script=Hangul"));
  assert.ok(worker.includes("queryLength<(containsCjk?1:2)"));
  assert.ok(worker.includes("Script=Han"));
  assert.ok(worker.includes("Script=Hiragana"));
  assert.ok(worker.includes("Script=Katakana"));
  assert.ok(worker.includes("!entitySubstringAvailable||needsShortUnicodeFallback"));
  assert.ok(worker.includes("!playerSubstringAvailable||needsShortUnicodeFallback"));
  assert.ok(worker.includes("if((kind===\"all\"||kind===\"kingdoms\")"));
  assert.ok(worker.includes("if(!hasPlayers||!playerSubstringAvailable||needsShortUnicodeFallback)"));
  assert.ok(worker.includes("const pattern=\"%\"+escaped+\"%\""));
  assert.ok(worker.includes("nickname_key LIKE ? ESCAPE '!'"));
});
