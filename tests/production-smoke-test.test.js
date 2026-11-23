import test from "node:test";
import assert from "node:assert/strict";
import { runProductionSmokeTests } from "../scripts/production-smoke.js";

function makeResponse(body, status = 200, contentType = "application/json; charset=utf-8") {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

function validGlbResponse() {
  const bytes = new ArrayBuffer(64);
  const header = new DataView(bytes);
  header.setUint32(0, 0x46546c67, true); // glTF
  header.setUint32(4, 2, true); // binary glTF v2
  header.setUint32(8, bytes.byteLength, true);
  return new Response(bytes, { status: 200, headers: { "content-type": "model/gltf-binary" } });
}

function successfulFetch() {
  const calls = [];
  const fetchImpl = async url => {
    const path = decodeURIComponent(new URL(url).pathname);
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
      '<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script><p>purchase-request manual_whatsapp https://wa.me/ mercadopago_link /store/checkout checkoutWindow</p>',
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
      '<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script><main><form id="feedbackForm"></form><script>trackAnalytics("kingdom.opened"); request("/game/analytics")</script></main>',
      200,
      "text/html; charset=utf-8"
    );
    if (path === "/assets/3d/manifest.json") return makeResponse({
      version: 2,
      models: [
        { type: "watchtower", enabled: true, src: "/assets/3d/kenney/castle-kit/Models/GLB format/tower-square.glb" },
        { type: "wall", enabled: true, src: "/assets/3d/kenney/castle-kit/Models/GLB format/wall.glb" },
      ],
      props: [{
        id: "kenney-tree-high", enabled: true,
        src: "/assets/3d/kenney/mini-forest/Models/GLB format/tree-high.glb",
        positions: Array.from({ length: 6 }, (_, i) => [i, 0, i]),
      }],
    });
    if (path.startsWith("/assets/3d/kenney/")) return validGlbResponse();
    if (path === "/vendor/three/asset-manifest.json") return makeResponse({
      format: 1, threeVersion: "0.187.0",
      assets: ["/vendor/three/build/three.module.js","/vendor/three/examples/jsm/loaders/GLTFLoader.js","/vendor/three/examples/jsm/loaders/DRACOLoader.js","/vendor/three/examples/jsm/loaders/KTX2Loader.js","/vendor/three/examples/jsm/libs/meshopt_decoder.module.js","/vendor/three/examples/jsm/libs/draco/draco_decoder.js","/vendor/three/examples/jsm/libs/draco/draco_decoder.wasm","/vendor/three/examples/jsm/libs/draco/draco_wasm_wrapper.js","/vendor/three/examples/jsm/libs/basis/basis_transcoder.js","/vendor/three/examples/jsm/libs/basis/basis_transcoder.wasm"]
    });
    if (path.startsWith("/vendor/three/")) return makeResponse("x".repeat(256), 200,
      path.endsWith(".wasm") ? "application/wasm" : "text/javascript; charset=utf-8");
    if (path === "/world-map-3d.js") {
      return makeResponse('import * as THREE from "three"; new THREE.OrthographicCamera(); function createMarchFormation(){}', 200, "text/javascript; charset=utf-8");
    }
    if (path === "/engine/asset-loader.js" || path === "/scripts/kingdom-3d.js") {
      return makeResponse('import * as THREE from "three"; function createCastleGlbGroup() { return glbTemplates; }', 200, "text/javascript; charset=utf-8");
    }
    if (path === "/arena.html" || path === "/kingdom.html" || path === "/world.html") {
      return makeResponse('<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>', 200, "text/html; charset=utf-8");
    }
    if (path === "/manifest.json") return makeResponse({ name: "Clash of Izzy" });
    if (path === "/sw.js") return makeResponse('const CACHE_NAME="clash-of-izzy-shell-v35"; const CORE_ASSETS=["/account.html","/styles/landing.css","/landing.js","/world-map-3d.js","/world-map-viewport.js","/admin.html","/valhalla-admin-ui.js","/styles/valhalla-admin.css","/valhalla-shop-ui.js","/styles/valhalla-shop.css"];', 200, "text/javascript");
    if (path === "/styles/landing.css") return makeResponse("body{color:#fff}.landing-hero{display:grid}", 200, "text/css");
    if (path === "/landing.js") return makeResponse("function showInstallGuide(){} fetch(\"/api/game/referral/link\")", 200, "text/javascript");
    if (path.startsWith("/scripts/cinematic/")) return makeResponse(("export class CinematicCapture {} export const TRAILER_SCRIPT = {};").repeat(12), 200, "text/javascript");
    if (path === "/styles/premium-ui.css") return makeResponse("#trailer-recorder-panel{display:none!important}", 200, "text/css");

    if (path === "/world-map-viewport.js") return makeResponse("export function clampMapViewport(){} export function mapViewportTransform(){}", 200, "text/javascript");
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
  assert.equal(result.checks.manualWhatsAppPurchaseFlow, true);
  assert.equal(result.checks.betaSignupUi, true);
  assert.equal(result.checks.feedbackUiAndAnalytics, true);
  assert.equal(result.checks.staticPages, 9);
  assert.equal(result.checks.worldMapNavigation, true);
  assert.equal(result.checks.worldMap3D, true);
  assert.equal(result.checks.threeVendorRuntime, true);
  assert.equal(result.checks.castleForestGlbAssets, true);
  assert.equal(result.checks.trailerRecorderRemovedFromGameplay, true);
  assert.ok(calls.includes("/assets/3d/manifest.json"));
  assert.ok(calls.some(path => path.endsWith("/tower-square.glb")));
  assert.ok(calls.some(path => path.endsWith("/wall.glb")));
  assert.ok(calls.some(path => path.endsWith("/tree-high.glb")));
  assert.ok(calls.includes("/world-map-viewport.js"));
  assert.ok(calls.includes("/world-map-3d.js"));
  assert.ok(!calls.includes("/scripts/cinematic/capture-system.js"));
  assert.ok(!calls.includes("/scripts/cinematic/media-recorder-support.js"));
  assert.ok(!calls.includes("/scripts/cinematic/trailer-script.js"));
  assert.ok(!calls.includes("/scripts/cinematic/recorder-ui.js"));
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

test("production smoke aceita entrada exclusivamente promocional com APK oficial", async () => {
  const { fetchImpl: legacy } = successfulFetch();
  const fetchImpl = async url => {
    const path = new URL(url).pathname;
    if (path === "/index.html") return makeResponse(
      '<html><meta http-equiv="refresh" content="0;url=/portal.html"><a href="/portal.html">Baixar aplicativo</a></html>',
      200, "text/html; charset=utf-8");
    if (path === "/portal.html") return makeResponse(
      '<html><h1>CLASH OF IZZY</h1><a id="download-apk">Baixar aplicativo Android</a><script>fetch("releases/latest");const ext=".sha256";</script></html>',
      200, "text/html; charset=utf-8");
    if (path === "/styles/coi-theme.css") return makeResponse("body{color:white}",200,"text/css; charset=utf-8");
    return legacy(url);
  };
  const result = await runProductionSmokeTests({ baseUrl: "https://clash-of-izzy.example.workers.dev", fetchImpl });
  assert.equal(result.checks.androidPortalUi, true);
  assert.equal(result.checks.betaSignupUi, false);
});

test("production smoke fails closed if a castle GLB is missing", async () => {
  const { fetchImpl } = successfulFetch();
  const missingModel = async url => {
    const path = decodeURIComponent(new URL(url).pathname);
    if (path.endsWith("/tower-square.glb")) return makeResponse("missing", 404, "text/plain");
    return fetchImpl(url);
  };
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://clash-of-izzy.example.workers.dev", fetchImpl: missingModel }),
    /Modelo GLB indisponível/
  );
});

test("production smoke rejects a published HTML error page posing as a GLB", async () => {
  const { fetchImpl } = successfulFetch();
  const malformed = async url => {
    const path = decodeURIComponent(new URL(url).pathname);
    if (path.endsWith("/tree-high.glb")) return makeResponse("<html>failure</html>".repeat(5), 200, "text/html");
    return fetchImpl(url);
  };
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://clash-of-izzy.example.workers.dev", fetchImpl: malformed }),
    /Modelo GLB sem cabeçalho glTF 2.0 íntegro/
  );
});

test("production smoke rejects a 3D manifest missing required forest placements", async () => {
  const { fetchImpl } = successfulFetch();
  const missingForest = async url => {
    if (new URL(url).pathname === "/assets/3d/manifest.json")
      return makeResponse({ version: 2, models: [
        { type: "watchtower", enabled: true, src: "/assets/3d/kenney/castle-kit/Models/GLB format/tower-square.glb" },
        { type: "wall", enabled: true, src: "/assets/3d/kenney/castle-kit/Models/GLB format/wall.glb" }
      ], props: [] });
    return fetchImpl(url);
  };
  await assert.rejects(
    runProductionSmokeTests({ baseUrl: "https://clash-of-izzy.example.workers.dev", fetchImpl: missingForest }),
    /Manifesto 3D não contém torre, muralha e árvore Kenney/
  );
});
