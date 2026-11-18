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
