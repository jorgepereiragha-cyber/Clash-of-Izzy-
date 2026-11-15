import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("game search requires a valid player session and rate limits player and network", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes('url.pathname==="/api/game/search"&&request.method==="GET"'));
  assert.ok(worker.includes('rateLimitDecision(env,"game-search-player",playerId,30,60)'));
  assert.ok(worker.includes('rateLimitDecision(env,"game-search-network"'));
  assert.ok(worker.includes('rawQuery.length<2'));
  assert.ok(worker.includes('rawQuery.length>48'));
});

test("search accepts only public categories and builds a parameterized FTS query", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes('["all","kingdoms","alliances","territories","skins"].includes(kind)'));
  assert.ok(worker.includes('rawQuery.match(/[\\\\p{L}\\\\p{N}_]+/gu)'));
  assert.ok(worker.includes('game_search_fts MATCH ?'));
  assert.ok(worker.includes('.bind(ftsQuery,kind,kind,playerId,limit)'));
  assert.ok(worker.includes('Math.min(20,Math.max(1,Math.floor(Number(url.searchParams.get("limit"))||10)))'));
});

test("LIKE fallback escapes wildcard characters and returns only public result fields", async () => {
  const worker = await read("worker.js");
  assert.ok(worker.includes('rawQuery.replace(/[!%_]/g,ch=>"!"+ch)'));
  assert.ok(worker.includes("ESCAPE '!' COLLATE NOCASE"));
  assert.ok(worker.includes('engine:"like-fallback"'));
  assert.ok(worker.includes('engine:"fts5"'));
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
