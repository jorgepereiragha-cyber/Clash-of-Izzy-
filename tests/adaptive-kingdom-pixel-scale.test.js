import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAdaptivePixelScaleController } from "../scripts/kingdom-quality.js";

const frames = (controller, ms, count) => {
  let changes = 0;
  for (let i = 0; i < count; i++) if (controller.observe(ms)) changes++;
  return changes;
};

test("adaptive pixel scale holds full quality until slow frames persist", () => {
  const adaptive = createAdaptivePixelScaleController({ sampleWindow: 30 });
  assert.equal(adaptive.scale, 1);
  assert.equal(frames(adaptive, 35, 29), 0);
  assert.equal(adaptive.scale, 1);
  assert.equal(frames(adaptive, 35, 1), 1);
  assert.equal(adaptive.scale, 0.9);
  assert.equal(frames(adaptive, 35, 120), 2); // Minimum is reached, no more changes.
  assert.equal(adaptive.scale, 0.7);
});

test("resolution recovers gradually without flicker when frames are consistently fast", () => {
  const adaptive = createAdaptivePixelScaleController({ sampleWindow: 30 });
  frames(adaptive, 35, 90);
  assert.equal(adaptive.scale, 0.7);
  assert.equal(frames(adaptive, 16.67, 89), 0);
  assert.equal(frames(adaptive, 16.67, 1), 1);
  assert.equal(adaptive.scale, 0.75);
  assert.equal(frames(adaptive, 16.67, 450), 5);
  assert.equal(adaptive.scale, 1);
});

test("occasional jank and background gaps do not lower visual quality", () => {
  const adaptive = createAdaptivePixelScaleController({ sampleWindow: 30 });
  frames(adaptive, 16.67, 29);
  assert.equal(adaptive.observe(2500), false);
  assert.equal(frames(adaptive, 16.67, 29), 0);
  assert.equal(adaptive.observe(35), false);
  assert.equal(adaptive.scale, 1);
  assert.equal(frames(adaptive, 16.67, 30), 0);
  assert.equal(adaptive.scale, 1);
});

test("pausing clears timing samples but retains the previous safe resolution", () => {
  const adaptive = createAdaptivePixelScaleController({ sampleWindow: 30 });
  frames(adaptive, 35, 30);
  assert.equal(adaptive.scale, 0.9);
  frames(adaptive, 35, 29);
  adaptive.reset();
  assert.equal(adaptive.scale, 0.9);
  frames(adaptive, 16.67, 30);
  assert.equal(adaptive.scale, 0.9);
});

test("renderer only applies automatic DPR while preserving manual settings and cinematic capture", () => {
  const source = readFileSync(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
  assert.match(source, /automaticGraphics = preferredTier === "auto"/);
  assert.match(source, /automaticGraphics && adaptivePixelScale\.observe\(interval\)/);
  assert.match(source, /automaticGraphics \? adaptivePixelScale\.scale : 1/);
  assert.match(source, /if \(cinematicCaptureActive \|\| !renderer/);
  assert.match(source, /adaptivePixelScale\.reset\(\)/);
});
