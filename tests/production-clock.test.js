import test from "node:test";
import assert from "node:assert/strict";
import { productionWindow } from "../production-clock.js";

test("frequent settlement does not discard fractional seconds", () => {
  let last = 0, credited = 0;
  for (let i = 1; i <= 10; i++) {
    const result = productionWindow(i * 1900, last);
    credited += result.elapsed;
    if (result.elapsed) last = Date.parse(result.timestamp);
  }
  assert.equal(credited, 19);
  assert.equal(last, 19000);
});

test("subsecond, invalid and future timestamps do not grant resources", () => {
  for (const last of [1500, 2500, NaN]) {
    assert.equal(productionWindow(2000, last).elapsed, 0);
  }
});

test("offline catch-up remains limited to seven days", () => {
  const now = 9 * 86400000 + 789;
  const result = productionWindow(now, 0);
  assert.equal(result.elapsed, 7 * 86400);
  assert.equal(Date.parse(result.timestamp), now - 789);
  assert.equal(productionWindow(now + 211, Date.parse(result.timestamp)).elapsed, 1);
});
