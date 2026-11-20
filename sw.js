const CACHE_NAME="clash-of-izzy-shell-v42";
const CORE_ASSETS=["/","/index.html","/account.html","/arena.html","/kingdom.html","/world.html","/world-map.js","/world-map-3d.js","/world-map-viewport.js","/rally-ui.js","/styles/rally.css","/events.html","/events.js","/event-catalog.js","/styles/events-hub.css","/assets/art/events/angel-of-death.svg","/assets/art/events/valhalla.svg","/assets/art/events/wild-hunt.svg","/assets/art/events/shiva.svg","/assets/art/events/khali.svg","/assets/art/events/siege-of-eldoria.svg","/assets/art/events/champions-tournament.svg","/scripts/kingdom-3d.js","/scripts/kingdom-quality.js","/scripts/kingdom-materials.js","/scripts/pwa-runtime.js","/styles/android-experience.css","/scripts/cinematic/capture-system.js","/scripts/cinematic/media-recorder-support.js","/scripts/cinematic/trailer-script.js","/scripts/cinematic/recorder-ui.js","/assets/3d/manifest.json","/assets/art/landing-kingdom.svg","/assets/art/heroes/portraits.svg","/assets/art/skins/pantheon-relics.svg","/styles/heroes.css","/engine/asset-loader.js","/engine/resource-disposal.js","/engine/texture-manager.js","/equipment-ui.html","/equipment-system.js","/equipment-styles.css","/admin.html","/valhalla-admin-ui.js","/styles/valhalla-admin.css","/valhalla-shop-ui.js","/styles/valhalla-shop.css","/navigation.js","/styles/navigation.css","/alliance.html","/styles/coi-theme.css","/styles/landing.css","/landing.js","/manifest.json","/icon-192.svg","/icon-512.svg","/favicon.svg","/logo.svg","/styles/premium-ui.css","/scripts/ambient-particles.js","/scripts/advanced-shaders.js","/offline.html"];
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
 await cache.addAll([...CORE_ASSETS, manifestPath, ...manifest.assets]);
 await self.skipWaiting();
}
self.addEventListener("install", event => {
 event.waitUntil(precacheApplicationShell());
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("clash-of-izzy-shell-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(async response=>{
   if(response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone());}
   return response;
  }).catch(async()=>await caches.match(request)||await caches.match("/offline.html")));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>{
  if(cached)return cached;
  return fetch(request).then(async response=>{
   if(response.ok&&response.type==="basic"){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone());}
   return response;
  });
 }));
});
