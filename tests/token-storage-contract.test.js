import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("account, kingdom and arena preserve coi_game_token in both browser storages", async () => {
  const [account, kingdom, arena] = await Promise.all([
    read("../account.html"),
    read("../kingdom.html"),
    read("../arena.html")
  ]);
  for (const [page, source] of [["account.html", account], ["kingdom.html", kingdom], ["arena.html", arena]]) {
    assert.match(source, /localStorage\.getItem\(["']coi_game_token["']\)/, page + " reads localStorage");
    assert.match(source, /sessionStorage\.getItem\(["']coi_game_token["']\)/, page + " reads sessionStorage");
    assert.match(source, /localStorage\.setItem\(["']coi_game_token["'],\s*(?:token|data\.token)\)/, page + " writes localStorage");
    assert.match(source, /sessionStorage\.setItem\(["']coi_game_token["'],\s*(?:token|data\.token)\)/, page + " writes sessionStorage");
  }
});

test("arena handles denied browser storage, preserves a single kingdom and exposes retry", async () => {
  const arena = await read("../arena.html");
  assert.match(arena, /function readArenaGameToken\(\)/);
  assert.match(arena, /if\(!readable\)throw new Error/);
  assert.match(arena, /let savedToken='';[\s\S]*?savedToken=readArenaGameToken\(\)/);
  assert.match(arena, /let arenaConnectionInProgress=false/);
  assert.match(arena, /if\(arenaConnectionInProgress\)return/);
  assert.match(arena, /retryArenaConnection/);
  assert.match(arena, /if\(savedToken\)\{[\s\S]*?retryArenaConnection/,"retry only when resuming an existing token");
  assert.match(arena, /if\(!savedToken\|\|error\.status===401\|\|error\.status===403\)/,"account recovery on guest failure");
  assert.match(arena, /if\(!savedToken\|\|error\.status===401\|\|error\.status===403\)/);
  assert.match(arena, /#kingdomStatus\{pointer-events:auto/, "HUD retry must receive clicks above the WebGL canvas");
  assert.match(arena, /account\.href='\/account\.html'/);
  assert.match(arena, /const persisted=!data\.token\|\|saveArenaGameToken\(data\.token\)/);
  assert.match(arena, /function chatToken\(\)\{try\{return readArenaGameToken\(\)\}catch\{return ''\}\}/);
});

test("account logout clears both copies of the game token", async () => {
  const source = await read("../account.html");
  assert.ok(source.includes("function clearAccountToken()"));
  assert.ok(source.includes('try{localStorage.removeItem("coi_game_token");}catch'));
  assert.ok(source.includes('try{sessionStorage.removeItem("coi_game_token");}catch'));
  assert.ok(source.includes("const locallyCleared=clearAccountToken()"));
});
