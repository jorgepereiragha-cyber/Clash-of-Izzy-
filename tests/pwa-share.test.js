import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("public landing exposes promotional Android APK download only", async () => {
  const page = await read("portal.html");
  assert.match(page, /id="download-apk"/);
  assert.match(page, /assets\/brand\/royal-king\.webp/);
  assert.doesNotMatch(page, /id="play-now"|href="\/kingdom\.html"|beforeinstallprompt/);
});

test("obsolete landing assets are absent and no current HTML depends on them", async () => {
  for (const path of ["landing.js","styles/landing.css"]) {
    await assert.rejects(read(path), {code:"ENOENT"});
  }
  const {readdir}=await import("node:fs/promises");
  for(const dir of ["","public-portal/"]){
    const files=await readdir(new URL("../"+dir,import.meta.url));
    for(const file of files.filter(name=>name.endsWith(".html"))){
      assert.doesNotMatch(await read(dir+file),/landing\.js|styles\/landing\.css/,dir+file);
    }
  }
});

test("new landing assets invalidate the previous offline shell cache", async () => {
  const serviceWorker = await read("sw.js");
  const cacheVersion = Number(serviceWorker.match(/const CACHE_NAME="clash-of-izzy-shell-v(\d+)"/)?.[1] || 0);
  assert.ok(cacheVersion > 41, `expected a new shell cache above v41, got v${cacheVersion || "missing"}`);
  assert.ok(serviceWorker.includes('"/assets/art/skins/pantheon-relics.svg"'));
  assert.ok(serviceWorker.includes('"/index.html"'));
  assert.ok(serviceWorker.includes('"/portal.html"'));
  assert.doesNotMatch(serviceWorker,/landing\.js|styles\/landing\.css/);
  assert.ok(serviceWorker.includes('"/assets/art/heroes/portraits.svg"'));
  assert.ok(serviceWorker.includes('"/styles/heroes.css"'));
});

test("manifest opens the actual game as an installable standalone PWA", async () => {
  const manifest = JSON.parse(await read("manifest.json"));
  assert.equal(manifest.start_url, "/kingdom.html");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.short_name, "Clash of Izzy");
});
