const CACHE_NAME="clash-of-izzy-shell-v29";
const CORE_ASSETS=["/portal.html","/","/index.html","/account.html","/arena.html","/kingdom.html","/world.html","/world-map.js","/world-map-3d.js","/world-map-viewport.js","/rally-ui.js","/styles/rally.css","/events.html","/events.js","/scripts/kingdom-3d.js","/scripts/kingdom-quality.js","/scripts/cinematic/capture-system.js","/scripts/cinematic/media-recorder-support.js","/scripts/cinematic/trailer-script.js","/scripts/cinematic/recorder-ui.js","/assets/3d/manifest.json","/engine/asset-loader.js","/engine/resource-disposal.js","/engine/texture-manager.js","/equipment-ui.html","/equipment-system.js","/equipment-styles.css","/admin.html","/valhalla-admin-ui.js","/styles/valhalla-admin.css","/valhalla-shop-ui.js","/styles/valhalla-shop.css","/navigation.js","/styles/navigation.css","/alliance.html","/styles/coi-theme.css","/styles/landing.css","/landing.js","/manifest.json","/icon-192.svg","/icon-512.svg","/favicon.svg","/logo.svg","/styles/premium-ui.css","/icons/premium-icons.svg","/splash-screen.html","/scripts/ambient-particles.js","/scripts/advanced-shaders.js","/scripts/post-processing.js","/offline.html"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_ASSETS)).then(()=>self.skipWaiting()));
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
  return pathname.startsWith("/assets/") && RUNTIME_ASSET_PATTERN.test(pathname);
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
        return (await caches.match(url.pathname)) || (await caches.match("/offline.html"));
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
    const response = await fetch(request);
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
