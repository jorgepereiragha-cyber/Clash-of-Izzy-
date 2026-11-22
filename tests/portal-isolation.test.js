import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import portalWorker from "../portal-worker.js";

function mockEnv(){
  const served = [];
  return {
    served,
    ASSETS: {
      async fetch(request){
        const path = new URL(request.url).pathname;
        served.push(path);
        return new Response("static asset: " + path, { status: 200 });
      }
    }
  };
}
const req = (path, method="GET") => new Request("https://promocao.example" + path, {method});

test("portal isolado redireciona a raiz para a propaganda, sem abrir o jogo", async ()=>{
  const env=mockEnv();
  const response=await portalWorker.fetch(req("/?utm_source=campanha"),env);
  assert.equal(response.status,302);
  assert.equal(response.headers.get("location"),"https://promocao.example/portal.html?utm_source=campanha");
  assert.deepEqual(env.served,[]);
});

test("portal isolado só publica os arquivos essenciais de marketing",async()=>{
  const env=mockEnv();
  const allow=["/portal","/portal.html","/apoie","/apoie.html","/favicon.svg","/styles/coi-theme.css","/assets/brand/hero-emblem.svg","/assets/brand/royal-king.webp"];
  for(const path of allow){
    const response=await portalWorker.fetch(req(path),env);
    assert.equal(response.status,200,path);
  }
  assert.deepEqual(env.served,allow);
});

test("links diretos de jogo, API, loja e PWA não são entregues pelo portal público",async()=>{
  const env=mockEnv();
  const blocked=[
    "/kingdom.html","/world.html","/arena.html","/account.html","/admin.html",
    "/market.html","/events.html","/alliance.html","/sw.js","/manifest.json",
    "/api/game/state","/api/health","/api/store/checkout","/api/realtime/eldoria",
    "/worker.js","/hero-catalog.js","/assets/art/heroes/portraits.svg",
    "/.git/config","/%2e%2e/kingdom.html"
  ];
  for(const path of blocked){
    const response=await portalWorker.fetch(req(path),env);
    assert.equal(response.status,404,path);
    assert.equal(response.headers.get("cache-control"),"no-store",path);
  }
  assert.deepEqual(env.served,[]);
});

test("portal rejeita métodos de escrita, inclusive endpoints e checkout",async()=>{
  const env=mockEnv();
  for(const method of ["POST","PUT","PATCH","DELETE","OPTIONS"]){
    const response=await portalWorker.fetch(req("/api/store/checkout",method),env);
    assert.equal(response.status,405,method);
  }
  const head=await portalWorker.fetch(req("/portal.html","HEAD"),env);
  assert.equal(head.status,200);
  assert.deepEqual(env.served,["/portal.html"]);
});

test("configuração deploy isola assets sem D1, Durable Objects e segredo do jogo",async()=>{
  const config=JSON.parse(await readFile(new URL("../wrangler.portal.jsonc",import.meta.url),"utf8"));
  const portal=await readFile(new URL("../public-portal/portal.html",import.meta.url),"utf8");
  assert.equal(config.name,"clash-of-izzy-portal");
  assert.equal(config.main,"portal-worker.js");
  assert.equal(config.assets.directory,"./public-portal");
  assert.equal(config.assets.run_worker_first,true);
  assert.ok(!Object.hasOwn(config,"d1_databases"));
  assert.ok(!Object.hasOwn(config,"durable_objects"));
  assert.ok(!Object.hasOwn(config,"vars"));
  assert.match(portal,/id="download-apk"/);
  assert.match(portal,/releases\/latest/);
  assert.doesNotMatch(portal,/href="\/(?:kingdom|world|arena|account|admin)\.html"/);
});

test("identidade rei guerreiro usa capa real responsiva sem ativar download inexistente",async()=>{
  const main=await readFile(new URL("../portal.html",import.meta.url),"utf8");
  const publicHtml=await readFile(new URL("../public-portal/portal.html",import.meta.url),"utf8");
  const publicCss=await readFile(new URL("../public-portal/styles/coi-theme.css",import.meta.url),"utf8");
  const sharedCss=await readFile(new URL("../styles/coi-theme.css",import.meta.url),"utf8");
  assert.equal(main,publicHtml,"site oficial e site isolado devem ter a mesma apresentação");
  assert.equal(publicCss,sharedCss,"tokens da marca devem estar sincronizados");
  assert.match(publicHtml,/class="royal-hero"/);
  assert.match(publicHtml,/class="royal-art"/);
  assert.match(publicHtml,/--gold:#f1c467/);
  assert.match(publicHtml,/@media\(max-width:800px\)/);
  assert.match(publicHtml,/alt="Rei guerreiro de coroa dourada/);
  assert.match(publicHtml,/id="download-apk" aria-disabled="true"/);
  assert.match(publicHtml,/id="checksum-link" hidden/);
  assert.match(publicHtml,/function validAsset\(asset, expectedName\)/);
  assert.doesNotMatch(publicHtml,/href="\/(?:kingdom|world|arena)\.html"/);
});
