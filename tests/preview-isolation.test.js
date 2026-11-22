import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Worker Preview uses a distinct D1 database from production", async () => {
  const worker = JSON.parse(await read("wrangler.jsonc"));
  const migrations = JSON.parse(await read("wrangler.preview-migrations.jsonc"));
  const productionDb = worker.d1_databases.find(binding => binding.binding === "DB");
  const previewDb = worker.previews?.d1_databases?.find(binding => binding.binding === "DB");
  const previewMigrationsDb = migrations.d1_databases.find(binding => binding.binding === "PREVIEW_DB");

  assert.equal(worker.main, "worker.js");
  assert.ok(productionDb?.database_id, "production DB binding must remain configured");
  assert.ok(previewDb?.database_id, "Preview DB binding must be configured");
  assert.notEqual(previewDb.database_id, productionDb.database_id,
    "Preview must never point at the production D1 database");
  assert.equal(previewDb.database_id, previewMigrationsDb?.database_id,
    "Worker Preview and PREVIEW_DB migrations must target the same staging database");
  assert.equal(worker.previews.vars.ENVIRONMENT, "preview");
  assert.equal(previewMigrationsDb?.migrations_dir, "migrations");
});

test("package scripts expose local and explicit remote Preview migrations", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.match(pkg.scripts["db:migrate:preview:local"], /wrangler\.preview-migrations\.jsonc.*PREVIEW_DB.*--local/);
  assert.match(pkg.scripts["db:migrate:preview:remote"], /wrangler\.preview-migrations\.jsonc.*PREVIEW_DB.*--remote/);
  assert.doesNotMatch(pkg.scripts.deploy, /preview-migrations/);
});
