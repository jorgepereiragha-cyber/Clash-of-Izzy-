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
    if (path === "/api/admin/health") return makeResponse({
      hasDB: true, hasSESSION_SECRET: true, hasADMIN_EMAIL: true, hasADMIN_PASSWORD: true,
    });
    if (path === "/api/game/state") return makeResponse({ error: "Sessão inválida." }, 401);
    if (path === "/api/store/catalog") return makeResponse({ skins: [], packages: [] });
    if (path === "/arena.html") return makeResponse(
      '<select id="purchaseMethod"><option value="mercadopago_link" selected>Mercado Pago</option></select> https://link.mercadopago.com.br/pagamentosskin paymentWindow',
      200,
      "text/html; charset=utf-8"
    );
    if (path === "/manifest.json") return makeResponse({ name: "Clash of Izzy", shortcuts: [{url:"/kingdom.html"},{url:"/world.html"},{url:"/events.html"}] });
    if (path === "/sw.js") return makeResponse('const CACHE_NAME="clash-of-izzy-shell-v14"; const CORE_ASSETS=["/world-map-3d.js","/world-map-viewport.js","/navigation.js","/offline.html"]; if(url.pathname.startsWith("/api/")) return;', 200, "text/javascript");
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
  assert.equal(result.checks.adminConfiguration, true);
  assert.equal(result.checks.mercadoPagoCheckout, true);
  assert.equal(result.checks.staticPages, 8);
  assert.equal(result.checks.worldMapNavigation, true);
  assert.equal(result.checks.worldMap3D, true);
  assert.ok(calls.includes("/world-map-viewport.js"));
  assert.ok(calls.includes("/world-map-3d.js"));
  assert.ok(calls.includes("/arena.html"));
  assert.ok(calls.includes("/api/game/state"));
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

test("production smoke refuses to report an active Master panel without its secrets", async () => {
  const { fetchImpl } = successfulFetch();
  const brokenFetch = async url => {
    if (new URL(url).pathname === "/api/admin/health") {
      return makeResponse({
        hasDB: true, hasSESSION_SECRET: true, hasADMIN_EMAIL: false, hasADMIN_PASSWORD: false,
      });
    }
    return fetchImpl(url);
  };
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://clash-of-izzy.example.workers.dev", fetchImpl: brokenFetch }),
    /ADMIN_EMAIL não está configurado/
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
