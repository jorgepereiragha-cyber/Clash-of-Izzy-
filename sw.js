const CACHE_NAME="clash-of-izzy-shell-v53";
const CORE_ASSETS=["/","/index.html","/portal.html","/assets/brand/hero-emblem.svg","/assets/brand/royal-king.webp","/account.html","/arena.html","/kingdom.html","/world.html","/world-map.js","/world-map-3d.js","/world-map-viewport.js","/rally-ui.js","/styles/rally.css","/events.html","/events.js","/event-catalog.js","/styles/events-hub.css","/assets/art/events/angel-of-death.svg","/assets/art/events/valhalla.svg","/assets/art/events/wild-hunt.svg","/assets/art/events/shiva.svg","/assets/art/events/khali.svg","/assets/art/events/siege-of-eldoria.svg","/assets/art/events/champions-tournament.svg","/scripts/kingdom-3d.js","/scripts/castle-visual-upgrades.js","/scripts/kingdom-quality.js","/scripts/kingdom-materials.js","/scripts/pwa-runtime.js","/styles/android-experience.css","/assets/3d/manifest.json","/assets/art/landing-kingdom.svg","/assets/art/heroes/portraits.svg","/assets/art/skins/pantheon-relics.svg","/styles/heroes.css","/engine/asset-loader.js","/engine/resource-disposal.js","/engine/texture-manager.js","/equipment-ui.html","/equipment-system.js","/equipment-styles.css","/admin.html","/valhalla-admin-ui.js","/styles/valhalla-admin.css","/valhalla-shop-ui.js","/styles/valhalla-shop.css","/player-engagement.js","/apoie.html","/navigation.js","/styles/navigation.css","/alliance.html","/styles/coi-theme.css","/styles/landing.css","/landing.js","/manifest.json","/icon-192.svg","/icon-512.svg","/favicon.svg","/logo.svg","/styles/premium-ui.css","/scripts/ambient-particles.js","/scripts/advanced-shaders.js","/offline.html","/styles/kingdom-4x-command.css","/scripts/kingdom-command-hud.js","/scripts/kingdom-command-state.js","/scripts/eldoria-realtime-client.js","/market.html","/market.css","/market.js","/scripts/kingdom-visual-boot.js","/scripts/kingdom-visual-preferences.js","/scripts/world-map-visual-boot.js"];
async function precacheApplicationShell() {
 const cache = await caches.open(CACHE_NAME);
 const manifestPath = "/vendor/three/asset-manifest.json";
 const response = await fetch(manifestPath, { cache: "no-store" });
 if (!response.ok) throw new Error("Manifesto Three.js local indisponível.");
 const manifest = await response.json();
 if (manifest?.format !== 1 || manifest?.threeVersion !== "0.187.0" || !Array.isArray(manifest.assets)) {
  throw new Error("Manifesto Three.js inválido ou incompatível.");
 }
 if (!manifest.assets.every(path => typeof path === "string" && path.startsWith("/vendor/three/") && !path.includes(".."))) {
  throw new Error("O manifesto Three.js contém caminhos não permitidos.");
 }
 // Keep the shell atomic: if a required asset is missing, retain the previous
 // active Service Worker rather than install a partially cached app.
 await cache.addAll([...CORE_ASSETS, manifestPath, ...manifest.assets]);
 await self.skipWaiting();
}
self.addEventListener("install", event => {
 event.waitUntil(precacheApplicationShell());
});

// Keep application navigation available offline without caching arbitrary same-origin
// responses, authorization-bearing requests or URLs containing user-supplied parameters.
const RUNTIME_CACHE_NAME = "clash-of-izzy-runtime-v1";
const RUNTIME_CACHE_MAX_ENTRIES = 64;
const RUNTIME_ASSET_PATTERN = /\.(?:glb|gltf|bin|ktx2|png|jpe?g|webp|avif|svg|wasm|js|css)$/i;

function isShellPath(pathname) {
  return CORE_ASSETS.includes(pathname);
}

function isRuntimeAsset(pathname) {
  return (pathname.startsWith("/assets/") || pathname.startsWith("/vendor/three/")) && RUNTIME_ASSET_PATTERN.test(pathname);
}

function canStoreResponse(response) {
  if (!response || response.status !== 200 || response.type !== "basic") return false;
  const directives = response.headers.get("cache-control") || "";
  if (/(?:^|,)\s*(?:private|no-store|no-cache)\b/i.test(directives)) return false;
  if (response.headers.has("set-cookie")) return false;
  return true;
}

async function limitRuntimeCache(cache) {
  const keys = await cache.keys();
  const surplus = keys.length - RUNTIME_CACHE_MAX_ENTRIES;
  for (let index = 0; index < surplus; index += 1) {
    await cache.delete(keys[index]);
  }
}

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => (
          (key.startsWith("clash-of-izzy-shell-") && key !== CACHE_NAME)
          || (key.startsWith("clash-of-izzy-runtime-") && key !== RUNTIME_CACHE_NAME)
        ))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("Authorization")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // Query-bearing routes may contain referral/search/account data.
        // Fetch those normally, but never persist their response or URL.
        if (!url.search && isShellPath(url.pathname) && canStoreResponse(response)) {
          // Storage quotas and private-mode cache failures are not network failures.
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(url.pathname, response.clone());
          } catch {
            // Online navigation must succeed even when offline storage is unavailable.
          }
        }
        return response;
      } catch {
        // The shell is stored under pathname only. Client-side routes retain
        // their query parameters in the browser even while offline.
        return (await caches.match(url.pathname)) || (await caches.match("/offline.html")) ||
          new Response("<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><title>Sem conexão</title><h1>Sem conexão</h1><p>Não foi possível carregar o jogo. Reconecte e tente novamente.</p></html>", {
            status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
          });
      }
    })());
    return;
  }

  // The shell is precached at install. Only bounded static assets may be added
  // at runtime, avoiding unbounded query variants and accidental private data.
  if (url.search || (!isShellPath(url.pathname) && !isRuntimeAsset(url.pathname))) return;
  event.respondWith((async () => {
    const cached = await caches.match(url.pathname);
    if (cached) return cached;
    let response;
    try {
      response = await fetch(request);
    } catch {
      // Static resources cannot use an HTML fallback: signal a network failure
      // so the existing 2D renderer and retry UI can handle the missing asset.
      return Response.error();
    }
    if (canStoreResponse(response)) {
      try {
        const runtime = isRuntimeAsset(url.pathname) && !isShellPath(url.pathname);
        const cache = await caches.open(runtime ? RUNTIME_CACHE_NAME : CACHE_NAME);
        await cache.put(url.pathname, response.clone());
        if (runtime) await limitRuntimeCache(cache);
      } catch {
        // Cache errors must not block the successfully fetched static resource.
      }
    }
    return response;
  })());
});
