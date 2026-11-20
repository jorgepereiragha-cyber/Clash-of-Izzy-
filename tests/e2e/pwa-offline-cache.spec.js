import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

// The general UI suite blocks Service Workers to keep API mocking deterministic.
// This isolated spec opts in so it can validate the real PWA lifecycle.
test.use({ serviceWorkers: "allow" });

const serviceWorkerSource = await readFile(new URL("../../sw.js", import.meta.url), "utf8");
const SHELL_CACHE = serviceWorkerSource.match(/const CACHE_NAME="(clash-of-izzy-shell-v\d+)"/)?.[1];
if (!SHELL_CACHE) throw new Error("Não foi possível identificar o cache ativo do Service Worker.");
const CACHED_MODEL = "/assets/3d/kenney/castle-kit/Models/GLB%20format/tower-square.glb";

test("PWA activates its Service Worker and serves previously cached shell and GLB offline", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("CLASH OF IZZY");

  // The landing page registers /sw.js after load. Wait for activation, then
  // reload once so this document is controlled by the newly installed worker.
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return registration?.active?.state === "activated";
  });
  await page.reload();
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith("/sw.js") === true
  );

  const shellState = await page.evaluate(async cacheName => {
    const names = await caches.keys();
    const cache = await caches.open(cacheName);
    return {
      present: names.includes(cacheName),
      offlinePage: Boolean(await cache.match("/offline.html")),
      manifest: Boolean(await cache.match("/manifest.json")),
      kingdomArtwork: Boolean(await cache.match("/assets/art/landing-kingdom.svg")),
      pantheonArtwork: Boolean(await cache.match("/assets/art/skins/pantheon-relics.svg")),
      androidRuntime: Boolean(await cache.match("/scripts/pwa-runtime.js")),
      androidStyles: Boolean(await cache.match("/styles/android-experience.css")),
      eventsCatalog: Boolean(await cache.match("/event-catalog.js")),
      eventsStyles: Boolean(await cache.match("/styles/events-hub.css")),
      shivaArtwork: Boolean(await cache.match("/assets/art/events/shiva.svg")),
      khaliArtwork: Boolean(await cache.match("/assets/art/events/khali.svg")),
    };
  }, SHELL_CACHE);

  expect(shellState.present).toBe(true);
  expect(shellState.offlinePage).toBe(true);
  expect(shellState.manifest).toBe(true);
  expect(shellState.kingdomArtwork).toBe(true);
  expect(shellState.pantheonArtwork).toBe(true);
  expect(shellState.androidRuntime).toBe(true);
  expect(shellState.androidStyles).toBe(true);
  expect(shellState.eventsCatalog).toBe(true);
  expect(shellState.eventsStyles).toBe(true);
  expect(shellState.shivaArtwork).toBe(true);
  expect(shellState.khaliArtwork).toBe(true);

  const landingArtwork = await page.locator(".landing-kingdom-art").evaluate(image => ({ complete: image.complete, naturalWidth: image.naturalWidth }));
  expect(landingArtwork).toEqual({ complete: true, naturalWidth: 900 });

  // GLBs are cached at runtime by the existing same-origin Cache API strategy.
  const onlineModel = await page.evaluate(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("GLB online respondeu HTTP " + response.status);
    const bytes = await response.arrayBuffer();
    return { size: bytes.byteLength, contentType: response.headers.get("content-type") || "" };
  }, CACHED_MODEL);
  expect(onlineModel.size).toBeGreaterThan(20);
  expect(onlineModel.contentType).toMatch(/model\/gltf-binary|application\/octet-stream/i);

  await page.waitForFunction(async ({ cacheName, url }) => {
    const cache = await caches.open(cacheName);
    return Boolean(await cache.match(url));
  }, { cacheName: SHELL_CACHE, url: CACHED_MODEL });

  // This proves offline delivery of the shell and an already downloaded model.
  // It does not claim that authenticated gameplay or D1 synchronization work offline.
  await context.setOffline(true);

  const offlineModel = await page.evaluate(async url => {
    const response = await fetch(url);
    const bytes = await response.arrayBuffer();
    return { ok: response.ok, size: bytes.byteLength };
  }, CACHED_MODEL);

  expect(offlineModel.ok).toBe(true);
  expect(offlineModel.size).toBe(onlineModel.size);

  // Fetch the pre-cached offline document through the controlled page. This
  // exercises the Service Worker's Cache-First branch without asking Playwright
  // to start a second top-level navigation while its browser context is offline.
  const offlineShell = await page.evaluate(async () => {
    const response = await fetch("/offline.html");
    return {
      ok: response.ok,
      status: response.status,
      body: await response.text()
    };
  });
  expect(offlineShell.ok).toBe(true);
  expect(offlineShell.status).toBe(200);
  expect(offlineShell.body).toContain("<h1>Você está sem conexão</h1>");

  // Verify first-time module resolution while offline. The landing document
  // has not imported any modules yet, so its import map can be registered before
  // resolving the same-origin Three.js addon graph.
  const offlineThreeModules = await page.evaluate(async () => {
    const importMap = document.createElement("script");
    importMap.type = "importmap";
    importMap.textContent = JSON.stringify({
      imports: {
        three: "/vendor/three/build/three.module.js",
        "three/addons/": "/vendor/three/examples/jsm/"
      }
    });
    document.head.appendChild(importMap);

    const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/loaders/DRACOLoader.js"),
      import("three/addons/loaders/KTX2Loader.js"),
      import("three/addons/libs/meshopt_decoder.module.js")
    ]);
    await MeshoptDecoder.ready;
    return {
      gltf: typeof GLTFLoader === "function",
      draco: typeof DRACOLoader === "function",
      ktx2: typeof KTX2Loader === "function",
      meshopt: typeof MeshoptDecoder.decodeGltfBuffer === "function"
    };
  });
  expect(offlineThreeModules).toEqual({ gltf: true, draco: true, ktx2: true, meshopt: true });

  const offlineDecoders = await page.evaluate(async paths => {
    const results = [];
    for (const path of paths) {
      const response = await fetch(path);
      const bytes = await response.arrayBuffer();
      results.push({ path, ok: response.ok, size: bytes.byteLength });
    }
    return results;
  }, [
    "/vendor/three/examples/jsm/libs/draco/draco_wasm_wrapper.js",
    "/vendor/three/examples/jsm/libs/draco/draco_decoder.wasm",
    "/vendor/three/examples/jsm/libs/draco/draco_decoder.js",
    "/vendor/three/examples/jsm/libs/basis/basis_transcoder.js",
    "/vendor/three/examples/jsm/libs/basis/basis_transcoder.wasm"
  ]);
  expect(offlineDecoders.every(item => item.ok && item.size > 100)).toBe(true);
});
