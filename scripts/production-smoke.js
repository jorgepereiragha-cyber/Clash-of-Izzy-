import { pathToFileURL } from "node:url";

const REQUIRED_PAGES = [
  "/",
  "/index.html",
  "/kingdom.html",
  "/world.html",
  "/events.html",
  "/alliance.html",
  "/equipment-ui.html",
  "/admin.html",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(response, label) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(label + " não retornou JSON válido.");
  }
}

/**
 * Read-only post-deploy checks against the public Worker URL.
 * No player is created and no game or payment data is changed.
 */
export async function runProductionSmokeTests({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = 12_000,
} = {}) {
  assert(typeof baseUrl === "string" && baseUrl.trim(), "WORKER_BASE_URL não foi informado.");
  const base = new URL(baseUrl);
  assert(base.protocol === "https:", "O endereço público do Worker deve usar HTTPS.");
  assert(!base.username && !base.password, "A URL do Worker não pode conter credenciais.");
  base.pathname = "/";
  base.search = "";
  base.hash = "";

  const get = async path => {
    const response = await fetchImpl(new URL(path.replace(/^\//, ""), base), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Clash-of-Izzy-production-smoke/1.0" },
    });
    return response;
  };

  const healthResponse = await get("/api/health");
  assert(healthResponse.status === 200, "API de saúde respondeu HTTP " + healthResponse.status + ".");
  const health = await readJson(healthResponse, "API de saúde");
  assert(health.ok === true && health.status === "ready", "Worker não está pronto: " + JSON.stringify(health.checks || {}));
  assert(health.checks?.database === true, "Banco D1 não está conectado.");
  assert(health.checks?.session === true, "SESSION_SECRET não está configurado no Worker.");
  assert(health.checks?.schema === true, "O schema D1 está incompleto.");
  assert(Array.isArray(health.missingTables) && health.missingTables.length === 0,
    "Tabelas ausentes: " + (health.missingTables || []).join(", "));

  const adminResponse = await get("/api/admin/health");
  assert(adminResponse.status === 200, "Health administrativo respondeu HTTP " + adminResponse.status + ".");
  const admin = await readJson(adminResponse, "Health administrativo");
  assert(admin.hasDB === true, "Painel Master sem conexão com D1.");
  assert(admin.hasSESSION_SECRET === true, "Painel Master sem SESSION_SECRET.");
  assert(admin.hasADMIN_EMAIL === true, "ADMIN_EMAIL não está configurado no Worker.");
  assert(admin.hasADMIN_PASSWORD === true, "ADMIN_PASSWORD não está configurado no Worker.");

  const stateResponse = await get("/api/game/state");
  assert(stateResponse.status === 401, "O estado do jogo deve exigir sessão; recebido HTTP " + stateResponse.status + ".");

  const catalogResponse = await get("/api/store/catalog");
  assert(catalogResponse.status === 200, "Catálogo público respondeu HTTP " + catalogResponse.status + ".");
  const catalog = await readJson(catalogResponse, "Catálogo");
  assert(Array.isArray(catalog.skins), "Catálogo de skins não está disponível.");
  assert(Array.isArray(catalog.packages), "Catálogo de pacotes não está disponível.");

  for (const page of REQUIRED_PAGES) {
    const response = await get(page);
    assert(response.status === 200, page + " respondeu HTTP " + response.status + ".");
    const contentType = response.headers.get("content-type") || "";
    assert(contentType.includes("text/html"), page + " não foi servido como HTML.");
    const body = await response.text();
    assert(body.length > 100, page + " está vazio ou incompleto.");
  }

  const manifestResponse = await get("/manifest.json");
  assert(manifestResponse.status === 200, "Manifest da PWA indisponível.");
  const manifest = await readJson(manifestResponse, "Manifest da PWA");
  assert(manifest.name === "Clash of Izzy", "Manifest não identifica o Clash of Izzy.");

  const mapHelperResponse = await get("/world-map-viewport.js");
  assert(mapHelperResponse.status === 200, "Módulo de navegação do mapa indisponível.");
  const mapHelper = await mapHelperResponse.text();
  assert(mapHelper.includes("clampMapViewport") && mapHelper.includes("mapViewportTransform"),
    "Módulo de navegação do mapa está incompleto.");

  const serviceWorkerResponse = await get("/sw.js");
  assert(serviceWorkerResponse.status === 200, "Service worker indisponível.");
  const serviceWorker = await serviceWorkerResponse.text();
  assert(serviceWorker.includes("clash-of-izzy-shell-v11"), "Service worker não contém o cache esperado.");
  assert(serviceWorker.includes("/world-map-viewport.js"), "PWA não inclui o módulo de navegação do mapa.");

  return {
    baseUrl: base.origin,
    checks: {
      apiHealth: true,
      d1: true,
      sessionSecret: true,
      adminConfiguration: true,
      unauthenticatedAccessBlocked: true,
      storeCatalog: true,
      staticPages: REQUIRED_PAGES.length,
      pwaManifest: true,
      serviceWorker: true,
      worldMapNavigation: true,
    },
  };
}

async function main() {
  try {
    const result = await runProductionSmokeTests({ baseUrl: process.env.WORKER_BASE_URL });
    console.log("Production smoke test passed: " + JSON.stringify(result));
  } catch (error) {
    console.error("Production smoke test failed: " + String(error?.message || error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
