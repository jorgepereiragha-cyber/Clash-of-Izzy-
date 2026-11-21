import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pages = [
  "index.html",
  "kingdom.html",
  "world.html",
  "alliance.html",
  "arena.html",
  "account.html",
  "events.html"
];

test("all public Android game screens load the adaptive stylesheet and shared PWA runtime", async () => {
  for (const page of pages) {
    const html = await readFile(new URL("../" + page, import.meta.url), "utf8");
    assert.match(html, /styles\/android-experience\.css/, page + " missing Android stylesheet");
    assert.match(html, /scripts\/pwa-runtime\.js/, page + " missing shared runtime");
  }
});

test("Android stylesheet defines accessible touch targets, safe areas and dynamic viewport support", async () => {
  const css = await readFile(new URL("../styles/android-experience.css", import.meta.url), "utf8");
  assert.match(css, /--coi-min-touch-target:\s*48px/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /min-height:\s*100svh/);
  assert.match(css, /input:not\(\[type="checkbox"\]\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test("PWA runtime reports offline state, dispatches app-resume and does not force-reload after updates", async () => {
  const runtime = await readFile(new URL("../scripts/pwa-runtime.js", import.meta.url), "utf8");
  assert.match(runtime, /window\.addEventListener\("offline"/);
  assert.match(runtime, /window\.addEventListener\("online"/);
  assert.match(runtime, /coi:app-resume/);
  assert.match(runtime, /Nova versão pronta/);
  assert.match(runtime, /updateButton\.addEventListener\("click", \(\) => window\.location\.reload\(\)\)/);
  assert.doesNotMatch(runtime, /controllerchange[\s\S]{0,180}location\.reload\(\)/);
  assert.doesNotMatch(runtime, /registration\.update\(\)/);
});

test("world map supports one-finger pan, two-finger pinch, and safe pointer release", async () => {
  const world = await readFile(new URL("../world-map.js", import.meta.url), "utf8");
  assert.match(world, /const activeMapPointers = new Map\(\)/);
  assert.match(world, /mapPinchStart = \{/);
  assert.match(world, /mapPinchStart\.zoom \* \(distance \/ mapPinchStart\.distance\)/);
  assert.match(world, /setPointerCapture\(event\.pointerId\)/);
  assert.match(world, /releasePointerCapture\(pointerId\)/);
  assert.match(world, /coi:app-resume/);
});

test("world map renderer pauses when backgrounded and is adaptive to pixel budget and Android resume", async () => {
  const scene = await readFile(new URL("../world-map-3d.js", import.meta.url), "utf8");
  assert.match(scene, /function canAnimateMarches\(\)/);
  assert.match(scene, /!document\.hidden && sceneInViewport/);
  assert.match(scene, /new IntersectionObserver/);
  assert.match(scene, /pixelBudgetRatio/);
  assert.match(scene, /window\.addEventListener\("pageshow"/);
});


test("PWA cache does not retain the orphan splash page", async () => {
  const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.doesNotMatch(serviceWorker, /splash-screen\.html/);
});


test("PWA caches the active ambient layer without retaining deleted public modules or pages", async () => {
  const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(serviceWorker, /scripts\/ambient-particles\.js/);
  assert.doesNotMatch(serviceWorker, /post-processing\.js/);
  assert.doesNotMatch(serviceWorker, /splash-screen\.html/);
});


test("public asset filters exclude build-only Node diagnostics but keep the runtime", async () => {
  const ignore = await readFile(new URL("../.assetsignore", import.meta.url), "utf8");
  for (const tool of [
    "scripts/diagnose-production-endpoint.js",
    "scripts/production-smoke.js",
    "scripts/validate-3d-assets.js",
    "scripts/validate-core-loop.sh",
  ]) assert.ok(ignore.split(/\r?\n/).includes(tool), "public asset exclusion missing: " + tool);

  const runtime = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  for (const browserModule of [
    "/scripts/ambient-particles.js",
    "/scripts/kingdom-3d.js",
    "/scripts/kingdom-visual-boot.js",
    "/scripts/world-map-visual-boot.js",
    "/scripts/kingdom-visual-preferences.js",
    "/scripts/pwa-runtime.js",
  ]) assert.ok(runtime.includes(browserModule), "active browser module not cached: " + browserModule);
});


test("kingdom, events and Valhalla pause visual timers and network polling while backgrounded", async () => {
  const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  const events = await readFile(new URL("../events.js", import.meta.url), "utf8");
  const shop = await readFile(new URL("../valhalla-shop-ui.js", import.meta.url), "utf8");

  assert.match(kingdom, /function stopQueueTimers\(\)/);
  assert.match(kingdom, /window\.clearInterval\(queueClockTimer\)/);
  assert.match(kingdom, /window\.clearInterval\(queueRefreshTimer\)/);
  assert.match(kingdom, /window\.addEventListener\("pagehide",stopQueueTimers\)/);
  assert.match(kingdom, /window\.addEventListener\("pageshow"/);
  assert.match(events, /function stopEventTimers\(\)/);
  assert.match(events, /clearInterval\(countdownTimer\)/);
  assert.match(events, /clearInterval\(eventRefreshTimer\)/);
  assert.match(shop, /function stopPolling\(\)/);
  assert.match(shop, /window\.clearInterval\(pollHandle\)/);
  assert.match(shop, /document\.addEventListener\("visibilitychange"/);
});
