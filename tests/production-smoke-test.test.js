import test from "node:test";
import assert from "node:assert/strict";
import { runProductionSmokeTests } from "../scripts/production-smoke.js";

function makeResponse(body, status = 200, contentType = "application/json; charset=utf-8") {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

function successfulFetch() {
  const calls = [];
  const fetchImpl = async url => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === "/api/health") return makeResponse({
      ok: true, status: "ready",
      checks: { database: true, session: true, schema: true },
      missingTables: [],
    });
    if (path === "/api/admin/health") return makeResponse(
      { error: "Sessão administrativa inválida ou expirada." }, 401
    );
    if (path === "/api/game/state" || path === "/api/game/referral/link" || path === "/api/account/status") return makeResponse({ error: "Sessão inválida." }, 401);
    if (path === "/api/store/catalog") return makeResponse({ skins: [], packages: [] });
    if (path === "/arena.html") return makeResponse(
      '<select id="purchaseMethod"><option value="mercadopago_link" selected>Mercado Pago</option></select> https://link.mercadopago.com.br/pagamentosskin paymentWindow',
      200,
      "text/html; charset=utf-8"
    );
    if (path === "/account.html") return makeResponse(
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conta persistente · Clash of Izzy</title></head><body><header><strong>CLASH OF IZZY</strong></header><main><h1>Conta do Comandante</h1><p>Proteja seu reino com uma conta persistente. Entre com nome de usuário ou e-mail para continuar o mesmo progresso em outro dispositivo.</p><section><form id="loginForm"><label for="loginIdentifier">Usuário ou e-mail</label><input id="loginIdentifier" name="identifier"><label for="loginPassword">Senha</label><input id="loginPassword" name="password" type="password"><button>ENTRAR NO REINO</button></form></section><section><form id="registerForm"><label for="registerUsername">Nome de usuário</label><input id="registerUsername" name="username"><label for="registerEmail">E-mail</label><input id="registerEmail" name="email"><label for="registerPassword">Senha</label><input id="registerPassword" name="password" type="password"><button>CRIAR CONTA E PROTEGER REINO</button></form></section><p>O cadastro vincula a conta ao reino existente sem apagar construções, tropas, recursos, alianças ou progresso.</p></main></body></html>',
      200,
      "text/html; charset=utf-8"
    );
    if (path === "/index.html") return makeResponse(
      '<!doctype html><html lang="pt-BR"><head><title>Clash of Izzy</title></head><body><main><h1>CLASH OF IZZY</h1><p>Construa seu reino, fortaleça seu exército e dispute territórios.</p><form id="beta-signup-form"><label>Receber convite beta</label><input name="consent" type="checkbox"><button>Participar</button></form></main></body></html>',
      200,
      "text/html; charset=utf-8"
    );
    if (path === "/kingdom.html") return makeResponse(
      '<main><form id="feedbackForm"></form><script>trackAnalytics("kingdom.opened"); request("/game/analytics")</script><script type="module" src="/scripts/cinematic/recorder-ui.js"></script></main>',
      200,
      "text/html; charset=utf-8"
    );
    if (path === "/manifest.json") return makeResponse({ name: "Clash of Izzy" });
    if (path === "/sw.js") return makeResponse('const CACHE_NAME="clash-of-izzy-shell-v26"; const CORE_ASSETS=["/account.html","/styles/landing.css","/landing.js","/world-map-3d.js","/world-map-viewport.js","/admin.html","/valhalla-admin-ui.js","/styles/valhalla-admin.css","/valhalla-shop-ui.js","/styles/valhalla-shop.css","/scripts/cinematic/capture-system.js","/scripts/cinematic/media-recorder-support.js","/scripts/cinematic/trailer-script.js","/scripts/cinematic/recorder-ui.js"];', 200, "text/javascript");
    if (path === "/styles/landing.css") return makeResponse("body{color:#fff}.landing-hero{display:grid}", 200, "text/css");
    if (path === "/landing.js") return makeResponse("function showInstallGuide(){} fetch(\"/api/game/referral/link\")", 200, "text/javascript");
    if (path.startsWith("/scripts/cinematic/")) return makeResponse(("export class CinematicCapture {} export const TRAILER_SCRIPT = {};").repeat(12), 200, "text/javascript");
    if (path === "/styles/premium-ui.css") return makeResponse("/* CINEMATIC TRAILER RECORDER */", 200, "text/css");

    if (path === "/world-map-viewport.js") return makeResponse("export function clampMapViewport(){} export function mapViewportTransform(){}", 200, "text/javascript");
    if (path === "/world-map-3d.js") return makeResponse("new THREE.OrthographicCamera(); function createMarchFormation(){}", 200, "text/javascript");
    return makeResponse("<!doctype html><html lang=\"pt-BR\"><head><title>Clash of Izzy</title></head><body><main>Clash of Izzy - estratégia medieval e reino</main></body></html>", 200, "text/html; charset=utf-8");
  };
  return { fetchImpl, calls };
}

