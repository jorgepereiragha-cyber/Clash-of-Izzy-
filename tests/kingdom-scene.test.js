import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");

test("kingdom scene renders original procedural terrain and building silhouettes", () => {
  assert.match(kingdom, /function drawKingdomScene\(buildings\)/);
  assert.match(kingdom, /createLinearGradient/);
  assert.match(kingdom, /const palette=/);
  assert.match(kingdom, /drawKingdomScene\(buildings\)/);
  assert.match(kingdom, /id="kingdomScene"/);
});

test("kingdom canvas is responsive and caps device pixel ratio for mobile GPUs", () => {
  assert.match(kingdom, /Math\.min\(window\.devicePixelRatio\|\|1,1\.5\)/);
  assert.match(kingdom, /ResizeObserver/);
  assert.match(kingdom, /prefers-reduced-motion/);
  assert.match(kingdom, /pointer-events:none/);
});

test("procedural art keeps existing accessible building buttons and kingdom actions", () => {
  assert.match(kingdom, /data-building=/);
  assert.match(kingdom, /data-upgrade=/);
  assert.match(kingdom, /function upgrade\(building\)/);
  assert.match(kingdom, /aria-hidden="true"/);
});
