import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = name => readFile(new URL(name, import.meta.url), "utf8");
const [renderer, fourxCss, cityCss, backup, defenseEditor, buildingEditor] = await Promise.all([
  load("../scripts/kingdom-3d.js"),
  load("../styles/kingdom-4x-systems.css"),
  load("../styles/city-layout.css"),
  load("../scripts/backup-d1-production.sh"),
  load("../scripts/kingdom-4x-systems.js"),
  load("../scripts/city-layout-editor.js")
]);

test("ambos os canvases 4X capturam o gesto sem scroll/zoom acidental", () => {
  assert.match(fourxCss, /\.coi-4x-panel canvas\{[^}]*touch-action:none/);
  assert.match(cityCss, /\.coi-layout-panel canvas\{[^}]*touch-action:none/);
  assert.match(fourxCss, /prefers-reduced-motion: reduce/);
  assert.match(cityCss, /prefers-reduced-motion: reduce/);
});
test("HUD de FPS/draw calls nao aparece fora do ambiente de desenvolvimento", () => {
  assert.match(renderer, /window\.ENVIRONMENT !== "development"/);
  assert.match(renderer, /renderer\.info\.render\.calls/);
  assert.match(renderer, /animationFrameTiming\.snapshot\(\)/);
  assert.match(renderer, /stopDevelopmentStats\(\)/);
});
test("anéis de buff são meshes limitados e descartados com as figuras", () => {
  assert.match(renderer, /\.slice\(0,2\)/);
  assert.match(renderer, /new THREE\.RingGeometry/);
  assert.match(renderer, /disposeDetachedObject3D\(figure\)/);
});
test("listeners de Valhalla não permanecem após perda do WebGL", () => {
  assert.match(renderer, /valhallaModeHandler = event =>/);
  assert.match(renderer, /removeEventListener\("coi:valhalla-mode", valhallaModeHandler\)/);
});
test("backup D1 legado bloqueia export em banco FTS5 e exige workflow protegido", () => {
  assert.match(backup, /LEGADO DESATIVADO/);
  assert.match(backup, /Time Travel/);
  assert.match(backup, /Cloudflare Paid Readiness/);
  assert.match(backup, /exit 2/);
  assert.doesNotMatch(backup, /npx .*wrangler|wrangler d1 export|wrangler d1 migrations apply/);
});

test("grid aceita arraste por pointer capture, sem touch listeners passivos", () => {
  for (const editor of [defenseEditor, buildingEditor]) {
    assert.match(editor, /setPointerCapture/);
    assert.match(editor, /hasPointerCapture/);
    assert.match(editor, /pointermove/);
    assert.match(editor, /event\.preventDefault\(\)/);
  }
});
