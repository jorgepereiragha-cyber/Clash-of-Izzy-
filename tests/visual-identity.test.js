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
  assert.match(renderer, /color: "#E7BD68"/);
  assert.match(renderer, /Royal blue roofs and restrained gold standards/);
});

test("edifícios 3D possuem silhuetas e marcos próprios por função", async () => {
  const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
  for (const feature of [
    'type === "market"', 'type === "barracks"', 'type === "quarry"',
    'type === "lumber_mill"', 'type === "academy"', 'type === "hospital"',
    'type === "archery_range"', 'type === "siege_workshop"',
    'type === "embassy"', 'type === "warehouse"', 'type === "stable"'
  ]) assert.ok(renderer.includes(feature), "marco arquitetônico ausente: " + feature);
  assert.match(renderer, /emissiveIntensity: 0\.28/);
  assert.match(renderer, /new THREE\.DodecahedronGeometry/);
  assert.match(renderer, /new THREE\.TorusGeometry/);
});

test("tema compartilhado define tokens da marca e acessibilidade básica", async () => {
  const css = await readFile(new URL("../styles/coi-theme.css", import.meta.url), "utf8");
  for (const token of ["--coi-night:", "--coi-blue:", "--coi-gold:", "--coi-parchment:", "--coi-forest:", "--coi-war:"]) {
    assert.ok(css.includes(token), "token ausente: " + token);
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
