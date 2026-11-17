import { test, expect } from "@playwright/test";

// The general UI suite blocks Service Workers to keep API mocking deterministic.
// This isolated spec opts in so it can validate the real PWA lifecycle.
test.use({ serviceWorkers: "allow" });

const SHELL_CACHE = "clash-of-izzy-shell-v31";
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

  await page.goto("/offline.html");
  await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
});
