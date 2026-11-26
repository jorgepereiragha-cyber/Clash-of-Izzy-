import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("homepage redireciona para o portal, sem link para jogar no navegador", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /http-equiv="refresh" content="0;url=\/portal\.html"/);
  assert.match(html, /href="\/portal\.html"/);
  assert.doesNotMatch(html, /id="play-now"|href="\.\/kingdom\.html"/);
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
  assert.match(html, /"💎","Diamantes","gems",state\?\.player\?\.gems/);
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

test("Playwright test tooling and diagnostics are excluded from public assets", async () => {
  const ignored = await readFile(new URL("../.assetsignore", import.meta.url), "utf8");
  for (const path of ["tests/", "playwright.config.js", "playwright-report/", "test-results/"]) {
    assert.ok(ignored.split(/\r?\n/).includes(path), "public asset ignore rule missing: " + path);
  }
});

test("PWA cache version is bumped when static UI changes", async () => {
  const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  const cacheVersion = Number(worker.match(/const CACHE_NAME="clash-of-izzy-shell-v(\d+)"/)?.[1] || 0);
  assert.ok(cacheVersion > 40, `expected Service Worker cache version above v40, got v${cacheVersion || "missing"}`);
  assert.match(worker, /valhalla-admin-ui\.js/);
  assert.match(worker, /styles\/valhalla-admin\.css/);
  assert.match(worker, /valhalla-shop-ui\.js/);
  assert.match(worker, /styles\/valhalla-shop\.css/);
});


test("reino oferece recuperação de conta após 401/403 sem apagar a sessão", async () => {
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(html, /failure\.status=response\.status/);
  assert.match(html, /error\?\.status===401\|\|error\?\.status===403/);
  assert.match(html, /accountLink\.href="\/account\.html"/);
  assert.match(html, /loading\.append\(accountLink\)/);
  assert.doesNotMatch(html, /localStorage\.removeItem\("coi_game_token"\)/);
});


test("all six economy counters have local artwork with a visible fallback", async () => {
 const html=await readFile(new URL("../kingdom.html",import.meta.url),"utf8");
 const paths=JSON.parse(html.match(/const iconPaths=(\{[^\n]+\});/)[1].replace(/([a-z]+):/g,'"$1":'));
 assert.deepEqual(Object.keys(paths),["food","wood","stone","iron","gold","gems"]);
 const distinct=new Set();
 for(const filename of Object.values(paths)){
  const asset=await readFile(new URL("../assets/art/resources/"+filename,import.meta.url));
  assert.ok(asset.length<20000);
  if(filename.endsWith(".png"))assert.equal(asset.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  else assert.match(asset.toString(),/<svg xmlns=/);
  assert.ok(!distinct.has(asset.toString("base64")));
  distinct.add(asset.toString("base64"));
 }
 assert.match(html,/img\.addEventListener\("load",\(\)=>\{fallback\.hidden=true;img\.hidden=false;/);
 assert.match(html,/img\.addEventListener\("error",\(\)=>img\.remove\(\)/);
 assert.match(html,/img\.src="\/assets\/art\/resources\/"\+iconPaths\[key\]/);
});
