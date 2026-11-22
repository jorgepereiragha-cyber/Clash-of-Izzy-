import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");

test("um Worker, um D1 de producao e um PWA canonicos", () => {
  const wrangler = JSON.parse(read("wrangler.jsonc"));
  const pkg = JSON.parse(read("package.json"));
  assert.equal(wrangler.main, "worker.js");
  assert.equal(wrangler.d1_databases?.length, 1);
  assert.equal(wrangler.d1_databases[0].binding, "DB");
  assert.equal(wrangler.d1_databases[0].migrations_dir, "migrations");
  assert.match(pkg.scripts.deploy, /wrangler --config wrangler\.jsonc deploy/);
  for (const path of ["worker.js", "city-layout-rules.js", "sw.js", "manifest.json", "kingdom.html"]) {
    assert.ok(existsSync(new URL(path, root)), "Artefato existente ausente: " + path);
  }
  for (const path of ["src/index.js", "wrangler.toml", "public/sw.js", "public/manifest.json"]) {
    assert.equal(existsSync(new URL(path, root)), false,
      "Arquitetura paralela detectada: " + path + " (integrar ao arquivo canonico)");
  }
});

test("migracoes novas possuem numeracao exclusiva sem renumerar historico D1", () => {
  // Numeracoes repetidas ate 0036 sao legado ja versionado: NUNCA renomear/apagar
  // migracoes potencialmente aplicadas. Conferir apenas inclusoes novas.
  const filenames = readdirSync(new URL("migrations/", root))
    .filter(filename => /^\d{4}_.+\.sql$/.test(filename));
  const seen = new Map();
  for (const filename of filenames) {
    const version = Number(filename.slice(0, 4));
    if (version < 37) continue;
    assert.equal(seen.has(version), false,
      "Versao D1 duplicada: " + filename + " e " + seen.get(version));
    seen.set(version, filename);
  }
  assert.equal(seen.get(39), "0039_support_orders.sql");
  assert.equal(seen.get(40), "0040_support_packages.sql");
});

test("apoio sem recompensa nao recria checkout nem inventario de pacotes", () => {
  const orders = read("migrations/0039_support_orders.sql");
  const packages = read("migrations/0040_support_packages.sql");
  assert.match(orders, /CREATE TABLE IF NOT EXISTS support_orders/);
  assert.doesNotMatch(orders, /CREATE TABLE[^;]*vip_packages/i);
  assert.match(packages, /INSERT OR IGNORE INTO vip_packages/);
  assert.doesNotMatch(packages, /CREATE TABLE/);
});
