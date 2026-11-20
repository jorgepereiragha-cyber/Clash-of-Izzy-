import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("landing page exposes an accessible direct-share control", async () => {
  const html = await read("index.html");
  const script = await read("landing.js");
  assert.ok(html.includes('id="share-game-button"'));
  assert.ok(html.includes('id="share-game-status"'));
  assert.ok(script.includes('shareButton?.addEventListener("click", shareGame)'));
});

test("PWA sharing uses the OS share sheet with safe fallbacks and preserves referral codes", async () => {
  const script = await read("landing.js");
  assert.ok(script.includes('typeof navigator.share === "function"'));
  assert.ok(script.includes("navigator.share(payload)"));
  assert.ok(script.includes("navigator.clipboard.writeText(shareUrl)"));
  assert.ok(script.includes("https://wa.me/?text="));
  assert.ok(script.includes("/^izzy_[a-f0-9]{32}$/"));
});

test("manifest opens the actual game as an installable standalone PWA", async () => {
  const manifest = JSON.parse(await read("manifest.json"));
  assert.equal(manifest.start_url, "/kingdom.html");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.short_name, "Clash of Izzy");
});
