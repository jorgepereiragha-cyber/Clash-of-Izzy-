import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("global navigation exposes only implemented public destinations", async () => {
  const nav = await readFile(new URL("../navigation.js", import.meta.url), "utf8");
  for (const route of ["/index.html", "/kingdom.html", "/arena.html", "/alliance.html"]) {
    assert.ok(nav.includes('href:"' + route + '"'), "missing route " + route);
  }
  assert.match(nav, /role","search|role="search"/);
  assert.match(nav, /aria-current/);
  assert.match(nav, /textContent/);
});

test("all primary screens load the shared navigation and stylesheet", async () => {
  for (const page of ["index.html", "kingdom.html", "arena.html", "alliance.html", "admin.html"]) {
    const html = await readFile(new URL("../" + page, import.meta.url), "utf8");
    assert.ok(html.includes("/navigation.js"), page + " missing navigation script");
    assert.ok(html.includes("/styles/navigation.css"), page + " missing navigation styles");
  }
});

test("service worker precaches navigation assets and rotates shell cache", async () => {
  const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /clash-of-izzy-shell-v2/);
  assert.match(sw, /"\/navigation.js"/);
  assert.match(sw, /"\/styles\/navigation.css"/);
});
