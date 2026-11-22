import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("public landing exposes promotional Android APK download only", async () => {
  const page = await read("portal.html");
  assert.match(page, /id="download-apk"/);
  assert.match(page, /assets\/brand\/hero-emblem\.svg/);
  assert.doesNotMatch(page, /id="play-now"|href="\/kingdom\.html"|beforeinstallprompt/);
});

test("PWA sharing uses the OS share sheet with safe fallbacks and preserves referral codes", async () => {
  const script = await read("landing.js");
  assert.ok(script.includes('typeof navigator.share === "function"'));
  assert.ok(script.includes("navigator.share(payload)"));
  assert.ok(script.includes("navigator.clipboard.writeText(shareUrl)"));
  assert.ok(script.includes("https://wa.me/?text="));
  assert.ok(script.includes("/^izzy_[a-f0-9]{32}$/"));
});

test("new landing assets invalidate the previous offline shell cache", async () => {
  const serviceWorker = await read("sw.js");
  const cacheVersion = Number(serviceWorker.match(/const CACHE_NAME="clash-of-izzy-shell-v(\d+)"/)?.[1] || 0);
  assert.ok(cacheVersion > 41, `expected a new shell cache above v41, got v${cacheVersion || "missing"}`);
  assert.ok(serviceWorker.includes('"/assets/art/skins/pantheon-relics.svg"'));
  assert.ok(serviceWorker.includes('"/index.html"'));
  assert.ok(serviceWorker.includes('"/landing.js"'));
  assert.ok(serviceWorker.includes('"/assets/art/heroes/portraits.svg"'));
  assert.ok(serviceWorker.includes('"/styles/heroes.css"'));
});

test("manifest opens the actual game as an installable standalone PWA", async () => {
  const manifest = JSON.parse(await read("manifest.json"));
  assert.equal(manifest.start_url, "/kingdom.html");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.short_name, "Clash of Izzy");
});
