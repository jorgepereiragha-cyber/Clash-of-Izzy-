import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pages = ["index.html", "kingdom.html", "alliance.html", "arena.html", "admin.html"];

test("todas as telas principais carregam a identidade visual compartilhada", async () => {
  for (const page of pages) {
    const html = await readFile(new URL("../" + page, import.meta.url), "utf8");
    assert.match(html, /href="\/styles\/coi-theme\.css"/, page + " deve carregar coi-theme.css");
  }
});

test("cidade 3D segue a bíblia visual com telhados azul-real e detalhes dourados", async () => {
  const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
  const bible = await readFile(new URL("../docs/biblia-visual-clash-of-izzy.md", import.meta.url), "utf8");
  assert.match(bible, /telhados azul-real e detalhes dourados/i);
  assert.match(renderer, /roof: material\("#24476B"\)/);
  assert.match(renderer, /\[mats\.roof, "#24476B", "roof"/);
  assert.match(renderer, /bannerMaterial=material\(skin\?\.banner\|\|"#E7BD68"/);
  assert.match(renderer, /const seal=new THREE\.Mesh\(new THREE\.CircleGeometry/);
  assert.match(renderer, /material\(skin\?\.seal\|\|"#24476B"/);
});

test("edifícios 3D possuem silhuetas e marcos próprios por função", async () => {
  const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
  for (const feature of [
    'type === "market"', 'type === "barracks"',
    'type === "academy"', 'type === "hospital"',
    'type === "archery_range"', 'type === "siege_workshop"',
    'type === "embassy"', 'type === "warehouse"', 'type === "stable"'
  ]) assert.ok(renderer.includes(feature), "marco arquitetônico ausente: " + feature);
  const rural=renderer.slice(renderer.indexOf("function addRuralBuilding"),renderer.indexOf("function createBuilding"));
  assert.match(renderer,/const ruralTypes=new Set\(\["farm","quarry","lumber_mill","iron_mine"\]\)/);
  assert.match(rural,/type==="farm"/);
  assert.match(rural,/type==="lumber_mill"/);
  assert.match(rural,/type==="iron_mine"/);
  assert.match(rural,/box\(group,\.86,\.30\+\.05\*stage,\.44,wall/);
  assert.match(rural,/new THREE\.DodecahedronGeometry/);
  assert.match(rural,/new THREE\.TorusGeometry/);
  assert.match(renderer, /emissiveIntensity: 0\.28/);
  assert.match(renderer, /new THREE\.DodecahedronGeometry/);
  assert.match(renderer, /new THREE\.TorusGeometry/);
});

test("alvos dos edifícios seguem a projeção isométrica real, inclusive após resize", async () => {
  const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
  const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  assert.match(renderer, /const \{ x, z \} = cityWorldPoint\(b, i\)/);
  assert.match(renderer, /frameCityBuildings\(list\)/);
  assert.match(renderer, /Math\.min\(16, qualityProfile\?\.maxBuildings \|\| 9\)/);
  assert.match(renderer, /function publishBuildingHitTargets\(buildings = latestBuildings\)/);
  assert.match(renderer, /new THREE\.Vector3\(x, \.18, z\)\.project\(camera\)/);
  assert.match(renderer, /publishBuildingHitTargets\(latestBuildings\)/);
  assert.match(kingdom, /\.city\.has-3d\{display:block;padding:0\}/);
  assert.match(kingdom, /\.city\.has-3d \.building \.emoji\{display:none\}/);
  assert.match(kingdom, /window\.addEventListener\("coi:kingdom-projection"/);
  assert.match(kingdom, /button\.style\.left=point\.left\.toFixed\(3\)/);
  assert.match(kingdom, /coi:kingdom-2d-fallback/);
});

test("tema compartilhado define tokens da marca e acessibilidade básica", async () => {
  const css = await readFile(new URL("../styles/coi-theme.css", import.meta.url), "utf8");
  for (const token of ["--coi-night:", "--coi-blue:", "--coi-gold:", "--coi-parchment:", "--coi-forest:", "--coi-war:"]) {
    assert.ok(css.includes(token), "token ausente: " + token);
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});


test("portal de download apresenta o emblema original com herói e espada", async () => {
  const portal = await readFile(new URL("../portal.html", import.meta.url), "utf8");
  const art = await readFile(new URL("../assets/brand/hero-emblem.svg", import.meta.url), "utf8");
  assert.match(portal, /src="\/assets\/brand\/royal-king\.webp"/);
  assert.match(art, /<svg/);
  assert.match(art, /Herói de coroa dourada/);
  assert.match(art, /espada/);
  assert.doesNotMatch(portal, /href="\/kingdom\.html"/);
});

test("PBR map derivation wraps samples at texture edges and emits bounded linear data", async () => {
  const { derivePbrTextureData } = await import("../scripts/kingdom-materials.js");
  const width = 8, height = 8;
  const luminance = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    luminance[y * width + x] = Math.min(255, x * 24 + y * 9);
  }
  const result = derivePbrTextureData({ luminance, width, height, kind: "stone" });
  assert.equal(result.normalData.length, width * height * 4);
  assert.equal(result.roughnessData.length, width * height * 4);
  assert.ok(result.normalData.every(value => Number.isFinite(value) && value >= 0 && value <= 255));
  assert.ok(result.roughnessData.every(value => Number.isFinite(value) && value >= 0 && value <= 255));
  assert.ok(result.normalData.some((value, index) => index % 4 === 0 && value !== 128));
  assert.equal(result.normalData[3], 255);
  assert.equal(result.roughnessData[3], 255);
});

test("PBR map generation rejects malformed or excessive image dimensions", async () => {
  const { derivePbrTextureData } = await import("../scripts/kingdom-materials.js");
  assert.throws(() => derivePbrTextureData({ width: 1, height: 4, luminance: new Uint8Array(4) }), RangeError);
  assert.throws(() => derivePbrTextureData({ width: 4, height: 4, luminance: new Uint8Array(8) }), TypeError);
  assert.throws(() => derivePbrTextureData({ width: 4096, height: 4096, luminance: new Uint8Array(1) }), RangeError);
});
