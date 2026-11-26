import test from "node:test";
import assert from "node:assert/strict";
import { forEachPeriodicSurfaceCell } from "../scripts/kingdom-materials.js";

for (const kind of ["stone", "roof", "road"]) {
  test(kind + " covers one periodic tile without overlap or gaps", () => {
    const coverage = new Uint8Array(128 * 128);
    let logical = 0, wrapped = 0;
    forEachPeriodicSurfaceCell(kind, ({positions, y, width, height}) => {
      logical++;
      if (positions.length === 2) {
        wrapped++;
        assert.equal(positions[0] - positions[1], 128);
      }
      for (const x of positions) {
        for (let j = y; j < y + height; j++) {
          for (let i = Math.max(0, x); i < Math.min(128, x + width); i++) {
            coverage[j * 128 + i]++;
          }
        }
      }
    });
    assert.equal(logical, kind === "roof" ? 64 : 32);
    assert.equal(wrapped, 4);
    assert.ok(coverage.every(value => value === 1));
  });
}
test("invalid surface grids are rejected", () => {
  assert.throws(() => forEachPeriodicSurfaceCell("unknown", () => {}), TypeError);
  assert.throws(() => forEachPeriodicSurfaceCell("stone", null), TypeError);
});
