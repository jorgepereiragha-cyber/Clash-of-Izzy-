import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateKingdomFrameZoom } from "../scripts/kingdom-quality.js";

test("câmera ortográfica enquadra a mesma cidade em Android estreito", () => {
  const city = { sceneWidth: 14, sceneHeight: 9 };
  const wide = calculateKingdomFrameZoom({ viewWidth: 24, viewHeight: 12.8, ...city });
  const narrow = calculateKingdomFrameZoom({ viewWidth: 7, viewHeight: 12.8, ...city });
  assert.equal(wide, 1);
  assert.ok(narrow < wide);
  assert.ok(14 * narrow <= 7 * 0.84 + 1e-9);
  assert.ok(9 * narrow <= 12.8 * 0.84 + 1e-9);
});

test("enquadramento respeita limite vertical de prédios altos", () => {
  const zoom = calculateKingdomFrameZoom({
    viewWidth: 24, viewHeight: 10, sceneWidth: 10, sceneHeight: 18
  });
  assert.ok(Math.abs(zoom - (10 * 0.84 / 18)) < 1e-9);
});

test("parâmetros inválidos não geram zoom infinito ou NaN", () => {
  for (const input of [
    {}, { viewWidth: 0, viewHeight: 12, sceneWidth: 8, sceneHeight: 8 },
    { viewWidth: Infinity, viewHeight: 12, sceneWidth: 8, sceneHeight: 8 },
    { viewWidth: 12, viewHeight: 12, sceneWidth: -2, sceneHeight: 8 }
  ]) assert.equal(calculateKingdomFrameZoom(input), 1);
});

test("resize do reino recalcula câmera antes de projetar áreas de toque", async () => {
  const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
  const begin = renderer.indexOf("const resize = () => {");
  const end = renderer.indexOf("cinematicApi = Object.freeze", begin);
  assert.ok(begin >= 0 && end > begin);
  const resize = renderer.slice(begin, end);
  assert.match(resize, /frameCityBuildings\(latestBuildings\.slice\(0, Math\.min\(9, qualityProfile\?\.maxBuildings \|\| 9\)\)\)/);
  assert.ok(resize.indexOf("frameCityBuildings") < resize.indexOf("publishBuildingHitTargets"));
  assert.match(renderer, /applyMatrix4\(camera\.matrixWorldInverse\)/);
  assert.match(renderer, /calculateKingdomFrameZoom\(/);
});