test("production smoke validates D1, secrets, game auth, store, core screens and PWA", async () => {
  const { fetchImpl, calls } = successfulFetch();
  const result = await runProductionSmokeTests({
    baseUrl: "https://clash-of-izzy.example.workers.dev",
    fetchImpl,
  });
  assert.equal(result.checks.apiHealth, true);
  assert.equal(result.checks.d1, true);
  assert.equal(result.checks.adminHealthAuthBoundary, true);
  assert.equal(result.checks.mercadoPagoCheckout, true);
  assert.equal(result.checks.betaSignupUi, true);
  assert.equal(result.checks.feedbackUiAndAnalytics, true);
  assert.equal(result.checks.staticPages, 9);
  assert.equal(result.checks.worldMapNavigation, true);
  assert.equal(result.checks.worldMap3D, true);
  assert.equal(result.checks.cinematicTrailerRecorder, true);
  assert.ok(calls.includes("/world-map-viewport.js"));
  assert.ok(calls.includes("/world-map-3d.js"));
  assert.ok(calls.includes("/scripts/cinematic/capture-system.js"));
  assert.ok(calls.includes("/scripts/cinematic/media-recorder-support.js"));
  assert.ok(calls.includes("/scripts/cinematic/trailer-script.js"));
  assert.ok(calls.includes("/scripts/cinematic/recorder-ui.js"));
  assert.ok(calls.includes("/styles/premium-ui.css"));
  assert.ok(calls.includes("/arena.html"));
  assert.ok(calls.includes("/api/game/state"));
  assert.ok(calls.includes("/api/account/status"));
  assert.ok(calls.includes("/account.html"));
  assert.ok(calls.includes("/events.html"));
  assert.ok(calls.includes("/world.html"));
});

test("production smoke fails closed when D1 schema or session is not ready", async () => {
  const fetchImpl = async url => {
    if (new URL(url).pathname === "/api/health") {
      return makeResponse({
        ok: false, status: "not_ready",
        checks: { database: true, session: false, schema: false },
        missingTables: ["kingdom_queues"],
      }, 503);
    }
    throw new Error("A verificação deve parar no health");
  };
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://clash-of-izzy.example.workers.dev", fetchImpl }),
    /API de saúde respondeu HTTP 503/
  );
});

test("production smoke fails if the admin health endpoint is publicly exposed", async () => {
  const { fetchImpl } = successfulFetch();
  const exposedFetch = async url => {
    if (new URL(url).pathname === "/api/admin/health") {
      return makeResponse({
        hasDB: true, hasSESSION_SECRET: true, hasADMIN_EMAIL: true, hasADMIN_PASSWORD: true,
      }, 200);
    }
    return fetchImpl(url);
  };
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://clash-of-izzy.example.workers.dev", fetchImpl: exposedFetch }),
    /Health administrativo deve exigir autenticação/
  );
});

test("production smoke refuses insecure URLs and missing authentication boundaries", async () => {
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "http://clash-of-izzy.example.workers.dev", fetchImpl: successfulFetch().fetchImpl }),
    /HTTPS/
  );
  const { fetchImpl } = successfulFetch();
  const unprotectedFetch = async url => {
    if (new URL(url).pathname === "/api/game/state") return makeResponse({ state: {} });
    return fetchImpl(url);
  };
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://clash-of-izzy.example.workers.dev", fetchImpl: unprotectedFetch }),
    /deve exigir sessão/
  );
});
