import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("entrada principal prioriza o reino e preserva a arena como modo secundário", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="play-now" href="\.\/kingdom\.html">⚔️ ENTRAR NO REINO/);
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

test("central do reino mostra filas persistentes, treinamento e pesquisas", async () => {
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(html, /id="queues"/);
  assert.match(html, /id="trainingForm"/);
  assert.match(html, /value="mage"/);
  assert.match(html, /id="researchForm"/);
  assert.match(html, /renderQueues\(\)/);
  assert.match(html, /refreshQueueState/);
  assert.match(html, /submitQueue\("train"/);
  assert.match(html, /submitQueue\("research"/);
  assert.match(html, /data-completes/);
});

test("HUD shows server-owned gems and highlights only changed resource counters", async () => {
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(html, /renderResourceHud\(k\)/);
  assert.match(html, /"💎","Gemas","gems",state\?\.player\?\.gems/);
  assert.match(html, /lastResourceSnapshot/);
  assert.match(html, /resource-bump/);
  assert.match(html, /grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
});

test("queue progress uses D1 timestamps and updates the accessible progress bar live", async () => {
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(html, /function queueProgressPercent\(startedAt,completesAt,now=Date\.now\(\)\)/);
  assert.match(html, /data-started=/);
  assert.match(html, /data-progress/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /queueProgressPercent\(el\.dataset\.started,el\.dataset\.completes,now\)/);
});

test("central do reino envia feedback e registra analytics da sessão", async () => {
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(html, /id="feedbackForm"/);
  assert.match(html, /request\("\/game\/feedback"/);
  assert.match(html, /request\("\/game\/analytics"/);
  assert.match(html, /kingdom\.opened/);
});

test("PWA cache version is bumped when static UI changes", async () => {
  const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(worker, /clash-of-izzy-shell-v26/);
  assert.match(worker, /valhalla-admin-ui\.js/);
  assert.match(worker, /styles\/valhalla-admin\.css/);
  assert.match(worker, /valhalla-shop-ui\.js/);
  assert.match(worker, /styles\/valhalla-shop\.css/);
});
