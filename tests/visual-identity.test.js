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

test("tema compartilhado define tokens da marca e acessibilidade básica", async () => {
  const css = await readFile(new URL("../styles/coi-theme.css", import.meta.url), "utf8");
  for (const token of ["--coi-night:", "--coi-blue:", "--coi-gold:", "--coi-parchment:", "--coi-forest:", "--coi-war:"]) {
    assert.ok(css.includes(token), "token ausente: " + token);
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
