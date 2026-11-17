import { test, expect } from "@playwright/test";

// The general UI suite blocks Service Workers to keep API mocking deterministic.
// This isolated spec opts in so it can validate the real PWA lifecycle.
test.use({ serviceWorkers: "allow" });

const SHELL_CACHE = "clash-of-izzy-shell-v32";
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
    };
  }, SHELL_CACHE);

  expect(shellState.present).toBe(true);
  expect(shellState.offlinePage).toBe(true);
  expect(shellState.manifest).toBe(true);

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

  // The renderer, loaders and decoder binaries must remain usable offline.
  // Open the kingdom page so its import map resolves the same-origin modules.
  await page.goto("/kingdom.html");
  const offlineThreeModules = await page.evaluate(async () => {
    const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
      import("/vendor/three/examples/jsm/loaders/GLTFLoader.js"),
      import("/vendor/three/examples/jsm/loaders/DRACOLoader.js"),
      import("/vendor/three/examples/jsm/loaders/KTX2Loader.js"),
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
    "/vendor/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js",
    "/vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm",
    "/vendor/three/examples/jsm/libs/basis/basis_transcoder.js",
    "/vendor/three/examples/jsm/libs/basis/basis_transcoder.wasm"
  ]);
  expect(offlineDecoders.every(item => item.ok && item.size > 100)).toBe(true);
});
