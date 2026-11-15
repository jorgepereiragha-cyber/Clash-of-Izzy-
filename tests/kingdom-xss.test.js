import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");

test("kingdom escapes database-controlled values before inserting them into HTML", () => {
  assert.match(html, /const esc=value=>String\(value\?\?""\)/);
  assert.match(html, /esc\(b\.building_type\)/);
  assert.match(html, /esc\(emoji\).*esc\(name\)/);
  assert.match(html, /esc\(a\).*esc\(b\)/);
  assert.match(html, /esc\(String\(e\.event_type/);
});

test("kingdom identity labels continue using textContent", () => {
  assert.match(html, /getElementById\("kingdomName"\)\.textContent/);
  assert.match(html, /getElementById\("playerName"\)\.textContent/);
});
