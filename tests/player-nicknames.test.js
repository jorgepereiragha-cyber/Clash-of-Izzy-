import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("migration cria nickname único vinculado ao jogador", async () => {
  const sql = await readFile(new URL("../migrations/0008_player_nicknames.sql", import.meta.url), "utf8");
  assert.match(sql, /player_id INTEGER PRIMARY KEY REFERENCES players\(id\) ON DELETE CASCADE/);
  assert.match(sql, /nickname_key TEXT NOT NULL UNIQUE/);
  assert.match(sql, /CHECK \(length\(nickname\) BETWEEN 3 AND 20\)/);
});

test("Worker exige sessão de jogador antes de permitir busca global", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  const route = worker.indexOf('if(url.pathname==="/api/game/players/search"');
  const auth = worker.lastIndexOf('const playerId=await gameIdentity(request,env);', route);
  assert.notEqual(route, -1);
  assert.notEqual(auth, -1);
  assert.ok(auth < route, "a autenticação deve ocorrer antes da rota de pesquisa");
  assert.match(worker, /p\.scope==="game"/);
});

test("Worker valida e normaliza nickname e trata colisão de unicidade", async () => {
  const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /normalize\("NFC"\)/);
  assert.match(worker, /\\p\{L\}\\p\{N\}_-\]\{3,20\}/);
  assert.match(worker, /toLocaleLowerCase\("pt-BR"\)/);
  assert.match(worker, /Este nickname já está sendo usado por outro jogador/);
  assert.match(worker, /LEFT JOIN player_nicknames n ON n\.player_id=p\.id/);
});

test("interface permite salvar e pesquisar nickname sem inserir resultado como HTML", async () => {
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(html, /type:"set_nickname",nickname/);
  assert.match(html, /\/game\/players\/search\?q=/);
  assert.match(html, /title\.textContent=player\.nickname/);
  assert.match(html, /results\.replaceChildren\(\)/);
  assert.doesNotMatch(html, /results\.innerHTML=.*player\.nickname/);
});
