const CACHE_NAME="clash-of-izzy-shell-v27";
const CORE_ASSETS=["/","/index.html","/account.html","/arena.html","/kingdom.html","/world.html","/world-map.js","/world-map-3d.js","/world-map-viewport.js","/rally-ui.js","/styles/rally.css","/events.html","/events.js","/scripts/kingdom-3d.js","/scripts/kingdom-quality.js","/scripts/cinematic/capture-system.js","/scripts/cinematic/media-recorder-support.js","/scripts/cinematic/trailer-script.js","/scripts/cinematic/recorder-ui.js","/assets/3d/manifest.json","/engine/asset-loader.js","/engine/resource-disposal.js","/engine/texture-manager.js","/equipment-ui.html","/equipment-system.js","/equipment-styles.css","/admin.html","/valhalla-admin-ui.js","/styles/valhalla-admin.css","/valhalla-shop-ui.js","/styles/valhalla-shop.css","/navigation.js","/styles/navigation.css","/alliance.html","/styles/coi-theme.css","/styles/landing.css","/landing.js","/manifest.json","/icon-192.svg","/icon-512.svg","/favicon.svg","/logo.svg","/styles/premium-ui.css","/icons/premium-icons.svg","/splash-screen.html","/scripts/ambient-particles.js","/scripts/advanced-shaders.js","/scripts/post-processing.js","/offline.html"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_ASSETS)).then(()=>self.skipWaiting()));
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