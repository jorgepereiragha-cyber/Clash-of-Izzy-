import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("entrada principal prioriza o reino e preserva a arena como modo secundário", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /href="\.\/kingdom\.html">ENTRAR NO REINO/);
  assert.match(html, /href="\.\/arena\.html"/);
});

test("central do reino consome estado e melhorias pela API autenticada", async () => {
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(html, /request\("\/game\/state"\)/);
  assert.match(html, /type:"upgrade",building/);
  assert.match(html, /localStorage\.getItem\("coi_game_token"\)/);
  assert.match(html, /Seu acesso salvo foi preservado/);
  assert.match(html, /state\.recentEvents/);
  assert.match(html, /state\.territories/);
  assert.match(html, /state\.alliance/);
  assert.doesNotMatch(html, /localStorage\.removeItem\("coi_game_token"\)/);
});
