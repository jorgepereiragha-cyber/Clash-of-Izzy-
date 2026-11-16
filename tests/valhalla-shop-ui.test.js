import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFile(path.join(root, file), "utf8");

const [ui, css, kingdom, world, world3d, kingdom3d, worker] = await Promise.all([
  read("valhalla-shop-ui.js"),
  read("styles/valhalla-shop.css"),
  read("kingdom.html"),
  read("world.html"),
  read("world-map-3d.js"),
  read("scripts/kingdom-3d.js"),
  read("worker.js"),
]);

test("Loja Valhalla é carregada nas telas do reino e do mapa mundial", () => {
  for (const html of [kingdom, world]) {
    assert.ok(html.includes('/styles/valhalla-shop.css'));
    assert.ok(html.includes('/valhalla-shop-ui.js'));
  }
  assert.ok(kingdom.includes('/scripts/kingdom-3d.js'));
  assert.ok(world.includes('/world-map-3d.js'));
});

test("interface usa as rotas autenticadas reais e não cria um segundo contrato de sessão", () => {
  assert.ok(ui.includes('const API = "/api/game/valhalla-shop"'));
  assert.ok(ui.includes('const CONFIG = "/api/config/valhalla"'));
  assert.ok(ui.includes('localStorage.getItem("coi_game_token")'));
  assert.ok(ui.includes('sessionStorage.getItem("coi_game_token")'));
  assert.ok(ui.includes('API + "/catalog"'));
  assert.ok(ui.includes('API + "/buy"'));
  assert.ok(ui.includes('API + "/history"'));
  assert.ok(worker.includes('/api/game/valhalla-shop/'));
  assert.ok(!ui.includes("apiFetch("));
});

test("renderização da loja não injeta nome ou descrição do catálogo como HTML", () => {
  assert.ok(ui.includes("document.createElement"));
  assert.ok(ui.includes("textContent"));
  assert.ok(!ui.includes("innerHTML"));
  assert.ok(ui.includes('setAttribute("aria-modal", "true")'));
  assert.ok(ui.includes('setAttribute("aria-live", "polite")'));
});

test("retry de compra preserva request_key para impedir recompensa duplicada", () => {
  assert.ok(ui.includes("button.dataset.requestKey || makeRequestKey()"));
  assert.ok(ui.includes("button.dataset.requestKey = requestKey"));
  assert.ok(ui.includes("delete button.dataset.requestKey"));
  assert.ok(ui.includes("busy = false;\n      await loadCatalog();"));
});

test("efeitos de Valhalla são aplicados pelos renderizadores Three.js reais", () => {
  assert.ok(ui.includes('new CustomEvent("coi:valhalla-mode"'));
  assert.ok(world3d.includes('window.addEventListener("coi:valhalla-mode"'));
  assert.ok(world3d.includes("window.__coiWorldMap3D"));
  assert.ok(world3d.includes("setValhallaMode"));
  assert.ok(kingdom3d.includes('window.addEventListener("coi:valhalla-mode"'));
  assert.ok(kingdom3d.includes("window.__coiKingdomValhallaMode"));
  assert.ok(ui.includes("window.__coiWorldMap3D?.setValhallaMode"));
  assert.ok(ui.includes("window.__coiKingdomValhallaMode"));
  assert.ok(!ui.includes("window.map3d"));
});

test("loja mantém layout adaptado a telas pequenas e movimento reduzido", () => {
  assert.ok(css.includes("@media(max-width:620px)"));
  assert.ok(css.includes("@media(max-width:360px)"));
  assert.ok(css.includes("env(safe-area-inset-bottom)"));
  assert.ok(css.includes("100dvh"));
  assert.ok(css.includes("prefers-reduced-motion:reduce"));
});

test("scripts novos e renderizadores Three.js passam pelo parser Node", () => {
  for (const file of ["valhalla-shop-ui.js", "world-map-3d.js", "scripts/kingdom-3d.js"]) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    assert.equal(result.status, 0, file + " deve ser sintaticamente válido.\n" + result.stderr);
  }
});
