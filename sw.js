const CACHE_NAME="clash-of-izzy-shell-v60";
const CORE_ASSETS=["/","/index.html","/portal.html","/assets/brand/hero-emblem.svg","/assets/brand/royal-king.webp","/account.html","/arena.html","/kingdom.html","/world.html","/world-map.js","/world-map-3d.js","/world-map-viewport.js","/rally-ui.js","/styles/rally.css","/events.html","/events.js","/event-catalog.js","/styles/events-hub.css","/assets/art/events/angel-of-death.svg","/assets/art/events/valhalla.svg","/assets/art/events/wild-hunt.svg","/assets/art/events/shiva.svg","/assets/art/events/khali.svg","/assets/art/events/siege-of-eldoria.svg","/assets/art/events/champions-tournament.svg","/scripts/kingdom-3d.js","/scripts/castle-visual-upgrades.js","/scripts/kingdom-quality.js","/scripts/kingdom-materials.js","/scripts/pwa-runtime.js","/styles/android-experience.css","/assets/3d/manifest.json","/assets/3d/licenses.json","/engine/license-registry.js","/creditos.html","/assets/art/landing-kingdom.svg","/assets/art/heroes/portraits.svg","/assets/art/skins/pantheon-relics.svg","/styles/heroes.css","/engine/asset-loader.js","/engine/resource-disposal.js","/engine/texture-manager.js","/equipment-ui.html","/equipment-system.js","/equipment-styles.css","/admin.html","/valhalla-admin-ui.js","/styles/valhalla-admin.css","/valhalla-shop-ui.js","/styles/valhalla-shop.css","/player-engagement.js","/apoie.html","/navigation.js","/styles/navigation.css","/alliance.html","/styles/coi-theme.css","/manifest.json","/icon-192.svg","/icon-512.svg","/favicon.svg","/logo.svg","/styles/premium-ui.css","/scripts/ambient-particles.js","/scripts/advanced-shaders.js","/offline.html","/styles/kingdom-4x-command.css","/scripts/kingdom-command-hud.js","/scripts/kingdom-command-state.js","/scripts/eldoria-realtime-client.js","/market.html","/market.css","/market.js","/scripts/kingdom-visual-boot.js","/scripts/kingdom-visual-preferences.js","/scripts/world-map-visual-boot.js"];
// O shell 2D mínimo deve ser atômico: se falhar, o Service Worker antigo
// continua ativo. Three.js e imagens são opcionais e nunca bloqueiam a instalação.
async function precacheApplicationShell() {
 const cache = await caches.open(CACHE_NAME);
 const required = ["/index.html", "/kingdom.html", "/offline.html"];
 // Cache.addAll does not honor Cache-Control: private/no-store or Set-Cookie.
 // Fetch anonymously and inspect *each response* before writing to storage.
 // A rejected essential response blocks this SW install; the older SW remains active.
 for (const path of required) {
  // Allow same-origin canonical redirects (/index.html -> /index), but never cache an external response.
  const response = await fetch(path, { cache: "no-store", credentials: "omit" });
  if (!canStoreResponse(response)) throw new Error("Shell essencial nao armazenavel: " + path);
  await cache.put(path, response.clone());
 }
 const manifestPath = "/vendor/three/asset-manifest.json";
 let vendorAssets = [];
 try {
  const response = await fetch(manifestPath, { cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error("Manifesto Three.js local indisponível.");
  const manifest = await response.json();
  if (manifest?.format !== 1 || manifest?.threeVersion !== "0.187.0" || !Array.isArray(manifest.assets)
    || !manifest.assets.every(path => typeof path === "string" && path.startsWith("/vendor/three/") && !path.includes(".."))) {
   throw new Error("Manifesto Three.js inválido ou incompatível.");
  }
  vendorAssets = [manifestPath, ...manifest.assets];
 } catch (error) {
  console.warn("Clash of Izzy: pré-cache 3D opcional indisponível.", String(error));
 }
 const optional = [...new Set([...CORE_ASSETS, ...vendorAssets])].filter(path => !required.includes(path));
 let failures = 0;
 // Limitar a 4 downloads simultâneos para evitar picos no Android.
 for (let index = 0; index < optional.length; index += 4) {
  const results = await Promise.allSettled(optional.slice(index, index + 4).map(async path => {
   // Cache.addAll() não verifica Cache-Control; nunca salvar páginas privadas.
   const response = await fetch(path, { cache: "no-store", credentials: "omit" });
   if (!canStoreResponse(response)) throw new Error("Recurso não armazenável.");
   await cache.put(path, response.clone());
  }));
  failures += results.filter(result => result.status === "rejected").length;
 }
 if (failures) console.warn("Clash of Izzy: recursos opcionais não armazenados:", failures);
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

// Cloudflare serves .html assets at clean URLs (e.g. /kingdom.html -> /kingdom).
// Match only explicitly listed public shell pages, never arbitrary paths.
function shellCacheKey(pathname) {
  if (CORE_ASSETS.includes(pathname)) return pathname;
  const bare = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const htmlPath = bare + ".html";
  return CORE_ASSETS.includes(htmlPath) ? htmlPath : null;
}
function isShellPath(pathname) {
  return shellCacheKey(pathname) !== null;
}

function isRuntimeAsset(pathname) {
  return (pathname.startsWith("/assets/") || pathname.startsWith("/vendor/three/")) && RUNTIME_ASSET_PATTERN.test(pathname);
}

function canStoreResponse(response) {
  if (!response || response.status !== 200 || response.type !== "basic") return false;
  // Both static files and redirected canonical URLs must remain on this Worker origin.
  if (response.url) {
    try { if (new URL(response.url).origin !== self.location.origin) return false; }
    catch { return false; }
  }
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
        // Never persist live navigation HTML. It may contain account data, and
        // the browser intentionally hides Set-Cookie from Response.headers.
        // The anonymous install snapshot supplies the offline shell instead.
        return await fetch(request);
      } catch {
        // The shell is stored under pathname only. Client-side routes retain
        // their query parameters in the browser even while offline.
        return (await caches.match(shellCacheKey(url.pathname) || url.pathname)) ||
          (await caches.match("/offline.html")) ||
          new Response("Sem conexão. Reconecte-se para abrir o Clash of Izzy.", {
            status: 503, headers: { "content-type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  // The shell is precached at install. Only bounded static assets may be added
  // at runtime, avoiding unbounded query variants and accidental private data.
  if (url.search || (!isShellPath(url.pathname) && !isRuntimeAsset(url.pathname))) return;
  event.respondWith((async () => {
    const cacheKey = shellCacheKey(url.pathname) || url.pathname;
    const cached = await caches.match(cacheKey);
    if (cached) return cached;
    const response = await fetch(request);
    // Avoid persisting live HTML via fetch('/kingdom') either: only the
    // anonymous install can write HTML into the shell cache.
    const isHtmlDocument = cacheKey === "/" || cacheKey.endsWith(".html");
    if (!isHtmlDocument && canStoreResponse(response)) {
      try {
        const runtime = isRuntimeAsset(url.pathname) && !isShellPath(url.pathname);
        const cache = await caches.open(runtime ? RUNTIME_CACHE_NAME : CACHE_NAME);
        await cache.put(cacheKey, response.clone());
        if (runtime) await limitRuntimeCache(cache);
      } catch {
        // Cache errors must not block the successfully fetched static resource.
      }
    }
    return response;
  })());
});
